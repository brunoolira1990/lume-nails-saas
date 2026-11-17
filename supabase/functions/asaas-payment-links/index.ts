// Supabase Edge Function — gera/sincroniza os Payment Links do Asaas.
//
// Chamada pelo Painel Admin (superadmin autenticado). Para cada plano:
//   1. Cria um Payment Link recorrente (chargeType RECURRENT, ciclo MONTHLY)
//      quando ainda não existe ID salvo.
//   2. Consulta o link existente e atualiza a URL salva em saas_settings.
// A landing page consome apenas as URLs via RPC pública.
//
// Ações (body JSON): { "action": "create" } (padrão) ou { "action": "sync" }.
//
// Secrets (npx supabase secrets set ...):
//   ASAAS_API_KEY       — obrigatório; chave de API do Asaas.
//   ASAAS_API_BASE_URL  — opcional; padrão https://api.asaas.com/v3
//                         (sandbox: https://api-sandbox.asaas.com/v3).
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY — injetados pelo Supabase.

import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

const DEFAULT_API_BASE = 'https://api.asaas.com/v3';

type PlanId = 'basico' | 'pro' | 'premium';

interface PlanConfig {
  id: PlanId;
  label: string;
  price: number;
  idField: 'asaas_link_basico_id' | 'asaas_link_pro_id' | 'asaas_link_premium_id';
  urlField: 'asaas_link_basico_url' | 'asaas_link_pro_url' | 'asaas_link_premium_url';
}

const PLANS: PlanConfig[] = [
  {
    id: 'basico',
    label: 'Básico',
    price: 49,
    idField: 'asaas_link_basico_id',
    urlField: 'asaas_link_basico_url',
  },
  {
    id: 'pro',
    label: 'Pro',
    price: 89,
    idField: 'asaas_link_pro_id',
    urlField: 'asaas_link_pro_url',
  },
  {
    id: 'premium',
    label: 'Premium',
    price: 149,
    idField: 'asaas_link_premium_id',
    urlField: 'asaas_link_premium_url',
  },
];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AsaasPaymentLink {
  id?: string;
  url?: string;
  name?: string;
  status?: string;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

function apiBaseUrl(): string {
  return (Deno.env.get('ASAAS_API_BASE_URL') ?? DEFAULT_API_BASE).replace(/\/+$/, '');
}

async function asaasRequest<T>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<T> {
  const apiKey = Deno.env.get('ASAAS_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY ausente.');
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: init.method,
    headers: {
      'content-type': 'application/json',
      access_token: apiKey,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Asaas ${init.method} ${path} falhou (${response.status}): ${text.slice(0, 500)}`
    );
  }

  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Valida o chamador: JWT emitido pelo Supabase + perfil superadmin.
 * `verify_jwt` já barra chamadas anônimas; aqui confirmamos o papel.
 */
async function assertSuperadmin(
  admin: SupabaseClient,
  authorization: string | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) {
    return { ok: false, status: 401, error: 'missing_authorization' };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: 'invalid_session' };
  }

  const metadataRole = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (metadataRole === 'superadmin') {
    return { ok: true };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.warn(`Aviso: não foi possível ler profiles (${profileError.message}).`);
  }

  if (profile?.role === 'superadmin') {
    return { ok: true };
  }

  return { ok: false, status: 403, error: 'forbidden' };
}

function buildLinkPayload(plan: PlanConfig): Record<string, unknown> {
  return {
    name: `Lume Nails — Plano ${plan.label}`,
    description: `Assinatura mensal do Lume Nails, plano ${plan.label}.`,
    value: plan.price,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    subscriptionCycle: 'MONTHLY',
    externalReference: `lume-plano-${plan.id}`,
    notificationEnabled: false,
  };
}

async function createLink(plan: PlanConfig): Promise<AsaasPaymentLink> {
  const created = await asaasRequest<AsaasPaymentLink>('/paymentLinks', {
    method: 'POST',
    body: buildLinkPayload(plan),
  });

  if (!created.id) {
    throw new Error(`Asaas não retornou o ID do link do plano ${plan.label}.`);
  }

  if (created.url) return created;

  // Alguns retornos não trazem a URL; busca o recurso para obter.
  return asaasRequest<AsaasPaymentLink>(
    `/paymentLinks/${encodeURIComponent(created.id)}`,
    { method: 'GET' }
  );
}

async function fetchLink(linkId: string): Promise<AsaasPaymentLink> {
  return asaasRequest<AsaasPaymentLink>(
    `/paymentLinks/${encodeURIComponent(linkId)}`,
    { method: 'GET' }
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await assertSuperadmin(admin, req.headers.get('authorization'));
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  let action = 'create';
  try {
    const raw = await req.text();
    if (raw.trim()) {
      const parsed = JSON.parse(raw) as { action?: unknown };
      if (typeof parsed.action === 'string' && parsed.action.trim()) {
        action = parsed.action.trim();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON inválido';
    return json({ error: 'invalid_json', message }, 400);
  }

  if (action !== 'create' && action !== 'sync') {
    return json({ error: 'invalid_action', message: 'Use "create" ou "sync".' }, 400);
  }

  const { data: settings, error: settingsError } = await admin
    .from('saas_settings')
    .select(
      'asaas_link_basico_id, asaas_link_pro_id, asaas_link_premium_id, asaas_link_basico_url, asaas_link_pro_url, asaas_link_premium_url'
    )
    .eq('id', 'default')
    .maybeSingle();

  if (settingsError) {
    return json({ error: 'settings_unavailable', message: settingsError.message }, 500);
  }

  const current = (settings ?? {}) as Record<string, string | null>;
  const updates: Record<string, string> = {};
  const result: Record<string, { id: string; url: string; created: boolean }> = {};
  const failures: { plan: PlanId; message: string }[] = [];

  for (const plan of PLANS) {
    const existingId = (current[plan.idField] ?? '').trim();

    try {
      if (existingId) {
        // Link já configurado: mantém o ID e atualiza a URL.
        const link = await fetchLink(existingId);
        const url = link.url?.trim() ?? '';
        if (!url) {
          throw new Error('Asaas não retornou URL para o link existente.');
        }
        updates[plan.idField] = existingId;
        updates[plan.urlField] = url;
        result[plan.id] = { id: existingId, url, created: false };
        continue;
      }

      if (action === 'sync') {
        // Sincronização não cria links ausentes.
        continue;
      }

      const link = await createLink(plan);
      const id = link.id?.trim() ?? '';
      const url = link.url?.trim() ?? '';
      if (!id || !url) {
        throw new Error('Asaas não retornou ID/URL do link criado.');
      }
      updates[plan.idField] = id;
      updates[plan.urlField] = url;
      result[plan.id] = { id, url, created: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      console.error(`Asaas: falha no plano ${plan.id}: ${message}`);
      failures.push({ plan: plan.id, message });
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('saas_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 'default');

    if (updateError) {
      return json({ error: 'settings_update_failed', message: updateError.message }, 500);
    }
  }

  return json(
    {
      ok: failures.length === 0,
      action,
      links: result,
      failures,
    },
    failures.length > 0 ? 207 : 200
  );
});
