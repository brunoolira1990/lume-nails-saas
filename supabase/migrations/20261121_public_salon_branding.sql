-- ============================================================================
-- Lume Nails — Identidade pública do salão (Portal da Cliente)
--
-- O portal é aberto sem login (link compartilhado), mas `salons` tem RLS e
-- não permite leitura anônima. Esta RPC SECURITY DEFINER expõe apenas o
-- necessário para o topo do portal: id, nome e logo_url do salão.
--
-- A leitura usa to_jsonb(s) para não falhar caso a coluna `logo_url` ainda
-- não exista no banco (nesse caso o portal usa a marca padrão do Lume Nails).
--
-- Idempotente.
-- ============================================================================

create or replace function public.public_salon_branding(p_salon_id text)
returns table (salon_id text, name text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id::text as salon_id,
    coalesce(
      nullif(btrim(to_jsonb(s) ->> 'nome'), ''),
      nullif(btrim(to_jsonb(s) ->> 'name'), ''),
      'Lume Nails'
    ) as name,
    nullif(btrim(to_jsonb(s) ->> 'logo_url'), '') as logo_url
  from public.salons s
  where s.id::text = btrim(p_salon_id)
  limit 1;
$$;

revoke all on function public.public_salon_branding(text) from public;
grant execute on function public.public_salon_branding(text) to anon, authenticated;

-- Conferência:
-- select * from public.public_salon_branding('<id-do-salao>');
