// Supabase Edge Function — webhook de vendas da Hotmart.
//
// Responsabilidades:
//   1. Autenticar a chamada pelo HOTTOK (painel de Configurações do SaaS ou secret).
//   2. Aceitar somente eventos de compra aprovada (PURCHASE_APPROVED / PURCHASE_COMPLETE).
//   3. Criar (ou reaproveitar) o usuário no Supabase Auth.
//   4. Provisionar o salão via RPC `hotmart_provision_salon`, que descobre as
//      colunas reais da tabela (nome/name, plano/plan, ...) e gera slug único.
//   5. Enviar o e-mail para o comprador definir a senha (convite, com fallback de recuperação).
//
// Secrets opcionais (npx supabase secrets set ...):
//   HOTMART_HOTTOK — fallback caso o token não esteja salvo em saas_settings.
//   APP_URL        — URL de destino do link do e-mail.
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY — injetados automaticamente pelo Supabase.

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

const APPROVED_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const USERS_PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export interface HotmartBuyer {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface HotmartPayload {
  event?: string;
  version?: string;
  /** Formato antigo (v1). */
  buyer?: HotmartBuyer;
  /** Formato atual (v2). */
  data?: {
    buyer?: HotmartBuyer;
    purchase?: {
      status?: string;
      transaction?: string;
    };
  };
}

interface ProvisionedSalon {
  salonId: string;
  slug: string;
  created: boolean;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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

function extractBuyer(payload: HotmartPayload): HotmartBuyer | null {
  return payload.data?.buyer ?? payload.buyer ?? null;
}

function extractName(buyer: HotmartBuyer, email: string): string {
  const full = buyer.name?.trim();
  if (full) return full;

  const parts = [buyer.first_name, buyer.last_name].filter(
    (part): part is string => Boolean(part?.trim())
  );
  if (parts.length > 0) return parts.join(' ').trim();

  return email.split('@')[0];
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
    user_metadata: { full_name: name, source: 'hotmart' },
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

interface ProvisionSalonInput {
  ownerId: string;
  nome: string;
  email: string;
}

/**
 * Cria (ou reaproveita) o salão do comprador.
 *
 * O INSERT acontece dentro da RPC `hotmart_provision_salon` (migração
 * 20261118_admin_enterprise.sql), que lê o schema real da tabela `salons`.
 * Assim a função funciona tanto com `nome`/`email_contato`/`status_assinatura`
 * quanto com `name`/`email`/`status`, sem depender de uma grafia fixa.
 */
async function provisionSalon(
  admin: SupabaseClient,
  input: ProvisionSalonInput
): Promise<ProvisionedSalon> {
  const slugBase = slugify(input.nome) || 'salao';

  const { data, error } = await admin.rpc('hotmart_provision_salon', {
    p_owner_id: input.ownerId,
    p_nome: input.nome,
    p_email: input.email,
    p_slug_base: slugBase,
  });

  if (error) {
    throw new Error(`Falha ao provisionar salão: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row.salon_id !== 'string' ||
    typeof row.salon_slug !== 'string'
  ) {
    throw new Error('RPC hotmart_provision_salon retornou dados inesperados.');
  }

  return {
    salonId: row.salon_id,
    slug: row.salon_slug,
    created: Boolean(row.created),
  };
}

/**
 * Token esperado: prioriza o valor salvo no painel (saas_settings.hotmart_hottok)
 * e usa o secret HOTMART_HOTTOK como fallback.
 */
async function resolveExpectedToken(
  admin: SupabaseClient
): Promise<string | null> {
  const { data, error } = await admin
    .from('saas_settings')
    .select('hotmart_hottok')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    console.warn(`Aviso: saas_settings indisponível (${error.message}).`);
  }

  const dbToken =
    typeof data?.hotmart_hottok === 'string' ? data.hotmart_hottok.trim() : '';
  if (dbToken) return dbToken;

  const envToken = Deno.env.get('HOTMART_HOTTOK')?.trim() ?? '';
  return envToken || null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function upsertProfile(
  admin: SupabaseClient,
  userId: string,
  salonId: string
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .upsert(
      { id: userId, salon_id: salonId, role: 'owner' },
      { onConflict: 'id' }
    );

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

  console.warn(
    `Convite falhou (${invite.error.message}). Tentando e-mail de recuperação.`
  );

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Lê e registra o corpo bruto antes de validar o token. Assim o log mostra
  // exatamente o que a Hotmart enviou, inclusive testes vazios ou malformados.
  // Atenção: o payload pode conter dados pessoais do comprador (nome/e-mail).
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    console.error('Falha ao ler o corpo da requisição:', error);
    return json({ error: 'body_unreadable' }, 400);
  }

  console.log('Payload recebido:', bodyText);

  if (!bodyText.trim()) {
    console.warn('Payload vazio recebido da Hotmart.');
    return json(
      { error: 'empty_body', message: 'O corpo da requisição está vazio.' },
      400
    );
  }

  let payload: HotmartPayload;
  try {
    const parsed: unknown = JSON.parse(bodyText);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json(
        { error: 'invalid_payload', message: 'O corpo deve ser um objeto JSON.' },
        400
      );
    }

    payload = parsed as HotmartPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON inválido';
    console.error(`JSON inválido no payload da Hotmart: ${message}`);
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

  const expectedToken = await resolveExpectedToken(admin);
  if (!expectedToken) {
    console.error(
      'Token do webhook não configurado (saas_settings.hotmart_hottok ou HOTMART_HOTTOK).'
    );
    return json({ error: 'server_misconfigured' }, 500);
  }

  // O header é case-insensitive no Fetch API; enviamos um motivo distinto para
  // separar "sem header" de "token errado" ao investigar testes da Hotmart.
  const receivedToken = (req.headers.get('x-hotmart-hottok') ?? '').trim();
  if (!receivedToken) {
    console.warn('Requisição sem o header x-hotmart-hottok.');
    return json(
      { error: 'missing_hottok', message: 'Header x-hotmart-hottok ausente.' },
      401
    );
  }

  if (!safeEqual(receivedToken, expectedToken)) {
    console.warn('HOTTOK recebido não confere com o token configurado.');
    return json({ error: 'invalid_hottok', message: 'HOTTOK inválido.' }, 401);
  }

  const event = typeof payload.event === 'string' ? payload.event : '';
  if (!APPROVED_EVENTS.has(event.toUpperCase())) {
    // Eventos fora do escopo recebem 200 para a Hotmart não reenviar.
    return json({ received: true, ignored: true, event }, 200);
  }

  const buyer = extractBuyer(payload);
  const email = buyer?.email?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'buyer_email_missing' }, 400);
  }

  const name = extractName(buyer ?? {}, email);

  try {
    const { user, created: userCreated } = await createOrFindUser(admin, email, name);

    // A RPC é idempotente por owner: APPROVED e COMPLETE da mesma compra
    // reaproveitam o salão já provisionado.
    const salon = await provisionSalon(admin, {
      ownerId: user.id,
      nome: name,
      email,
    });

    await upsertProfile(admin, user.id, salon.salonId);

    if (!salon.created) {
      // Reenvio da Hotmart: só insiste no e-mail se a senha ainda não foi criada.
      if (!user.email_confirmed_at) {
        await sendPasswordSetupEmail(admin, email, name);
      }

      return json(
        { received: true, duplicate: true, salonId: salon.salonId, slug: salon.slug },
        200
      );
    }

    await sendPasswordSetupEmail(admin, email, name);

    console.log(
      `Hotmart: salão "${salon.slug}" criado para ${email} (novo usuário: ${userCreated}).`
    );

    return json(
      { received: true, salonId: salon.salonId, slug: salon.slug },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error(`Hotmart webhook falhou: ${message}`);
    return json({ error: 'processing_failed' }, 500);
  }
});
