import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Gift,
  Instagram,
  LayoutDashboard,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { cn } from '@/lib/utils';
import { fetchPublicCheckoutLinks, type CheckoutLinks } from '@/lib/saasSettings';
import { STUDIO_INFO } from '../data/initialData';
import type { ServiceItem } from '../types';

export interface LandingPageViewProps {
  services: ServiceItem[];
  onGoToBooking: (serviceId?: string) => void;
  onGoToClientPortal: () => void;
  onGoToManicurePanel: () => void;
  onShareClientLink?: () => void;
  isManicureLoggedIn?: boolean;
}

export interface LandingFeature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface LandingPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

const FEATURES: LandingFeature[] = [
  {
    id: 'agenda',
    title: 'Agenda Inteligente',
    description:
      'Agendamentos online 24h, bloqueio de horários e uma visão clara do dia para reduzir faltas e conflitos.',
    icon: CalendarDays,
  },
  {
    id: 'financeiro',
    title: 'Gestão Financeira',
    description:
      'Receitas, despesas e fluxo de caixa em tempo real, sem depender de planilhas paralelas.',
    icon: Wallet,
  },
  {
    id: 'portal',
    title: 'Portal da Cliente',
    description:
      'Sua cliente agenda, consulta horários e acompanha o cartão fidelidade sozinha, pelo celular.',
    icon: Smartphone,
  },
  {
    id: 'fidelidade',
    title: 'Cartão Fidelidade',
    description:
      'Programa de fidelidade digital que reconhece clientes recorrentes e incentiva o retorno ao estúdio.',
    icon: Gift,
  },
];

const PLANS: LandingPlan[] = [
  {
    id: 'basico',
    name: 'Básico',
    price: 49,
    description: 'Para organizar o essencial do estúdio',
    features: [
      'Agenda online 24h',
      'Cadastro de clientes e fichas',
      'Catálogo de serviços e preços',
      'Acesso pelo celular',
    ],
    cta: 'Assinar Agora',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    description: 'Para profissionalizar a gestão',
    features: [
      'Tudo do plano Básico',
      'Gestão financeira e fluxo de caixa',
      'Portal da Cliente',
      'Cartão fidelidade digital',
      'Esmalteca e estoque',
    ],
    cta: 'Assinar Pro',
    highlighted: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 149,
    description: 'Para quem quer ir além',
    features: [
      'Tudo do plano Pro',
      'Gestão de avaliações no Google',
      'Simulador de unhas',
      'Suporte prioritário no WhatsApp',
      'Acompanhamento de implantação',
    ],
    cta: 'Assinar Premium',
  },
];

const FAQS: LandingFaq[] = [
  {
    question: 'Preciso instalar algum programa?',
    answer:
      'Não. O Lume Nails funciona no navegador, no computador e no celular. Você entra com seu login e já começa a usar.',
  },
  {
    question: 'Como começo a usar no meu estúdio?',
    answer:
      'Fale com nosso time pelo WhatsApp. A gente ajuda a configurar seus serviços, horários e o link de agendamento do seu estúdio.',
  },
  {
    question: 'O portal da cliente funciona no celular?',
    answer:
      'Sim. O painel do estúdio e o portal da cliente são responsivos e funcionam direto no navegador do celular.',
  },
  {
    question: 'Posso mudar de plano depois?',
    answer:
      'Sim. Você pode evoluir ou ajustar o plano conforme a rotina do estúdio cresce. Fale com nosso time para fazer a troca.',
  },
];

const WEEK_BARS = [
  { day: 'Seg', height: 42 },
  { day: 'Ter', height: 64 },
  { day: 'Qua', height: 48 },
  { day: 'Qui', height: 78 },
  { day: 'Sex', height: 92 },
  { day: 'Sáb', height: 70 },
  { day: 'Dom', height: 36 },
];

const MOCK_APPOINTMENTS = [
  { time: '09:00', name: 'Ana Souza', service: 'Alongamento em fibra', status: 'Confirmado' },
  { time: '11:30', name: 'Marina Alves', service: 'Esmaltação em gel', status: 'Confirmado' },
  { time: '14:00', name: 'Camila Reis', service: 'Banho de gel', status: 'Aguardando' },
];

const SIDEBAR_ITEMS = [
  { label: 'Visão geral', icon: LayoutDashboard, active: true },
  { label: 'Agenda', icon: CalendarDays, active: false },
  { label: 'Clientes', icon: Users, active: false },
  { label: 'Financeiro', icon: Wallet, active: false },
  { label: 'Portal', icon: Smartphone, active: false },
];

interface CheckoutButtonProps {
  href: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  children: React.ReactNode;
  onMissingLink: () => void;
}

/**
 * Botão de assinatura: abre o checkout da Hotmart em nova aba quando o link
 * está configurado em `saas_settings`; sem link, preserva o fluxo anterior.
 */
const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  href,
  variant = 'default',
  size,
  className,
  children,
  onMissingLink,
}) => {
  if (!href) {
    return (
      <Button variant={variant} size={size} className={className} onClick={onMissingLink}>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
};

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onGoToBooking,
  onGoToClientPortal,
  onGoToManicurePanel,
  isManicureLoggedIn = false,
}) => {
  const [checkoutLinks, setCheckoutLinks] = useState<CheckoutLinks | null>(null);

  useEffect(() => {
    let active = true;

    fetchPublicCheckoutLinks()
      .then((result) => {
        if (!active) return;
        if (result.links) {
          setCheckoutLinks(result.links);
        } else if (result.error) {
          console.warn('[Landing] Não foi possível carregar os links de checkout:', result.error);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn('[Landing] Falha ao carregar os links de checkout:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const checkoutUrlFor = (planId: string): string => {
    if (!checkoutLinks) return '';
    if (planId === 'basico') return checkoutLinks.basico;
    if (planId === 'pro') return checkoutLinks.pro;
    if (planId === 'premium') return checkoutLinks.premium;
    return '';
  };

  const proCheckoutUrl = checkoutUrlFor('pro');

  const whatsappUrl = `https://wa.me/${STUDIO_INFO.phoneRaw}?text=${encodeURIComponent(
    'Olá! Gostaria de saber mais sobre o Lume Nails para o meu estúdio de beleza.'
  )}`;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-zinc-900">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center" aria-label="Lume Nails">
              <BrandLogo size="sm" />
            </a>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#funcionalidades"
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Funcionalidades
              </a>
              <a
                href="#planos"
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Planos
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Perguntas
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden h-9 rounded-xl px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline-flex"
              onClick={onGoToManicurePanel}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
              {isManicureLoggedIn ? 'Painel' : 'Entrar'}
            </Button>
            <CheckoutButton
              href={proCheckoutUrl}
              className="h-9 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-4 text-sm font-semibold shadow-sm shadow-purple-600/20 hover:from-purple-700 hover:to-purple-800"
              onMissingLink={onGoToManicurePanel}
            >
              Assinar Agora
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </CheckoutButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-purple-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-40 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:px-8 lg:pb-32">
          {/* Hero copy */}
          <div className="text-center lg:text-left">
            <Badge
              variant="outline"
              className="h-auto gap-2 rounded-full border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-600" />
              </span>
              Novo: Gestão inteligente
            </Badge>

            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-zinc-950 lg:text-6xl">
              O sistema definitivo para o seu{' '}
              <span className="bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
                estúdio de beleza
              </span>
              .
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 lg:mx-0">
              Agenda, clientes, financeiro e portal da cliente em um só lugar. Menos planilhas, menos
              mensagens perdidas e mais tempo para o que só você sabe fazer: encantar suas clientes.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <CheckoutButton
                href={proCheckoutUrl}
                size="lg"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-6 text-base font-semibold shadow-lg shadow-purple-600/20 hover:from-purple-700 hover:to-purple-800 sm:w-auto"
                onMissingLink={onGoToManicurePanel}
              >
                Assinar Agora
                <ArrowRight className="ml-1 h-4 w-4" />
              </CheckoutButton>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-12 w-full rounded-xl border-zinc-300 bg-white px-6 text-base font-semibold text-zinc-800 hover:bg-zinc-50 sm:w-auto"
              >
                <a href="#funcionalidades">
                  Conhecer o Sistema
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                Sem instalação
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                Funciona no celular
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                Suporte humano
              </span>
            </div>

            <button
              type="button"
              onClick={() => onGoToBooking()}
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-purple-700 underline-offset-4 hover:underline"
            >
              Ver como sua cliente agenda
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Product mockup */}
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute inset-x-8 -bottom-6 h-24 rounded-full bg-purple-600/10 blur-2xl"
            />

            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
              {/* Browser bar */}
              <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                </div>
                <div className="mx-auto flex w-full max-w-[240px] items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-500">
                  <Lock className="h-2.5 w-2.5" />
                  app.lumenails.com
                </div>
                <div className="w-8" />
              </div>

              <div className="flex">
                {/* Sidebar */}
                <aside className="hidden w-40 shrink-0 border-r border-zinc-100 bg-zinc-50/60 p-3 sm:block">
                  <div className="mb-4 flex items-center gap-2 px-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 text-[10px] font-bold text-white">
                      LN
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-800">Lume Nails</p>
                      <p className="text-[9px] text-zinc-500">Studio Lume</p>
                    </div>
                  </div>
                  <nav className="space-y-0.5">
                    {SIDEBAR_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium',
                            item.active
                              ? 'bg-purple-100 text-purple-700'
                              : 'text-zinc-500'
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {item.label}
                        </div>
                      );
                    })}
                  </nav>
                </aside>

                {/* Dashboard */}
                <div className="min-w-0 flex-1 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-zinc-500">Bom dia, Studio Lume</p>
                      <p className="text-sm font-bold tracking-tight text-zinc-900">Visão geral</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-5 rounded-md border-zinc-200 bg-white px-2 text-[9px] font-medium text-zinc-500"
                    >
                      Hoje
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-zinc-100 bg-white p-2">
                      <p className="text-[9px] text-zinc-500">Faturamento</p>
                      <p className="mt-0.5 text-xs font-bold text-zinc-900">R$ 4.280</p>
                      <p className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium text-emerald-600">
                        <TrendingUp className="h-2.5 w-2.5" />
                        +12,4%
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-100 bg-white p-2">
                      <p className="text-[9px] text-zinc-500">Agendamentos</p>
                      <p className="mt-0.5 text-xs font-bold text-zinc-900">12</p>
                      <p className="mt-0.5 text-[9px] font-medium text-purple-600">3 novos hoje</p>
                    </div>
                    <div className="rounded-lg border border-zinc-100 bg-white p-2">
                      <p className="text-[9px] text-zinc-500">Ocupação</p>
                      <p className="mt-0.5 text-xs font-bold text-zinc-900">86%</p>
                      <p className="mt-0.5 text-[9px] font-medium text-zinc-500">da agenda</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-zinc-100 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700">
                        <BarChart3 className="h-3 w-3 text-purple-600" />
                        Faturamento da semana
                      </p>
                      <span className="text-[9px] font-medium text-emerald-600">+18%</span>
                    </div>
                    <div className="flex h-20 items-end gap-1.5">
                      {WEEK_BARS.map((bar) => (
                        <div key={bar.day} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-16 w-full items-end">
                            <div
                              className="w-full rounded-t-sm bg-gradient-to-t from-purple-600 to-purple-300"
                              style={{ height: `${bar.height}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-zinc-500">{bar.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-zinc-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700">
                        <Clock className="h-3 w-3 text-purple-600" />
                        Próximos agendamentos
                      </p>
                      <span className="text-[9px] font-medium text-zinc-500">Hoje</span>
                    </div>
                    <div className="space-y-2">
                      {MOCK_APPOINTMENTS.map((appointment) => (
                        <div key={appointment.time} className="flex items-center gap-2">
                          <span className="w-8 shrink-0 text-[9px] font-semibold text-zinc-500">
                            {appointment.time}
                          </span>
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[8px] font-bold text-purple-700">
                            {appointment.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-semibold text-zinc-800">
                              {appointment.name}
                            </p>
                            <p className="truncate text-[8px] text-zinc-500">
                              {appointment.service}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold',
                              appointment.status === 'Confirmado'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            )}
                          >
                            {appointment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 text-center text-[9px] text-zinc-500">
                Prévia ilustrativa do painel Lume Nails
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="h-auto rounded-full border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-purple-700"
            >
              Funcionalidades
            </Badge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              Tudo o que o seu estúdio precisa para funcionar bem
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              Um software pensado para a rotina de quem atende, gerencia e cuida de cada detalhe do
              estúdio.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.id}
                  className="group h-full gap-0 rounded-2xl border border-zinc-200 bg-white p-6 ring-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-lg"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-purple-600 ring-1 ring-purple-100 transition-colors group-hover:bg-purple-100">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-zinc-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{feature.description}</p>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-zinc-500">
            Também incluso: Esmalteca, simulador de unhas e gestão do Google Meu Negócio.
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-zinc-200/80 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-700">
              Prova social
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Estúdios de beleza já organizam sua rotina com o Lume Nails
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              'Agenda online 24h',
              'Financeiro em tempo real',
              'Portal da Cliente',
              'Cartão fidelidade digital',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#FAFAFA] px-3 py-3 text-xs font-medium text-zinc-600"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="h-auto rounded-full border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-purple-700"
            >
              Planos
            </Badge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              Escolha o plano do seu estúdio
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              Três planos para acompanhar o momento do seu negócio. Comece pelo essencial e evolua
              quando precisar.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex h-full flex-col gap-0 rounded-3xl p-6 ring-0 sm:p-8',
                  plan.highlighted
                    ? 'border-2 border-purple-500 bg-purple-50/60 shadow-xl shadow-purple-600/10 lg:-mt-3 lg:mb-3'
                    : 'border border-zinc-200 bg-white shadow-sm'
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 h-6 -translate-x-1/2 rounded-full bg-purple-600 px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Mais Popular
                  </Badge>
                )}

                <div>
                  <h3 className="text-lg font-bold tracking-tight text-zinc-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-sm font-medium text-zinc-500">R$</span>
                    <span className="text-4xl font-extrabold tracking-tight text-zinc-950">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium text-zinc-500">/mês</span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-zinc-200/80 pt-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-8">
                  <CheckoutButton
                    href={checkoutUrlFor(plan.id)}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'h-11 w-full rounded-xl text-sm font-semibold',
                      plan.highlighted
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-purple-800'
                        : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                    )}
                    onMissingLink={onGoToManicurePanel}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </CheckoutButton>
                </div>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Precisa de ajuda para escolher?{' '}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-purple-700 underline-offset-4 hover:underline"
            >
              Fale com nosso time no WhatsApp
            </a>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-zinc-200/80 bg-white py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
          <div>
            <Badge
              variant="outline"
              className="h-auto rounded-full border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-purple-700"
            >
              Perguntas frequentes
            </Badge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              Ainda tem dúvidas?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              Se não encontrar o que procura, fale com nosso time. A gente ajuda a entender se o
              Lume Nails faz sentido para o seu estúdio.
            </p>
            <Button
              variant="outline"
              asChild
              className="mt-6 h-11 rounded-xl border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Phone className="mr-2 h-4 w-4 text-emerald-600" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${index}`}
                className="border-zinc-200"
              >
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-zinc-900 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-zinc-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-purple-800 to-purple-950 px-6 py-16 text-center shadow-2xl shadow-purple-900/20 sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl"
          />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Pronto para deixar o seu estúdio no piloto automático?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-purple-100">
              Comece agora e organize agenda, clientes e financeiro em um só lugar. Seu estúdio
              pronto para atender melhor.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CheckoutButton
                href={proCheckoutUrl}
                size="lg"
                className="h-12 w-full rounded-xl bg-white px-6 text-base font-semibold text-purple-900 shadow-lg hover:bg-zinc-100 sm:w-auto"
                onMissingLink={onGoToManicurePanel}
              >
                Assinar Agora
                <ArrowRight className="ml-1 h-4 w-4" />
              </CheckoutButton>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-12 w-full rounded-xl border-white/30 bg-white/5 px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto"
              >
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Phone className="mr-2 h-4 w-4" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
            <p className="mt-5 text-xs text-purple-200">
              Sem instalação · Funciona no navegador · Suporte humano
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center">
            <BrandLogo size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-500">
            <a href="#funcionalidades" className="transition-colors hover:text-zinc-900">
              Funcionalidades
            </a>
            <a href="#planos" className="transition-colors hover:text-zinc-900">
              Planos
            </a>
            <a href="#faq" className="transition-colors hover:text-zinc-900">
              Perguntas
            </a>
            <button
              type="button"
              onClick={onGoToClientPortal}
              className="transition-colors hover:text-zinc-900"
            >
              Portal da Cliente
            </button>
            <button
              type="button"
              onClick={onGoToManicurePanel}
              className="transition-colors hover:text-zinc-900"
            >
              {isManicureLoggedIn ? 'Painel' : 'Entrar'}
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900"
            >
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              {STUDIO_INFO.phone}
            </a>
            <a
              href={STUDIO_INFO.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900"
            >
              <Instagram className="h-3.5 w-3.5 text-purple-600" />
              @lumenails
            </a>
          </div>
        </div>

        <div className="border-t border-zinc-200">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} Lume Nails. Todos os direitos reservados.</p>
            <p>Gestão inteligente para estúdios de beleza</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
