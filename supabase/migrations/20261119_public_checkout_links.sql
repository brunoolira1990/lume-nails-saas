-- ============================================================================
-- Lume Nails — Links de checkout públicos para a landing page
--
-- A tabela public.saas_settings tem RLS restrita a superadmin (o HOTTOK não
-- pode ser exposto). Esta função SECURITY DEFINER devolve somente os três
-- links de checkout, liberada para anon/authenticated.
--
-- Depende de 20261118_admin_enterprise.sql (tabela saas_settings).
-- Idempotente.
-- ============================================================================

create or replace function public.public_checkout_links()
returns table (basico text, pro text, premium text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.hotmart_checkout_basico, '') as basico,
    coalesce(s.hotmart_checkout_pro, '') as pro,
    coalesce(s.hotmart_checkout_premium, '') as premium
  from public.saas_settings s
  where s.id = 'default';
$$;

revoke all on function public.public_checkout_links() from public;
grant execute on function public.public_checkout_links() to anon, authenticated;
