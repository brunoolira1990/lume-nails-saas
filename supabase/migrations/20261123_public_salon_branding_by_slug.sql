-- Identidade pública do salão (Portal da Cliente) — busca por slug.
-- Mesmos campos da RPC por id (20261122_public_salon_branding_contact.sql),
-- porém localizando o salão pela coluna `slug` (migration 20261116_salon_slug).
-- Assim o link público fica legível: /cliente/studio-de-teste
--
-- IMPORTANTE: o `drop` existe porque uma versão anterior desta função pode
-- devolver a linha inteira de `salons` (e-mail, owner_id, status...). Trocar
-- apenas com `create or replace` falha quando o tipo de retorno muda; com o
-- drop a função passa a expor somente nome, logo, telefone e endereço.

drop function if exists public.public_salon_branding_by_slug(text);

create function public.public_salon_branding_by_slug(salon_slug text)
returns table (salon_id text, name text, logo_url text, phone text, address text)
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
    nullif(btrim(to_jsonb(s) ->> 'logo_url'), '') as logo_url,
    coalesce(
      nullif(btrim(to_jsonb(s) ->> 'telefone'), ''),
      nullif(btrim(to_jsonb(s) ->> 'whatsapp'), ''),
      nullif(btrim(to_jsonb(s) ->> 'celular'), ''),
      nullif(btrim(to_jsonb(s) ->> 'phone'), '')
    ) as phone,
    coalesce(
      nullif(btrim(to_jsonb(s) ->> 'endereco'), ''),
      nullif(btrim(to_jsonb(s) ->> 'address'), '')
    ) as address
  from public.salons s
  where lower(btrim(s.slug)) = lower(btrim(salon_slug))
  limit 1;
$$;

revoke all on function public.public_salon_branding_by_slug(text) from public;
grant execute on function public.public_salon_branding_by_slug(text) to anon, authenticated;
