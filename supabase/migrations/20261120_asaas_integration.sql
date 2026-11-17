-- ============================================================================
-- Lume Nails — Integração de pagamentos com o Asaas
--
-- Substitui a Hotmart como provedor de assinaturas. O Asaas não usa links
-- fixos por plano: é preciso cria-los via API (Edge Function
-- asaas-payment-links). O painel guarda o ID de cada Payment Link e a URL
-- devolvida pela API, usada pela landing page.
--
-- Depende de:
--   20261118_admin_enterprise.sql (saas_settings, hotmart_provision_salon)
--   20261119_public_checkout_links.sql (RPC pública)
--
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas de configuração do Asaas
--    IDs e URLs ficam em colunas separadas: o Admin edita o ID e a Edge
--    Function preenche a URL (necessária para a landing page). O token do
--    webhook é validado contra o header `asaas-access-token`.
-- ----------------------------------------------------------------------------
alter table public.saas_settings
  add column if not exists asaas_link_basico_id text,
  add column if not exists asaas_link_pro_id text,
  add column if not exists asaas_link_premium_id text,
  add column if not exists asaas_link_basico_url text,
  add column if not exists asaas_link_pro_url text,
  add column if not exists asaas_link_premium_url text,
  add column if not exists asaas_webhook_token text;

comment on column public.saas_settings.asaas_link_basico_id is
  'ID do Payment Link recorrente do plano Básico no Asaas.';
comment on column public.saas_settings.asaas_webhook_token is
  'Valor esperado no header asaas-access-token. Fallback: secret ASAAS_WEBHOOK_TOKEN.';

-- A Edge Function asaas-payment-links grava IDs/URLs com service_role.
-- A RLS continua valendo para authenticated (somente superadmin).
grant update on public.saas_settings to service_role;

-- ----------------------------------------------------------------------------
-- 2. RPC pública consumida pela landing page
--    Retorna somente as três URLs de checkout (nunca IDs, tokens ou HOTTOK).
--    Sem URL gerada o campo vem vazio e a landing usa o fallback local.
-- ----------------------------------------------------------------------------
create or replace function public.public_checkout_links()
returns table (basico text, pro text, premium text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.asaas_link_basico_url, '') as basico,
    coalesce(s.asaas_link_pro_url, '') as pro,
    coalesce(s.asaas_link_premium_url, '') as premium
  from public.saas_settings s
  where s.id = 'default';
$$;

revoke all on function public.public_checkout_links() from public;
grant execute on function public.public_checkout_links() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Provisionamento do salão comprado no Asaas
--    Reaproveita hotmart_provision_salon (detecção de colunas, slug único,
--    idempotência por owner) e aplica o plano correspondente ao Payment Link.
--    Chamada pela Edge Function asaas-webhook com service_role.
-- ----------------------------------------------------------------------------
create or replace function public.asaas_provision_salon(
  p_owner_id uuid,
  p_nome text,
  p_email text,
  p_slug_base text,
  p_plan text
)
returns table (salon_id text, salon_slug text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
  v_column text;
begin
  if p_plan not in ('basico', 'pro', 'premium') then
    raise exception 'Plano inválido: %', p_plan using errcode = '22023';
  end if;

  select *
  into v_result
  from public.hotmart_provision_salon(
    p_owner_id,
    p_nome,
    p_email,
    p_slug_base
  );

  -- Mantém o plano do salão alinhado ao link pago (compra e renovações).
  for v_column in
    select t.column_name
    from unnest(array['plano', 'plano_assinatura', 'plan']) as t(column_name)
    where public.salon_column_exists(t.column_name)
  loop
    execute format(
      'update public.salons set %I = $1 where id::text = $2',
      v_column
    ) using p_plan, v_result.salon_id;
  end loop;

  return query select v_result.salon_id, v_result.salon_slug, v_result.created;
end;
$$;

revoke all on function public.asaas_provision_salon(uuid, text, text, text, text) from public;
grant execute on function public.asaas_provision_salon(uuid, text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 4. Conferência
-- ----------------------------------------------------------------------------
-- select * from public.public_checkout_links();
-- select asaas_link_basico_id, asaas_link_pro_id, asaas_link_premium_id
--   from public.saas_settings where id = 'default';
