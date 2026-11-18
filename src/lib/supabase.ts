import { createClient, SupabaseClient, type User, type Session } from '@supabase/supabase-js';
import {
  Appointment,
  Client,
  ServiceItem,
  Transaction,
  AppointmentStatus,
  PaymentMethod,
  PolishItem,
  Salon,
} from '../types';
import { GoogleBusinessConfig } from '../utils/googleBusiness';
import {
  SALON_ADDRESS_KEYS,
  SALON_CREATED_AT_KEYS,
  SALON_EMAIL_KEYS,
  SALON_LOGO_KEYS,
  SALON_NAME_KEYS,
  SALON_OWNER_KEYS,
  SALON_PHONE_KEYS,
  SALON_PLAN_KEYS,
  SALON_STATUS_KEYS,
  SALON_UPDATED_AT_KEYS,
  normalizeSalonPlan,
  normalizeSalonStatus,
  readDbString,
  readDbValue,
  type DbRow,
} from './salonFields';

// O .env é a única fonte da verdade: sem fallback embutido no código.
const supabaseUrl: string = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey: string = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://xyzcompany.supabase.co' &&
    !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ---------------------------------------------------------------------------
// Sessão do salão atual (multi-tenant)
// ---------------------------------------------------------------------------
// O ID do salão do usuário logado é armazenado aqui após o login e é lido por
// todas as operações de leitura (filtro) e gravação (inserção automática).
let currentSalonId: string | null = null;
let currentUser: User | null = null;

export function setCurrentSalonId(salonId: string | null) {
  currentSalonId = salonId;
}

export function getCurrentSalonId(): string | null {
  return currentSalonId;
}

export function setCurrentUser(user: User | null) {
  currentUser = user;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

// ---------------------------------------------------------------------------
// Auth (Supabase Auth)
// ---------------------------------------------------------------------------

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não inicializado');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  setCurrentSalonId(null);
  setCurrentUser(null);
}

export async function getSession() {
  if (!supabase) return { data: { session: null } as any, error: null };
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

// Busca o salão vinculado ao usuário autenticado.
// Tenta primeiro a tabela profiles (padrão Supabase) e, como fallback, salons
// filtrada pelo owner_id. Ajuste os nomes de coluna se seu schema usar outros.
export async function fetchUserSalon(userId: string): Promise<Salon | null> {  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('salon_id')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data?.salon_id) {
      const { data: salon, error: salonError } = await supabase
        .from('salons')
        .select('*')
        .eq('id', data.salon_id)
        .maybeSingle();
      if (!salonError && salon) return mapSalonFromDb(salon);
    }
  } catch {
    // ignora e tenta o fallback abaixo
  }

  try {
    // O schema real pode usar `owner_id` ou `proprietario_id`. Tentamos as duas
    // grafias e usamos a primeira que responder sem erro de coluna inexistente.
    for (const ownerColumn of ['owner_id', 'proprietario_id'] as const) {
      const { data, error } = await supabase
        .from('salons')
        .select('*')
        .eq(ownerColumn, userId)
        .maybeSingle();
      if (!error && data) return mapSalonFromDb(data);
    }
  } catch {
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Identidade pública do salão (Portal da Cliente)
// ---------------------------------------------------------------------------
// A cliente não tem login, então lê nome/logo/contato por uma RPC pública que
// expõe o mínimo necessário. Se a RPC ainda não existir no projeto, devolve
// null e o portal segue com a marca padrão do Lume Nails.
export interface PublicSalonBranding {
  id: string;
  name: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
}

export async function fetchPublicSalonBranding(
  salonId: string
): Promise<PublicSalonBranding | null> {
  if (!supabase) return null;
  const id = salonId.trim();
  if (!id) return null;

  try {
    const { data, error } = await supabase.rpc('public_salon_branding', {
      p_salon_id: id,
    });

    if (error) {
      console.warn(`Aviso: branding público indisponível (${error.message}).`);
      return null;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { salon_id?: string; name?: string; logo_url?: string; phone?: string; address?: string }
      | null;

    if (!row) return null;

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const logoUrl = typeof row.logo_url === 'string' ? row.logo_url.trim() : '';
    const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
    const address = typeof row.address === 'string' ? row.address.trim() : '';

    return {
      id: row.salon_id ? String(row.salon_id) : id,
      name: name || 'Lume Nails',
      logoUrl: logoUrl || undefined,
      phone: phone || undefined,
      address: address || undefined,
    };
  } catch (error) {
    console.warn('Aviso: falha ao carregar a identidade pública do salão.', error);
    return null;
  }
}

// Lê o papel do usuário na tabela profiles. Retorna null se a coluna
// `role` ainda não existir (migração não aplicada) ou em caso de erro.
export async function fetchUserRole(userId: string): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return typeof data.role === 'string' ? data.role : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers de normalização (banco <-> TypeScript)
// ---------------------------------------------------------------------------

function mapSalonFromDb(r: DbRow): Salon {
  return {
    id: readDbString(r, ['id']) ?? '',
    name: readDbString(r, SALON_NAME_KEYS) ?? '',
    email: readDbString(r, SALON_EMAIL_KEYS),
    phone: readDbString(r, SALON_PHONE_KEYS),
    address: readDbString(r, SALON_ADDRESS_KEYS),
    logoUrl: readDbString(r, SALON_LOGO_KEYS),
    ownerId: readDbString(r, SALON_OWNER_KEYS),
    plan: normalizeSalonPlan(readDbValue(r, SALON_PLAN_KEYS)),
    status: normalizeSalonStatus(readDbValue(r, SALON_STATUS_KEYS)),
    createdAt: readDbString(r, SALON_CREATED_AT_KEYS),
    updated_at: readDbString(r, SALON_UPDATED_AT_KEYS),
  };
}

function mapAppointmentFromDb(r: any): Appointment {
  return {
    id: r.id,
    salonId: r.salon_id || r.salonId || '',
    clientId: r.clientid || r.clientId || '',
    clientName: r.clientname || r.clientName || '',
    clientPhone: r.clientphone || r.clientPhone || '',
    serviceIds: Array.isArray(r.serviceids) ? r.serviceids : (Array.isArray(r.serviceIds) ? r.serviceIds : []),
    serviceNames: Array.isArray(r.servicenames) ? r.servicenames : (Array.isArray(r.serviceNames) ? r.serviceNames : []),
    date: r.date,
    time: r.time,
    durationMinutes: Number(r.durationminutes || r.durationMinutes || 60),
    totalPrice: Number(r.totalprice || r.totalPrice || 0),
    status: (r.status || 'agendado') as AppointmentStatus,
    notes: r.notes || '',
    paymentMethod: (r.paymentmethod || r.paymentMethod || 'pendente') as PaymentMethod,
    paid: Boolean(r.paid),
  };
}

function mapAppointmentToDb(a: Appointment): any {
  return {
    id: a.id,
    salon_id: currentSalonId || a.salonId || null,
    clientid: a.clientId,
    clientname: a.clientName,
    clientphone: a.clientPhone,
    serviceids: a.serviceIds,
    servicenames: a.serviceNames,
    date: a.date,
    time: a.time,
    durationminutes: a.durationMinutes,
    totalprice: a.totalPrice,
    status: a.status,
    notes: a.notes,
    paymentmethod: a.paymentMethod,
    paid: a.paid,
  };
}

function mapClientFromDb(r: any): Client {
  let allergiesArray: string[] = [];
  if (Array.isArray(r.allergies)) {
    allergiesArray = r.allergies;
  } else if (typeof r.allergies === 'string' && r.allergies.trim() && r.allergies !== 'Nenhuma') {
    allergiesArray = r.allergies.split(',').map((s: string) => s.trim());
  }

  return {
    id: r.id,
    salonId: r.salon_id || r.salonId || '',
    name: r.name,
    phone: r.phone,
    instagram: r.instagram || undefined,
    email: r.email || undefined,
    birthDate: r.birthdate || r.birthDate || undefined,
    allergies: allergiesArray,
    notes: r.notes || '',
    preferredNailShape: (r.preferrednailshape || r.preferredNailShape || 'amendoada') as any,
    preferredColors: r.preferredcolors || r.preferredColors || '',
    cuticleType: (r.cuticletype || r.cuticleType || 'normal') as any,
    nailIssues: Array.isArray(r.nailissues) ? r.nailissues : (Array.isArray(r.nailIssues) ? r.nailIssues : []),
    totalSpent: Number(r.totalspent || r.totalSpent || 0),
    appointmentsCount: Number(r.appointmentscount || r.appointmentsCount || 0),
    lastVisit: r.lastvisit || r.lastVisit || undefined,
    createdAt: r.createdat || r.createdAt || new Date().toISOString().split('T')[0],
  };
}

function mapClientToDb(c: Client): any {
  return {
    id: c.id,
    salon_id: currentSalonId || c.salonId || null,
    name: c.name,
    phone: c.phone,
    instagram: c.instagram || null,
    email: c.email || null,
    birthdate: c.birthDate || null,
    allergies: c.allergies && c.allergies.length > 0 ? c.allergies.join(', ') : 'Nenhuma',
    notes: c.notes || '',
    preferrednailshape: c.preferredNailShape || 'amendoada',
    cuticletype: c.cuticleType || 'normal',
    totalspent: c.totalSpent || 0,
    appointmentscount: c.appointmentsCount || 0,
    lastvisit: c.lastVisit || null,
    createdat: c.createdAt || new Date().toISOString().split('T')[0],
  };
}

function mapServiceFromDb(r: any): ServiceItem {
  return {
    id: r.id,
    salonId: r.salon_id || r.salonId || '',
    name: r.name,
    category: r.category,
    price: Number(r.price),
    durationMinutes: Number(r.durationminutes || r.durationMinutes || 60),
    description: r.description || '',
    active: r.active !== false,
    popular: Boolean(r.popular),
  };
}

function mapServiceToDb(s: ServiceItem): any {
  return {
    id: s.id,
    salon_id: currentSalonId || s.salonId || null,
    name: s.name,
    category: s.category,
    price: s.price,
    durationminutes: s.durationMinutes,
    description: s.description,
    active: s.active,
    popular: s.popular,
  };
}

function mapTransactionFromDb(r: any): Transaction {
  return {
    id: r.id,
    salonId: r.salon_id || r.salonId || '',
    date: r.date,
    time: r.time,
    type: r.type as any,
    description: r.description,
    amount: Number(r.amount),
    category: r.category as any,
    paymentMethod: (r.paymentmethod || r.paymentMethod) as any,
    appointmentId: r.appointmentid || r.appointmentId || undefined,
  };
}

function mapTransactionToDb(t: Transaction): any {
  return {
    id: t.id,
    salon_id: currentSalonId || t.salonId || null,
    date: t.date,
    time: t.time,
    type: t.type,
    description: t.description,
    amount: t.amount,
    category: t.category,
    paymentmethod: t.paymentMethod,
    appointmentid: t.appointmentId || null,
  };
}

function mapPolishFromDb(r: DbRow): PolishItem {
  return {
    id: String(r.id ?? ''),
    salonId: readDbString(r, ['salon_id']) ?? '',
    name: readDbString(r, ['nome', 'name']) ?? '',
    brand: readDbString(r, ['marca', 'brand']) ?? '',
    colorHex: readDbString(r, ['cor_hex', 'colorhex']) ?? '',
    createdAt: readDbString(r, ['created_at']) ?? undefined,
  };
}

interface PolishDbRow {
  id: string;
  salon_id: string | null;
  marca: string;
  nome: string;
  cor_hex: string;
}

function mapPolishToDb(p: PolishItem): PolishDbRow {
  return {
    id: p.id,
    salon_id: currentSalonId || p.salonId || null,
    marca: p.brand,
    nome: p.name,
    cor_hex: p.colorHex,
  };
}

// ---------------------------------------------------------------------------
// Filtro multi-tenant: aplica salon_id quando houver um salão ativo
// ---------------------------------------------------------------------------

function withSalonFilter<T>(query: T, salonId: string | null): T {
  // @ts-ignore - a query do supabase-js encadeia .eq dinamicamente
  return salonId ? (query as any).eq('salon_id', salonId) : query;
}

// Permite que o superadmin carregue os dados de um salão específico durante a
// impersonation. Sem override, mantém o salão da sessão atual.
function resolveSalonFilter(salonIdOverride?: string | null): string | null {
  return salonIdOverride === undefined ? currentSalonId : salonIdOverride;
}

// ---------------------------------------------------------------------------
// Operações de sincronização com o banco (todas multi-tenant por salon_id)
// ---------------------------------------------------------------------------

export const db = {
  // ---------- Appointments ----------
  async fetchAppointments(salonIdOverride?: string | null): Promise<Appointment[] | null> {
    if (!supabase) return null;
    try {
      let query = supabase.from('agendamentos').select('*').order('date', { ascending: true });
      query = withSalonFilter(query, resolveSalonFilter(salonIdOverride));
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchAppointments error:', error.message);
        return null;
      }
      return (data || []).map(mapAppointmentFromDb);
    } catch (err) {
      console.warn('Supabase error:', err);
      return null;
    }
  },

  async saveAppointment(apt: Appointment): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = mapAppointmentToDb(apt);
      const { error } = await supabase.from('agendamentos').upsert(payload);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase saveAppointment error:', err);
      return false;
    }
  },

  async deleteAppointment(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('agendamentos').delete().eq('id', id);
      query = withSalonFilter(query, currentSalonId);
      const { error } = await query;
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase deleteAppointment error:', err);
      return false;
    }
  },

  // ---------- Clients ----------
  async fetchClients(salonIdOverride?: string | null): Promise<Client[] | null> {
    if (!supabase) return null;
    try {
      let query = supabase.from('clientes').select('*').order('name', { ascending: true });
      query = withSalonFilter(query, resolveSalonFilter(salonIdOverride));
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchClients error:', error.message);
        return null;
      }
      return (data || []).map(mapClientFromDb);
    } catch (err) {
      console.warn('Supabase error:', err);
      return null;
    }
  },

  async saveClient(client: Client): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = mapClientToDb(client);
      const { error } = await supabase.from('clientes').upsert(payload);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase saveClient error:', err);
      return false;
    }
  },

  async deleteClient(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('clientes').delete().eq('id', id);
      query = withSalonFilter(query, currentSalonId);
      const { error } = await query;
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase deleteClient error:', err);
      return false;
    }
  },

  // ---------- Services ----------
  async fetchServices(salonIdOverride?: string | null): Promise<ServiceItem[] | null> {
    if (!supabase) return null;
    try {
      let query = supabase.from('servicos').select('*').order('price', { ascending: true });
      query = withSalonFilter(query, resolveSalonFilter(salonIdOverride));
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchServices error:', error.message);
        return null;
      }
      return (data || []).map(mapServiceFromDb);
    } catch (err) {
      console.warn('Supabase error:', err);
      return null;
    }
  },

  async saveService(service: ServiceItem): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = mapServiceToDb(service);
      const { error } = await supabase.from('servicos').upsert(payload);
      return !error;
    } catch (err) {
      console.warn('Supabase saveService error:', err);
      return false;
    }
  },

  async deleteService(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('servicos').delete().eq('id', id);
      query = withSalonFilter(query, currentSalonId);
      const { error } = await query;
      return !error;
    } catch (err) {
      console.warn('Supabase deleteService error:', err);
      return false;
    }
  },

  // ---------- Transactions ----------
  async fetchTransactions(salonIdOverride?: string | null): Promise<Transaction[] | null> {
    if (!supabase) return null;
    try {
      let query = supabase.from('transacoes').select('*').order('date', { ascending: false });
      query = withSalonFilter(query, resolveSalonFilter(salonIdOverride));
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchTransactions error:', error.message);
        return null;
      }
      return (data || []).map(mapTransactionFromDb);
    } catch (err) {
      console.warn('Supabase error:', err);
      return null;
    }
  },

  async saveTransaction(tx: Transaction): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = mapTransactionToDb(tx);
      const { error } = await supabase.from('transacoes').upsert(payload);
      return !error;
    } catch (err) {
      console.warn('Supabase saveTransaction error:', err);
      return false;
    }
  },

  async deleteTransaction(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('transacoes').delete().eq('id', id);
      query = withSalonFilter(query, currentSalonId);
      const { error } = await query;
      return !error;
    } catch (err) {
      console.warn('Supabase deleteTransaction error:', err);
      return false;
    }
  },

  // ---------- Esmaltes ----------
  async fetchPolishes(salonIdOverride?: string | null): Promise<PolishItem[] | null> {
    if (!supabase) return null;
    try {
      let query = supabase
        .from('esmaltes')
        .select('*')
        .order('created_at', { ascending: false });
      query = withSalonFilter(query, resolveSalonFilter(salonIdOverride));
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchPolishes error:', error.message);
        return null;
      }
      return (data || [])
        .map((row) => mapPolishFromDb(row as DbRow))
        .filter((p) => p.id && p.name);
    } catch (err) {
      console.warn('Supabase error:', err);
      return null;
    }
  },

  async savePolish(polish: PolishItem): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('esmaltes').upsert(mapPolishToDb(polish));
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase savePolish error:', err);
      return false;
    }
  },

  async deletePolish(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('esmaltes').delete().eq('id', id);
      query = withSalonFilter(query, currentSalonId);
      const { error } = await query;
      return !error;
    } catch (err) {
      console.warn('Supabase deletePolish error:', err);
      return false;
    }
  },

  // ---------- Google Business Configuration ----------
  async fetchGoogleConfig(): Promise<Partial<GoogleBusinessConfig> | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('google_business_config')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data) {
        return {
          apiKey: data.api_key || data.apiKey || '',
          locationId: data.location_id || data.locationId || data.place_id || '',
          placeId: data.place_id || data.placeId || data.location_id || '',
          businessName: data.business_name || data.businessName || 'Kethelin Beauty Nails',
          reviewUrl: data.review_url || data.reviewUrl || '',
          updatedAt: data.updated_at || data.updatedAt || undefined,
        };
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'google_business')
        .maybeSingle();

      if (!settingsError && settingsData && settingsData.value) {
        const val =
          typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
        return {
          apiKey: val.apiKey || val.api_key || '',
          locationId: val.locationId || val.location_id || '',
          placeId: val.placeId || val.location_id || '',
          businessName: val.businessName || 'Kethelin Beauty Nails',
          reviewUrl: val.reviewUrl || '',
          updatedAt: val.updatedAt,
        };
      }

      return null;
    } catch (err) {
      console.warn('Supabase fetchGoogleConfig error:', err);
      return null;
    }
  },

  async saveGoogleConfig(config: GoogleBusinessConfig): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase não inicializado' };
    }

    try {
      const now = new Date().toISOString();
      const payload = {
        id: 'default',
        api_key: config.apiKey || '',
        location_id: config.locationId || config.placeId || '',
        place_id: config.placeId || config.locationId || '',
        business_name: config.businessName || 'Kethelin Beauty Nails',
        review_url: config.reviewUrl || '',
        updated_at: now,
      };

      const { error } = await supabase
        .from('google_business_config')
        .upsert(payload, { onConflict: 'id' });

      if (!error) {
        return { success: true };
      }

      console.info('google_business_config table note, trying app_settings:', error.message);
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'google_business',
            value: {
              apiKey: config.apiKey,
              locationId: config.locationId || config.placeId,
              placeId: config.placeId || config.locationId,
              businessName: config.businessName,
              reviewUrl: config.reviewUrl,
              updatedAt: now,
            },
            updated_at: now,
          },
          { onConflict: 'key' }
        );

      if (!settingsError) {
        return { success: true };
      }

      return {
        success: false,
        error: error.message || settingsError.message || 'Erro ao gravar no Supabase',
      };
    } catch (err: any) {
      console.warn('Supabase saveGoogleConfig exception:', err);
      return {
        success: false,
        error: err?.message || 'Falha de comunicação com o Supabase',
      };
    }
  },
};

// Helper de conexão (mantido para retrocompatibilidade)
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('servicos').select('id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
