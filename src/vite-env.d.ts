/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase. Fonte única da verdade: o .env (ou o painel da hospedagem). */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública (anon/publishable) do projeto Supabase. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
