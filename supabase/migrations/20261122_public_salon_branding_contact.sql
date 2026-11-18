-- Identidade pública do salão (Portal da Cliente) — versão com contato.
-- A cliente não tem login, então lê somente nome, logo, telefone e endereço
-- por uma RPC SECURITY DEFINER que expõe o mínimo necessário.
-- `to_jsonb` evita erro de coluna inexistente em schemas com grafias diferentes.

drop function if exists public.public_salon_branding(text);

create function public.public_salon_branding(p_salon_id text)
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
  where s.id::text = btrim(p_salon_id)
  limit 1;
$$;

revoke all on function public.public_salon_branding(text) from public;
grant execute on function public.public_salon_branding(text) to anon, authenticated;
