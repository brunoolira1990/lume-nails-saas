import { supabase } from './supabase';

export interface SaasSettings {
  /** IDs dos Payment Links recorrentes no Asaas (editáveis no Admin). */
  linkBasicoId: string;
  linkProId: string;
  linkPremiumId: string;
  /** URLs devolvidas pela API do Asaas (somente leitura). */
  linkBasicoUrl: string;
  linkProUrl: string;
  linkPremiumUrl: string;
  asaasWebhookToken: string;
  updatedAt?: string;
}

export interface SaasSettingsResult {
  settings: SaasSettings | null;
  error: string | null;
}

export interface CheckoutLinks {
  basico: string;
  pro: string;
  premium: string;
}

export interface CheckoutLinksResult {
  links: CheckoutLinks | null;
  error: string | null;
}

export type AsaasPlanId = 'basico' | 'pro' | 'premium';

export interface AsaasGeneratedLink {
  id: string;
  url: string;
  created: boolean;
}

export interface GenerateAsaasLinksResult {
  links: Partial<Record<AsaasPlanId, AsaasGeneratedLink>>;
  failures: { plan: string; message: string }[];
  error: string | null;
}

const SETTINGS_ID = 'default';

export const EMPTY_SAAS_SETTINGS: SaasSettings = {
  linkBasicoId: '',
  linkProId: '',
  linkPremiumId: '',
  linkBasicoUrl: '',
  linkProUrl: '',
  linkPremiumUrl: '',
  asaasWebhookToken: '',
};

export const EMPTY_CHECKOUT_LINKS: CheckoutLinks = {
  basico: '',
  pro: '',
  premium: '',
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function fetchSaasSettings(): Promise<SaasSettingsResult> {
  if (!supabase) {
    return { settings: null, error: 'Supabase não está configurado neste ambiente.' };
  }

  const { data, error } = await supabase
    .from('saas_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return { settings: null, error: error.message };
  }

  if (!data) {
    return { settings: { ...EMPTY_SAAS_SETTINGS }, error: null };
  }

  const row = data as Record<string, unknown>;

  return {
    settings: {
      linkBasicoId: asText(row.asaas_link_basico_id),
      linkProId: asText(row.asaas_link_pro_id),
      linkPremiumId: asText(row.asaas_link_premium_id),
      linkBasicoUrl: asText(row.asaas_link_basico_url),
      linkProUrl: asText(row.asaas_link_pro_url),
      linkPremiumUrl: asText(row.asaas_link_premium_url),
      asaasWebhookToken: asText(row.asaas_webhook_token),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    },
    error: null,
  };
}

/**
 * Salva apenas os IDs e o token. As URLs são preenchidas pela Edge Function
 * asaas-payment-links a partir da API do Asaas.
 */
export async function saveSaasSettings(
  settings: SaasSettings
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase não está configurado neste ambiente.' };
  }

  const { error } = await supabase.from('saas_settings').upsert(
    {
      id: SETTINGS_ID,
      asaas_link_basico_id: settings.linkBasicoId.trim(),
      asaas_link_pro_id: settings.linkProId.trim(),
      asaas_link_premium_id: settings.linkPremiumId.trim(),
      asaas_webhook_token: settings.asaasWebhookToken.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  return { error: error?.message ?? null };
}

/**
 * Cria (action "create") ou apenas sincroniza URLs (action "sync") dos três
 * Payment Links recorrentes no Asaas. A função usa a ASAAS_API_KEY do servidor
 * e grava IDs/URLs em saas_settings.
 */
export async function generateAsaasLinks(
  action: 'create' | 'sync' = 'create'
): Promise<GenerateAsaasLinksResult> {
  const empty: GenerateAsaasLinksResult = { links: {}, failures: [], error: null };

  if (!supabase) {
    return { ...empty, error: 'Supabase não está configurado neste ambiente.' };
  }

  const { data, error } = await supabase.functions.invoke('asaas-payment-links', {
    body: { action },
  });

  if (error) {
    return { ...empty, error: error.message };
  }

  const payload = (data ?? {}) as {
    error?: unknown;
    links?: Partial<Record<AsaasPlanId, AsaasGeneratedLink>>;
    failures?: { plan: string; message: string }[];
  };

  if (typeof payload.error === 'string' && payload.error) {
    return { ...empty, error: payload.error };
  }

  return {
    links: payload.links ?? {},
    failures: Array.isArray(payload.failures) ? payload.failures : [],
    error: null,
  };
}

/**
 * Lê os links de checkout públicos via RPC SECURITY DEFINER
 * (`public_checkout_links`), já que a tabela `saas_settings` tem RLS
 * restrita a superadmins. A função expõe apenas as 3 URLs, nunca o token.
 */
export async function fetchPublicCheckoutLinks(): Promise<CheckoutLinksResult> {
  if (!supabase) {
    return { links: null, error: 'Supabase não está configurado neste ambiente.' };
  }

  const { data, error } = await supabase.rpc('public_checkout_links');

  if (error) {
    return { links: null, error: error.message };
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const row = rows[0];

  if (!row) {
    return { links: { ...EMPTY_CHECKOUT_LINKS }, error: null };
  }

  return {
    links: {
      basico: asText(row.basico).trim(),
      pro: asText(row.pro).trim(),
      premium: asText(row.premium).trim(),
    },
    error: null,
  };
}
