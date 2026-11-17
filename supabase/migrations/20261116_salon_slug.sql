-- ============================================================================
-- Lume Nails — slug público do salão
-- Usado pelo cadastro automático de compradores da Hotmart.
-- Execute no SQL Editor (ou via `supabase db push`).
-- ============================================================================

alter table public.salons add column if not exists slug text;

create unique index if not exists salons_slug_key
  on public.salons (slug)
  where slug is not null;

-- Confira:
-- select id, name, slug, plan, status from public.salons order by created_at desc;
