-- ============================================================================
-- Lume Nails — Compatibilidade com colunas em português (tabela salons)
--
-- O banco real pode declarar as colunas de assinatura como
--   status_assinatura / plano / email_contato / telefone / nome
-- enquanto o schema criado pela migração anterior usa
--   status / plan / email / phone / name
--
-- Este script NÃO renomeia colunas: ele detecta, em tempo de execução, qual
-- grafia existe e passa a usá-la nas funções de suspensão e de RLS.
-- Ordem de preferência: português primeiro, inglês como fallback.
--
-- Idempotente: pode ser executado mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Descoberta das colunas reais
-- ----------------------------------------------------------------------------
create or replace function public.salon_status_column()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'salons'
        and column_name = 'status_assinatura'
    ) then 'status_assinatura'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'salons'
        and column_name = 'status'
    ) then 'status'
    else null
  end;
$$;

revoke all on function public.salon_status_column() from public;

create or replace function public.salon_owner_column()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'salons'
        and column_name = 'owner_id'
    ) then 'owner_id'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'salons'
        and column_name = 'proprietario_id'
    ) then 'proprietario_id'
    else null
  end;
$$;

revoke all on function public.salon_owner_column() from public;

-- Um salão é considerado ativo a menos que o status seja explicitamente um
-- valor de bloqueio. Valores desconhecidos (ex.: 'trial') permanecem ativos.
create or replace function public.salon_status_is_active(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(trim(p_status)) not in (
      'inativo', 'inativa', 'suspenso', 'suspensa', 'suspended',
      'bloqueado', 'bloqueada', 'cancelado', 'cancelada'
    ),
    true
  );
$$;

revoke all on function public.salon_status_is_active(text) from public;

-- ----------------------------------------------------------------------------
-- 2. RLS: mesma semântica da migração anterior, agora independente da grafia
-- ----------------------------------------------------------------------------
create or replace function public.salon_member_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status_column text := public.salon_status_column();
  v_owner_column text := public.salon_owner_column();
begin
  if public.is_superadmin() or auth.uid() is null then
    return true;
  end if;

  -- Sem coluna de status conhecida: não bloqueia o acesso.
  if v_status_column is null then
    return true;
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.salons s on s.id::text = p.salon_id::text
    where p.id::text = auth.uid()::text
      and public.salon_status_is_active(to_jsonb(s) ->> v_status_column)
  ) then
    return true;
  end if;

  if v_owner_column is not null then
    if exists (
      select 1
      from public.salons s
      where (to_jsonb(s) ->> v_owner_column) = auth.uid()::text
        and public.salon_status_is_active(to_jsonb(s) ->> v_status_column)
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function public.salon_member_is_active() from public;
grant execute on function public.salon_member_is_active() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC de suspensão/reativação usando a coluna real
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_salon_status(p_salon_id text, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_column text := public.salon_status_column();
begin
  if not public.is_superadmin() then
    raise exception 'Acesso negado: apenas superadmin.' using errcode = '42501';
  end if;

  if p_status not in ('ativo', 'inadimplente', 'inativo') then
    raise exception 'Status inválido: %', p_status using errcode = '22023';
  end if;

  if v_status_column is null then
    raise exception
      'Coluna de status não encontrada em public.salons (esperado: status_assinatura ou status).'
      using errcode = '42703';
  end if;

  execute format(
    'update public.salons set %I = $1 where id::text = $2',
    v_status_column
  ) using p_status, p_salon_id;

  return found;
end;
$$;

revoke all on function public.admin_set_salon_status(text, text) from public;
grant execute on function public.admin_set_salon_status(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Conferência
-- ----------------------------------------------------------------------------
-- select public.salon_status_column() as coluna_status,
--        public.salon_owner_column()  as coluna_owner;
--
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'salons'
--  order by ordinal_position;