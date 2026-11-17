import { supabase } from './supabase';

export interface SaasSettings {
  checkoutBasico: string;
  checkoutPro: string;
  checkoutPremium: string;
  hotmartHottok: string;
  updatedAt?: string;
}

export interface SaasSettingsResult {
  settings: SaasSettings | null;
  error: string | null;
}

const SETTINGS_ID = 'default';

export const EMPTY_SAAS_SETTINGS: SaasSettings = {
  checkoutBasico: '',
  checkoutPro: '',
  checkoutPremium: '',
  hotmartHottok: '',
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
      checkoutBasico: asText(row.hotmart_checkout_basico),
      checkoutPro: asText(row.hotmart_checkout_pro),
      checkoutPremium: asText(row.hotmart_checkout_premium),
      hotmartHottok: asText(row.hotmart_hottok),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    },
    error: null,
  };
}

export async function saveSaasSettings(
  settings: SaasSettings
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase não está configurado neste ambiente.' };
  }

  const { error } = await supabase.from('saas_settings').upsert(
    {
      id: SETTINGS_ID,
      hotmart_checkout_basico: settings.checkoutBasico.trim(),
      hotmart_checkout_pro: settings.checkoutPro.trim(),
      hotmart_checkout_premium: settings.checkoutPremium.trim(),
      hotmart_hottok: settings.hotmartHottok.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  return { error: error?.message ?? null };
}