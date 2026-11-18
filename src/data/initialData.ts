import { Client, ServiceItem, Appointment, Transaction } from '../types';

// Dados do estúdio (nome, endereço, telefone, avaliações) NÃO ficam aqui:
// são lidos da tabela `salons` do salão logado ou do link público.

export interface GoogleReview {
  id: string;
  author: string;
  avatarColor: string;
  avatarLetter: string;
  rating: number;
  date: string;
  service: string;
  comment: string;
  verified: boolean;
}

// Inicialmente vazio para não exibir avaliações fakes/fictícias
export const GOOGLE_REVIEWS: GoogleReview[] = [];

export const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-fibra',
    name: 'Alongamento em Fibra de Vidro',
    category: 'alongamento',
    price: 70,
    durationMinutes: 120,
    description: 'Alongamento resistente com aspecto fino e natural, curvatura impecável e acabamento duradouro.',
    active: true,
    popular: true,
  },
  {
    id: 'srv-molde-f1',
    name: 'Alongamento no Molde F1',
    category: 'alongamento',
    price: 65,
    durationMinutes: 90,
    description: 'Técnica express com molde dual form F1, estrutura pré-nivelada e brilho espelhado.',
    active: true,
    popular: true,
  },
  {
    id: 'srv-banho-gel',
    name: 'Banho em Gel / Blindagem',
    category: 'alongamento',
    price: 55,
    durationMinutes: 60,
    description: 'Camada protetora estruturada sobre a unha natural para fortalecimento, brilho e prevenção de quebras.',
    active: true,
    popular: true,
  },
  {
    id: 'srv-esmalte-gel',
    name: 'Esmaltação em Gel',
    category: 'manicure',
    price: 45,
    durationMinutes: 50,
    description: 'Secagem instantânea na cabine UV/LED, cor uniforme e durabilidade de até 20 dias sem descascar.',
    active: true,
    popular: true,
  },
  {
    id: 'srv-manutencao',
    name: 'Manutenção de Alongamento',
    category: 'alongamento',
    price: 55,
    durationMinutes: 80,
    description: 'Reposição do crescimento, nivelação da lâmina e troca de esmaltação.',
    active: true,
  },
  {
    id: 'srv-nail-art',
    name: 'Nail Art & Decoração (por unha)',
    category: 'nailart',
    price: 10,
    durationMinutes: 15,
    description: 'Francesinha reversa, babyboomer, encapsuladas, folhas de ouro ou pedrarias delicadas.',
    active: true,
  },
  {
    id: 'srv-remocao',
    name: 'Remoção Segura',
    category: 'alongamento',
    price: 30,
    durationMinutes: 40,
    description: 'Remoção cuidadosa com brocas específicas sem danificar as unhas naturais.',
    active: true,
  },
];

// Iniciar zerado para uso real de produção
export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

