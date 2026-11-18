export type NailShape = 'quadrada' | 'amendoada' | 'bailarina' | 'stiletto' | 'oval' | 'redonda';

export type CuticleType = 'normal' | 'fina' | 'grossa' | 'ressecada';

export type AppointmentStatus = 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'pendente';

export type SalonPlan = 'basico' | 'pro' | 'premium';

export type SalonStatus = 'ativo' | 'inadimplente' | 'inativo';

export interface Salon {
  id: string;
  name: string;
  /** Slug público do salão (ex: studio-de-teste), usado nos links da cliente. */
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  ownerId?: string;
  plan?: SalonPlan;
  status?: SalonStatus;
  createdAt?: string;
  updated_at?: string;
}

export interface Profissional {
  id: string;
  salonId: string;
  name: string;
  email?: string;
  phone?: string;
  active?: boolean;
  createdAt?: string;
}

export interface Client {
  id: string;
  salonId?: string;
  name: string;
  phone: string;
  instagram?: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  allergies?: string[];
  preferredNailShape?: NailShape;
  preferredColors?: string;
  cuticleType?: CuticleType;
  nailIssues?: string[];
  createdAt: string;
  totalSpent: number;
  appointmentsCount: number;
  lastVisit?: string;
}

export type ServiceCategory = 'manicure' | 'pedicure' | 'combo' | 'alongamento' | 'nailart' | 'spa';

export interface ServiceItem {
  id: string;
  salonId?: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMinutes: number;
  description: string;
  active: boolean;
  popular?: boolean;
}

export interface Appointment {
  id: string;
  salonId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceIds: string[];
  serviceNames: string[];
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  totalPrice: number;
  status: AppointmentStatus;
  notes?: string;
  nailArtNotes?: string;
  paymentMethod?: PaymentMethod;
  paid: boolean;
}

export type TransactionType = 'entrada' | 'saida';

export interface Transaction {
  id: string;
  salonId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: TransactionType;
  description: string;
  amount: number;
  category: 'servico' | 'produto' | 'materiais' | 'aluguel_fixo' | 'cursos' | 'outros';
  paymentMethod: PaymentMethod;
  appointmentId?: string;
}

/** Esmalte da tabela `esmaltes` (id, salon_id, marca, nome, cor_hex). */
export interface PolishItem {
  id: string;
  salonId?: string;
  name: string;
  brand: string;
  colorHex: string;
  createdAt?: string;
}

/** Dados mínimos do formulário de cadastro de esmalte. */
export type PolishDraft = Pick<PolishItem, 'name' | 'brand' | 'colorHex'>;
