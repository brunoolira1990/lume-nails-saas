import { supabase } from './supabase';
import type { SalonPlan, SalonStatus } from '../types';
import {
  SALON_CREATED_AT_KEYS,
  SALON_EMAIL_KEYS,
  SALON_NAME_KEYS,
  SALON_OWNER_KEYS,
  SALON_PHONE_KEYS,
  SALON_PLAN_KEYS,
  SALON_STATUS_KEYS,
  normalizeSalonPlan,
  normalizeSalonStatus,
  readDbString,
  readDbValue,
  type DbRow,
} from './salonFields';

export interface AdminSalon {
  id: string;
  /** `salons.nome` (ou `salons.name` em bancos com schema em inglês). */
  nome: string;
  email?: string;
  phone?: string;
  plan: SalonPlan;
  status: SalonStatus;
  ownerId?: string;
  createdAt?: string;
}

export interface AdminSalonListResult {
  salons: AdminSalon[];
  error: string | null;
}

export const PLAN_PRICES: Record<SalonPlan, number> = {
  basico: 49,
  pro: 89,
  premium: 149,
};

export const PLAN_LABELS: Record<SalonPlan, string> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
};

export const STATUS_LABELS: Record<SalonStatus, string> = {
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  inativo: 'Suspenso',
};

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

export { normalizeSalonPlan as normalizePlan, normalizeSalonStatus as normalizeStatus } from './salonFields';

function mapSalonRow(row: DbRow): AdminSalon {
  return {
    id: readDbString(row, ['id']) ?? '',
    nome: readDbString(row, SALON_NAME_KEYS) ?? 'Salão sem nome',
    email: readDbString(row, SALON_EMAIL_KEYS),
    phone: readDbString(row, SALON_PHONE_KEYS),
    plan: normalizeSalonPlan(readDbValue(row, SALON_PLAN_KEYS)),
    status: normalizeSalonStatus(readDbValue(row, SALON_STATUS_KEYS)),
    ownerId: readDbString(row, SALON_OWNER_KEYS),
    createdAt: readDbString(row, SALON_CREATED_AT_KEYS),
  };
}

export async function fetchAllSalons(): Promise<AdminSalonListResult> {
  if (!supabase) {
    return { salons: [], error: 'Supabase não está configurado neste ambiente.' };
  }

  // Sem `.order()` no banco: o schema real pode usar `nome` (pt-BR) ou `name`
  // (en). A ordenação é feita no cliente, depois da normalização das colunas.
  const { data, error } = await supabase.from('salons').select('*');

  if (error) {
    return { salons: [], error: error.message };
  }

  const salons = (data ?? [])
    .map((row) => mapSalonRow(row as DbRow))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  return { salons, error: null };
}

export async function setSalonStatus(
  salonId: string,
  status: SalonStatus
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase não está configurado neste ambiente.' };
  }

  const { error } = await supabase.rpc('admin_set_salon_status', {
    p_salon_id: salonId,
    p_status: status,
  });

  return { error: error?.message ?? null };
}

export async function setSalonPlan(
  salonId: string,
  plan: SalonPlan
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase não está configurado neste ambiente.' };
  }

  const { error } = await supabase.rpc('admin_set_salon_plan', {
    p_salon_id: salonId,
    p_plan: plan,
  });

  return { error: error?.message ?? null };
}

// Envia o e-mail de recuperação usando o endpoint público do Supabase Auth.
// O Supabase responde com sucesso mesmo para e-mails sem conta (anti-enumeração).
export async function sendOwnerPasswordReset(
  email: string
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase não está configurado neste ambiente.' };
  }

  const target = email.trim();
  if (!target) {
    return { error: 'Este salão não possui e-mail cadastrado.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(target);
  return { error: error?.message ?? null };
}
