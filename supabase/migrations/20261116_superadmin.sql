-- ============================================================================
-- Lume Nails — Painel Superadmin
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor) ou via
-- `supabase db push` (projeto linkado).
--
-- O script é idempotente: pode ser executado mais de uma vez.
-- As tabelas consideradas são as usadas pelo app:
--   salons, profiles, clientes, agendamentos, servicos, transacoes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas de assinatura (salons) e papel (profiles)
-- ----------------------------------------------------------------------------
create table if not exists public.salons (
  id text primary key,
  name text not null,
  email text,
  phone text,
  address text,
  owner_id uuid references auth.users (id) on delete set null,
  plan text not null default 'basico',
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);

alter table public.salons add column if not exists plan text not null default 'basico';
alter table public.salons add column if not exists status text not null default 'ativo';
alter table public.salons add column if not exists email text;
alter table public.salons enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  salon_id text,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'owner';
alter table public.profiles add column if not exists salon_id text;
alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Funções auxiliares
--    SECURITY DEFINER evita recursão de RLS ao consultar profiles/salons.
--    As comparações usam ::text para funcionar com id uuid ou text.
-- ----------------------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin', false)
    or exists (
      select 1
      from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role = 'superadmin'
    );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

create or replace function public.salon_member_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin()
    or auth.uid() is null
    or exists (
      select 1
      from public.profiles p
      join public.salons s on s.id::text = p.salon_id::text
      where p.id::text = auth.uid()::text
        and s.status <> 'inativo'
    )
    or exists (
      select 1
      from public.salons s
      where s.owner_id::text = auth.uid()::text
        and s.status <> 'inativo'
    );
$$;

revoke all on function public.salon_member_is_active() from public;
grant execute on function public.salon_member_is_active() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Leitura total para superadmin
--    Políticas PERMISSIVE são somadas (OR) às políticas existentes, então o
--    isolamento por salon_id dos demais usuários é preservado.
-- ----------------------------------------------------------------------------
drop policy if exists "superadmin_select_salons" on public.salons;
create policy "superadmin_select_salons"
  on public.salons
  as permissive
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists "superadmin_select_profiles" on public.profiles;
create policy "superadmin_select_profiles"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (public.is_superadmin());

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'agendamentos', 'servicos', 'transacoes']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists %I on public.%I', 'superadmin_select_' || t, t);
      execute format(
        'create policy %I on public.%I as permissive for select to authenticated using (public.is_superadmin())',
        'superadmin_select_' || t, t
      );
    end if;
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['google_business_config', 'app_settings']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists %I on public.%I', 'superadmin_select_' || t, t);
      execute format(
        'create policy %I on public.%I as permissive for select to authenticated using (public.is_superadmin())',
        'superadmin_select_' || t, t
      );
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Suspensão: políticas RESTRICTIVE (somadas com AND às existentes)
--    Usuário autenticado de salão com status 'inativo' perde acesso aos dados.
--    Superadmin continua lendo. Anônimo (portal de agendamento) não é afetado,
--    pois a política é aplicada apenas ao papel authenticated.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'agendamentos', 'servicos', 'transacoes']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists %I on public.%I', 'salao_ativo_' || t, t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.salon_member_is_active()) with check (public.salon_member_is_active())',
        'salao_ativo_' || t, t
      );
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC de suspensão/reativação (única forma de alterar o status)
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_salon_status(p_salon_id text, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Acesso negado: apenas superadmin.' using errcode = '42501';
  end if;

  if p_status not in ('ativo', 'inadimplente', 'inativo') then
    raise exception 'Status inválido: %', p_status using errcode = '22023';
  end if;

  update public.salons
     set status = p_status
   where id::text = p_salon_id;

  return found;
end;
$$;

revoke all on function public.admin_set_salon_status(text, text) from public;
grant execute on function public.admin_set_salon_status(text, text) to authenticated;

-- Impede que o próprio salão altere plano/status (e que um usuário se
-- promova a superadmin). As alterações passam pela RPC acima ou pelo
-- SQL Editor / service_role.
revoke update on public.salons from authenticated, anon;
revoke update on public.profiles from authenticated, anon;

-- ----------------------------------------------------------------------------
-- 6. Promover um usuário existente (opcional)
--    Recomendado: Dashboard > Authentication > Users > (usuário) > Raw App Meta
--                 Data = {"role":"superadmin"} e depois sair/entrar no app.
--    Alternativa abaixo (tabela profiles). Se nenhuma linha for atualizada,
--    o usuário ainda não tem registro em profiles — use o app_metadata.
-- ----------------------------------------------------------------------------
do $$
declare
  v_updated integer;
begin
  update public.profiles
     set role = 'superadmin'
   where id::text = (
     select u.id::text
     from auth.users u
     where u.email = 'teste@lumenails.com.br'
   );
  get diagnostics v_updated = row_count;
  raise notice 'Perfis promovidos a superadmin: % (0 = use app_metadata no Dashboard)', v_updated;
end;
$$;

-- Confira o resultado:
-- select id, email, plan, status from public.salons order by name;
-- select p.id, u.email, p.role from public.profiles p
--   join auth.users u on u.id::text = p.id::text;
