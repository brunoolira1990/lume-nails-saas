-- ============================================================================
-- Lume Nails — Configurações do SaaS, troca de plano e provisionamento Hotmart
--
-- Depende de 20261117_salon_pt_columns.sql (salon_status_column /
-- salon_owner_column). Execute as duas migrações em ordem.
--
-- Este script NÃO assume a grafia das colunas de salons: descobre em runtime
-- se a tabela usa nome/name, email_contato/email, plano/plano_assinatura/plan,
-- status_assinatura/status e owner_id/proprietario_id.
-- Idempotente: pode ser executado mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Utilitário de descoberta de colunas
-- ----------------------------------------------------------------------------
create or replace function public.salon_column_exists(p_column text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salons'
      and column_name = p_column
  );
$$;

revoke all on function public.salon_column_exists(text) from public;

create or replace function public.salon_plan_column()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.salon_column_exists('plano') then 'plano'
    when public.salon_column_exists('plano_assinatura') then 'plano_assinatura'
    when public.salon_column_exists('plan') then 'plan'
    else null
  end;
$$;

revoke all on function public.salon_plan_column() from public;

-- ----------------------------------------------------------------------------
-- 2. Configurações globais do SaaS (somente superadmin lê/escreve)
--    O HOTTOK fica protegido por RLS; a Edge Function usa service_role.
-- ----------------------------------------------------------------------------
create table if not exists public.saas_settings (
  id text primary key,
  hotmart_checkout_basico text,
  hotmart_checkout_pro text,
  hotmart_checkout_premium text,
  hotmart_hottok text,
  updated_at timestamptz not null default now()
);

insert into public.saas_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.saas_settings enable row level security;

drop policy if exists "superadmin_all_saas_settings" on public.saas_settings;
create policy "superadmin_all_saas_settings"
  on public.saas_settings
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update on public.saas_settings to authenticated;
grant select on public.saas_settings to service_role;

-- ----------------------------------------------------------------------------
-- 3. Troca de plano pela RPC (UPDATE direto em salons é revogado)
--    Atualiza todas as colunas de plano existentes para evitar divergência.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_salon_plan(p_salon_id text, p_plan text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column text;
  v_found boolean := false;
  v_updated boolean;
begin
  if not public.is_superadmin() then
    raise exception 'Acesso negado: apenas superadmin.' using errcode = '42501';
  end if;

  if p_plan not in ('basico', 'pro', 'premium') then
    raise exception 'Plano inválido: %', p_plan using errcode = '22023';
  end if;

  for v_column in
    select t.column_name
    from unnest(array['plano', 'plano_assinatura', 'plan']) as t(column_name)
    where public.salon_column_exists(t.column_name)
  loop
    execute format(
      'update public.salons set %I = $1 where id::text = $2',
      v_column
    ) using p_plan, p_salon_id;
    v_updated := found;
    v_found := v_found or v_updated;
  end loop;

  if not v_found and public.salon_plan_column() is null then
    raise exception
      'Coluna de plano não encontrada em public.salons (esperado: plano, plano_assinatura ou plan).'
      using errcode = '42703';
  end if;

  return v_found;
end;
$$;

revoke all on function public.admin_set_salon_plan(text, text) from public;
grant execute on function public.admin_set_salon_plan(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Provisionamento do salão comprado na Hotmart
--    Chamado pela Edge Function com service_role. Resolve:
--      - coluna real de nome/email/plano/status/owner;
--      - slug único (com backfill se o salão já existir sem slug);
--      - idempotência por owner (webhooks repetidos da Hotmart).
-- ----------------------------------------------------------------------------
create or replace function public.hotmart_provision_salon(
  p_owner_id uuid,
  p_nome text,
  p_email text,
  p_slug_base text
)
returns table (salon_id text, salon_slug text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_column text := public.salon_owner_column();
  v_slug_base text := nullif(trim(p_slug_base), '');
  v_existing_id text;
  v_existing_slug text;
  v_id text := gen_random_uuid()::text;
  v_slug text;
  v_attempt integer;
  v_inserted boolean := false;
  v_payload jsonb;
begin
  if v_owner_column is null then
    raise exception
      'Coluna de owner não encontrada em public.salons (esperado: owner_id ou proprietario_id).'
      using errcode = '42703';
  end if;

  if not (public.salon_column_exists('nome') or public.salon_column_exists('name')) then
    raise exception
      'Coluna de nome não encontrada em public.salons (esperado: nome ou name).'
      using errcode = '42703';
  end if;

  if not public.salon_column_exists('slug') then
    raise exception
      'Coluna slug ausente em public.salons. Aplique 20261116_salon_slug.sql.'
      using errcode = '42703';
  end if;

  if v_slug_base is null then
    v_slug_base := 'salao';
  end if;

  -- Já provisionado para este dono? (webhook APPROVED + COMPLETE)
  execute format(
    'select s.id::text, s.slug from public.salons s where (to_jsonb(s) ->> %L) = $1 limit 1',
    v_owner_column
  )
  into v_existing_id, v_existing_slug
  using p_owner_id::text;

  if v_existing_id is not null then
    if v_existing_slug is null then
      v_attempt := 1;
      v_slug := v_slug_base;
      while exists (
        select 1
        from public.salons s
        where s.slug = v_slug
          and s.id::text <> v_existing_id
      ) loop
        v_attempt := v_attempt + 1;
        v_slug := v_slug_base || '-' || v_attempt;
      end loop;

      execute 'update public.salons set slug = $1 where id::text = $2'
        using v_slug, v_existing_id;
      v_existing_slug := v_slug;
    end if;

    return query select v_existing_id, v_existing_slug, false;
    return;
  end if;

  v_payload := jsonb_build_object('slug', v_slug_base, 'id', v_id);

  if public.salon_column_exists('nome') then
    v_payload := v_payload || jsonb_build_object('nome', p_nome);
  end if;
  if public.salon_column_exists('name') then
    v_payload := v_payload || jsonb_build_object('name', p_nome);
  end if;

  if public.salon_column_exists('owner_id') then
    v_payload := v_payload || jsonb_build_object('owner_id', p_owner_id);
  end if;
  if public.salon_column_exists('proprietario_id') then
    v_payload := v_payload || jsonb_build_object('proprietario_id', p_owner_id);
  end if;

  if public.salon_column_exists('email_contato') then
    v_payload := v_payload || jsonb_build_object('email_contato', p_email);
  end if;
  if public.salon_column_exists('email') then
    v_payload := v_payload || jsonb_build_object('email', p_email);
  end if;

  if public.salon_column_exists('plano') then
    v_payload := v_payload || jsonb_build_object('plano', 'pro');
  end if;
  if public.salon_column_exists('plano_assinatura') then
    v_payload := v_payload || jsonb_build_object('plano_assinatura', 'pro');
  end if;
  if public.salon_column_exists('plan') then
    v_payload := v_payload || jsonb_build_object('plan', 'pro');
  end if;

  if public.salon_column_exists('status_assinatura') then
    v_payload := v_payload || jsonb_build_object('status_assinatura', 'ativo');
  end if;
  if public.salon_column_exists('status') then
    v_payload := v_payload || jsonb_build_object('status', 'ativo');
  end if;

  for v_attempt in 1..10 loop
    v_slug := case
      when v_attempt = 1 then v_slug_base
      else v_slug_base || '-' || v_attempt
    end;

    v_payload := jsonb_set(v_payload, '{slug}', to_jsonb(v_slug));

    begin
      insert into public.salons
      select * from jsonb_populate_record(null::public.salons, v_payload);
      v_inserted := true;
      exit;
    exception
      when unique_violation then
        -- Slug em uso: tenta o próximo sufixo.
        null;
    end;
  end loop;

  if not v_inserted then
    raise exception 'Não foi possível gerar um slug único para "%".', v_slug_base
      using errcode = '23505';
  end if;

  return query select v_id, v_slug, true;
end;
$$;

revoke all on function public.hotmart_provision_salon(uuid, text, text, text) from public;
grant execute on function public.hotmart_provision_salon(uuid, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 5. Conferência
-- ----------------------------------------------------------------------------
-- select public.salon_plan_column() as coluna_plano,
--        public.salon_status_column() as coluna_status,
--        public.salon_owner_column() as coluna_owner;
--
-- select * from public.saas_settings;