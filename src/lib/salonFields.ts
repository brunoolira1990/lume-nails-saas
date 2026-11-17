import type { SalonPlan, SalonStatus } from '../types';

/**
 * Leitura tolerante das colunas da tabela `salons`.
 *
 * O banco real pode usar nomes em português (`nome`, `email_contato`,
 * `status_assinatura`, `plano`) ou em inglês (`name`, `email`, `status`,
 * `plan`). As funções abaixo tentam as duas grafias na ordem informada, sem
 * inventar colunas: se nenhuma existir, devolvem `undefined`.
 */
export type DbRow = Record<string, unknown>;

export function readDbValue(row: DbRow, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in row) {
      const value = row[key];
      if (value !== null && value !== undefined) return value;
    }
  }

  // Fallback para grafias com caixa diferente (Nome, NOME, ...).
  const byLowercaseKey = new Map<string, string>();
  for (const actualKey of Object.keys(row)) {
    byLowercaseKey.set(actualKey.toLowerCase(), actualKey);
  }
  for (const key of keys) {
    const actualKey = byLowercaseKey.get(key.toLowerCase());
    if (!actualKey) continue;
    const value = row[actualKey];
    if (value !== null && value !== undefined) return value;
  }

  return undefined;
}

export function readDbString(row: DbRow, keys: readonly string[]): string | undefined {
  const value = readDbValue(row, keys);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function normalizeToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeSalonPlan(value: unknown): SalonPlan {
  const token = normalizeToken(value);
  if (token === 'pro') return 'pro';
  if (token === 'premium') return 'premium';
  return 'basico';
}

export function normalizeSalonStatus(value: unknown): SalonStatus {
  const token = normalizeToken(value);

  if (
    token === 'inativo' ||
    token === 'inativa' ||
    token === 'suspenso' ||
    token === 'suspensa' ||
    token === 'suspended' ||
    token === 'bloqueado' ||
    token === 'bloqueada' ||
    token === 'cancelado' ||
    token === 'cancelada'
  ) {
    return 'inativo';
  }

  if (
    token === 'inadimplente' ||
    token === 'atrasado' ||
    token === 'atrasada' ||
    token === 'overdue' ||
    token === 'late' ||
    token === 'past_due'
  ) {
    return 'inadimplente';
  }

  return 'ativo';
}

/** Colunas candidatas, em ordem de prioridade. */
export const SALON_NAME_KEYS = ['nome', 'name'] as const;
export const SALON_EMAIL_KEYS = ['email_contato', 'email'] as const;
export const SALON_PHONE_KEYS = ['telefone', 'whatsapp', 'celular', 'phone'] as const;
export const SALON_PLAN_KEYS = ['plano', 'plano_assinatura', 'plan'] as const;
export const SALON_STATUS_KEYS = ['status_assinatura', 'status'] as const;
export const SALON_OWNER_KEYS = ['owner_id', 'proprietario_id'] as const;
export const SALON_CREATED_AT_KEYS = ['created_at', 'criado_em'] as const;
export const SALON_UPDATED_AT_KEYS = ['updated_at', 'atualizado_em'] as const;
export const SALON_ADDRESS_KEYS = ['address', 'endereco'] as const;