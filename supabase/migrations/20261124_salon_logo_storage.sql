-- ============================================================================
-- Lume Nails — Edição do perfil do salão pelo superadmin + bucket `logos`
--
-- 1. Garante as colunas usadas pelo modal de edição (idempotente).
-- 2. Cria o bucket público `logos` no Supabase Storage, com limite de 2 MB e
--    apenas imagens raster (png/jpeg/webp). SVG fica de fora de propósito:
--    é um documento que pode carregar script e seria servido na mesma origem.
-- 3. RPC SECURITY DEFINER para atualizar nome/telefone/endereço/logo do salão.
--    O UPDATE direto em public.salons é revogado para authenticated/anon
--    (20261116_superadmin.sql), então a edição precisa passar por aqui.
-- 4. Policies de Storage: leitura pública do bucket e escrita só de superadmin.
--
-- Idempotente: pode ser executado mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas de perfil
--    `nome` já existe no banco real; as demais entram só se faltarem.
-- ----------------------------------------------------------------------------
alter table public.salons add column if not exists telefone text;
alter table public.salons add column if not exists endereco text;
alter table public.salons add column if not exists logo_url text;

-- ----------------------------------------------------------------------------
-- 2. Bucket público `logos`
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 3. RPC de edição do perfil
--    Descobre as grafias reais (pt/en) e atualiza todas as existentes para
--    evitar divergência entre `nome`/`name`, `telefone`/`phone`, etc.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_salon_profile(
  p_salon_id text,
  p_nome text,
  p_telefone text,
  p_endereco text,
  p_logo_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column text;
  v_assignments text[] := array[]::text[];
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_telefone text := nullif(btrim(coalesce(p_telefone, '')), '');
  v_endereco text := nullif(btrim(coalesce(p_endereco, '')), '');
  v_logo text := nullif(btrim(coalesce(p_logo_url, '')), '');
begin
  if not public.is_superadmin() then
    raise exception 'Acesso negado: apenas superadmin.' using errcode = '42501';
  end if;

  if v_nome is null then
    raise exception 'Informe o nome do salão.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.salons s where s.id::text = btrim(p_salon_id)) then
    raise exception 'Salão não encontrado: %', p_salon_id using errcode = 'P0002';
  end if;

  for v_column in
    select c from unnest(array['nome', 'name']) as c
    where public.salon_column_exists(c)
  loop
    v_assignments := v_assignments || format('%I = %L', v_column, v_nome);
  end loop;

  for v_column in
    select c from unnest(array['telefone', 'whatsapp', 'celular', 'phone']) as c
    where public.salon_column_exists(c)
  loop
    v_assignments := v_assignments || format('%I = %L', v_column, v_telefone);
  end loop;

  for v_column in
    select c from unnest(array['endereco', 'address']) as c
    where public.salon_column_exists(c)
  loop
    v_assignments := v_assignments || format('%I = %L', v_column, v_endereco);
  end loop;

  -- Null = preserva o logo atual; string vazia não é enviada pelo app.
  if v_logo is not null then
    for v_column in
      select c from unnest(array['logo_url']) as c
      where public.salon_column_exists(c)
    loop
      v_assignments := v_assignments || format('%I = %L', v_column, v_logo);
    end loop;
  end if;

  if array_length(v_assignments, 1) is null then
    raise exception
      'Nenhuma coluna editável encontrada em public.salons (nome/name, telefone/phone, endereco/address, logo_url).'
      using errcode = '42703';
  end if;

  execute format(
    'update public.salons set %s where id::text = %L',
    array_to_string(v_assignments, ', '),
    p_salon_id
  );

  return found;
end;
$$;

revoke all on function public.admin_update_salon_profile(text, text, text, text, text) from public;
grant execute on function public.admin_update_salon_profile(text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Policies do Storage
--    O bucket é público: a URL devolvida por getPublicUrl abre a imagem sem
--    sessão (é exatamente o que o portal da cliente precisa). A escrita fica
--    restrita ao superadmin.
-- ----------------------------------------------------------------------------
drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'logos');

drop policy if exists "logos_superadmin_insert" on storage.objects;
create policy "logos_superadmin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'logos' and public.is_superadmin());

drop policy if exists "logos_superadmin_update" on storage.objects;
create policy "logos_superadmin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'logos' and public.is_superadmin())
  with check (bucket_id = 'logos' and public.is_superadmin());

drop policy if exists "logos_superadmin_delete" on storage.objects;
create policy "logos_superadmin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'logos' and public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 5. Conferência
-- ----------------------------------------------------------------------------
-- select * from storage.buckets where id = 'logos';
-- select public.admin_update_salon_profile('<id>', 'Novo nome', '119...', 'Rua ...', null);
