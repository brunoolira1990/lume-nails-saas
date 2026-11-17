// Supabase Edge Function — webhook de pagamentos do Asaas.
//
// Responsabilidades:
//   1. Autenticar a chamada pelo header `asaas-access-token` (painel de
//      Configurações do SaaS ou secret ASAAS_WEBHOOK_TOKEN).
//   2. Aceitar somente o evento PAYMENT_RECEIVED (pagamento confirmado).
//   3. Buscar os dados do comprador na API do Asaas (o webhook traz apenas o
//      ID do cliente, sem e-mail).
//   4. Criar (ou reaproveitar) o usuário no Supabase Auth.
//   5. Provisionar o salão via RPC `asaas_provision_salon`, com o plano do
//      Payment Link usado na compra.
//   6. Enviar o e-mail para o comprador definir a senha (somente na criação;
//      renovações não reenviam).
//
// Secrets (npx supabase secrets set ...):
//   ASAAS_API_KEY        — obrigatório; chave de API do Asaas.
//   ASAAS_API_BASE_URL   — opcional; padrão https://api.asaas.com/v3
//                          (sandbox: https://api-sandbox.asaas.com/v3).
//   ASAAS_WEBHOOK_TOKEN  — fallback caso o token não esteja em saas_settings.
//   APP_URL              — URL de destino do link do e-mail.
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY — injetados pelo Supabase.

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

const RECEIVED_EVENT = 'PAYMENT_RECEIVED';
const USERS_PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const DEFAULT_API_BASE = 'https://api.asaas.com/v3';

const PLAN_BY_ID_FIELD: Record<string, 'basico' | 'pro' | 'premium'> = {
  asaas_link_basico_id: 'basico',
  asaas_link_pro_id: 'pro',
  asaas_link_premium_id: 'premium',
};

interface AsaasPayment {
  id?: string;
  customer?: string;
  subscription?: string;
  paymentLink?: string | null;
  externalReference?: string | null;
  value?: number;
  billingType?: string;
  status?: string;
}

interface AsaasPayload {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
}

interface AsaasCustomer {
  id?: string;
  name?: string;
  email?: string;
}

interface ProvisionedSalon {
  salonId: string;
  slug: string;
  created: boolean;
}

interface SaasLinkSettings {
  asaas_link_basico_id?: string | null;
  asaas_link_pro_id?: string | null;
  asaas_link_premium_id?: string | null;
  asaas_webhook_token?: string | null;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function apiBaseUrl(): string {
  return (Deno.env.get('ASAAS_API_BASE_URL') ?? DEFAULT_API_BASE).replace(/\/+$/, '');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Falha ao listar usuários: ${error.message}`);
    }

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email
    );
    if (match) return match;

    if (data.users.length < USERS_PAGE_SIZE) return null;
  }

  return null;
}

async function createOrFindUser(
  admin: SupabaseClient,
  email: string,
  name: string
): Promise<{ user: User; created: boolean }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: name, source: 'asaas' },
  });

  if (!error && data.user) {
    return { user: data.user, created: true };
  }

  const code = (error as { code?: string } | null)?.code;
  const message = error?.message?.toLowerCase() ?? '';
  const alreadyExists =
    code === 'email_exists' ||
    message.includes('already been registered') ||
    message.includes('already exists');

  if (!alreadyExists) {
    throw new Error(`Falha ao criar usuário: ${error?.message ?? 'erro desconhecido'}`);
  }

  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    throw new Error('Usuário já existe, mas não foi localizado pelo e-mail.');
  }

  return { user: existing, created: false };
}

async function provisionSalon(
  admin: SupabaseClient,
  input: { ownerId: string; nome: string; email: string; plan: 'basico' | 'pro' | 'premium' }
): Promise<ProvisionedSalon> {
  const slugBase = slugify(input.nome) || 'salao';

  const { data, error } = await admin.rpc('asaas_provision_salon', {
    p_owner_id: input.ownerId,
    p_nome: input.nome,
    p_email: input.email,
    p_slug_base: slugBase,
    p_plan: input.plan,
  });

  if (error) {
    throw new Error(`Falha ao provisionar salão: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.salon_id !== 'string' || typeof row.salon_slug !== 'string') {
    throw new Error('RPC asaas_provision_salon retornou dados inesperados.');
  }

  return {
    salonId: row.salon_id,
    slug: row.salon_slug,
    created: Boolean(row.created),
  };
}

async function upsertProfile(
  admin: SupabaseClient,
  userId: string,
  salonId: string
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, salon_id: salonId, role: 'owner' }, { onConflict: 'id' });

  if (error) {
    // Não interrompe a venda: o app também resolve o salão por salons.owner_id.
    console.error(`Aviso: não foi possível gravar profiles: ${error.message}`);
  }
}

async function sendPasswordSetupEmail(
  admin: SupabaseClient,
  email: string,
  name: string
): Promise<void> {
  const redirectTo = Deno.env.get('APP_URL');

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    ...(redirectTo ? { redirectTo } : {}),
  });

  if (!invite.error) return;

  console.warn(`Convite falhou (${invite.error.message}). Tentando e-mail de recuperação.`);

  const recovery = await admin.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined
  );

  if (recovery.error) {
    throw new Error(
      `Falha ao enviar e-mail para definir a senha: ${recovery.error.message}`
    );
  }
}

async function loadLinkSettings(admin: SupabaseClient): Promise<SaasLinkSettings | null> {
  const { data, error } = await admin
    .from('saas_settings')
    .select(
      'asaas_link_basico_id, asaas_link_pro_id, asaas_link_premium_id, asaas_webhook_token'
    )
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    console.warn(`Aviso: saas_settings indisponível (${error.message}).`);
    return null;
  }

  return (data as SaasLinkSettings | null) ?? null;
}

function resolveExpectedToken(settings: SaasLinkSettings | null): string | null {
  const dbToken = settings?.asaas_webhook_token?.trim() ?? '';
  if (dbToken) return dbToken;

  const envToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')?.trim() ?? '';
  return envToken || null;
}

async function fetchCustomer(customerId: string): Promise<AsaasCustomer> {
  const apiKey = Deno.env.get('ASAAS_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY ausente.');
  }

  const response = await fetch(
    `${apiBaseUrl()}/customers/${encodeURIComponent(customerId)}`,
    { headers: { access_token: apiKey } }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Falha ao buscar cliente ${customerId} no Asaas (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const customer = (await response.json()) as AsaasCustomer;
  return customer;
}

function resolvePlan(payment: AsaasPayment, settings: SaasLinkSettings | null): 'basico' | 'pro' | 'premium' {
  const linkId = typeof payment.paymentLink === 'string' ? payment.paymentLink.trim() : '';
  if (linkId && settings) {
    for (const [field, plan] of Object.entries(PLAN_BY_ID_FIELD)) {
      const configured = (settings[field as keyof SaasLinkSettings] ?? '')?.trim();
      if (configured && configured === linkId) return plan;
    }
  }

  const reference = typeof payment.externalReference === 'string'
    ? payment.externalReference.trim().toLowerCase()
    : '';
  const match = reference.match(/lume-plano-(basico|pro|premium)/);
  if (match) return match[1] as 'basico' | 'pro' | 'premium';

  // Link não mapeado (cobrança manual): mesmo plano padrão do provisionamento.
  return 'pro';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // O payload do Asaas contém apenas IDs (cliente/assinatura), sem dados
  // pessoais — seguro registra-lo para depuração de testes.
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    console.error('Falha ao ler o corpo da requisição:', error);
    return json({ error: 'body_unreadable' }, 400);
  }

  console.log('Payload recebido:', bodyText);

  if (!bodyText.trim()) {
    console.warn('Payload vazio recebido do Asaas.');
    return json(
      { error: 'empty_body', message: 'O corpo da requisição está vazio.' },
      400
    );
  }

  let payload: AsaasPayload;
  try {
    const parsed: unknown = JSON.parse(bodyText);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json(
        { error: 'invalid_payload', message: 'O corpo deve ser um objeto JSON.' },
        400
      );
    }

    payload = parsed as AsaasPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON inválido';
    console.error(`JSON inválido no payload do Asaas: ${message}`);
    return json({ error: 'invalid_json', message }, 400);
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

  const settings = await loadLinkSettings(admin);
  const expectedToken = resolveExpectedToken(settings);
  if (!expectedToken) {
    console.error(
      'Token do webhook não configurado (saas_settings.asaas_webhook_token ou ASAAS_WEBHOOK_TOKEN).'
    );
    return json({ error: 'server_misconfigured' }, 500);
  }

  const receivedToken = (req.headers.get('asaas-access-token') ?? '').trim();
  if (!receivedToken) {
    console.warn('Requisição sem o header asaas-access-token.');
    return json(
      { error: 'missing_token', message: 'Header asaas-access-token ausente.' },
      401
    );
  }

  if (!safeEqual(receivedToken, expectedToken)) {
    console.warn('Token do webhook Asaas não confere com o valor configurado.');
    return json({ error: 'invalid_token', message: 'Token do webhook inválido.' }, 401);
  }

  const event = typeof payload.event === 'string' ? payload.event.toUpperCase() : '';
  if (event !== RECEIVED_EVENT) {
    // Demais eventos recebem 200 para o Asaas não reenviar.
    return json({ received: true, ignored: true, event }, 200);
  }

  const payment = payload.payment ?? {};
  const customerId = typeof payment.customer === 'string' ? payment.customer.trim() : '';
  if (!customerId) {
    return json(
      { error: 'customer_missing', message: 'Evento sem payment.customer.' },
      400
    );
  }

  try {
    const customer = await fetchCustomer(customerId);
    const email = customer.email?.trim().toLowerCase() ?? '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(
        { error: 'customer_email_missing', message: 'Cliente do Asaas sem e-mail válido.' },
        400
      );
    }

    const name = customer.name?.trim() || email.split('@')[0];
    const plan = resolvePlan(payment, settings);

    const { user, created: userCreated } = await createOrFindUser(admin, email, name);

    // Idempotente por owner: renovações reaproveitam o salão existente.
    const salon = await provisionSalon(admin, {
      ownerId: user.id,
      nome: name,
      email,
      plan,
    });

    await upsertProfile(admin, user.id, salon.salonId);

    if (!salon.created) {
      // Renovação ou reenvio: só insiste no e-mail se a senha ainda não existe.
      if (!user.email_confirmed_at) {
        await sendPasswordSetupEmail(admin, email, name);
      }

      return json(
        {
          received: true,
          duplicate: true,
          plan,
          salonId: salon.salonId,
          slug: salon.slug,
        },
        200
      );
    }

    await sendPasswordSetupEmail(admin, email, name);

    console.log(
      `Asaas: salão "${salon.slug}" criado para ${email} (plano ${plan}, novo usuário: ${userCreated}).`
    );

    return json(
      { received: true, plan, salonId: salon.salonId, slug: salon.slug },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error(`Asaas webhook falhou: ${message}`);
    return json({ error: 'processing_failed', message }, 500);
  }
});
