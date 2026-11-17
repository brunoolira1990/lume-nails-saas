import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuChevron,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { BrandLogo } from './BrandLogo';
import { cn } from '@/lib/utils';
import type { SalonPlan, SalonStatus } from '../types';
import {
  type AdminSalon,
  fetchAllSalons,
  formatBRL,
  PLAN_LABELS,
  PLAN_PRICES,
  sendOwnerPasswordReset,
  setSalonPlan,
  setSalonStatus,
  STATUS_LABELS,
} from '../lib/admin';
import {
  EMPTY_SAAS_SETTINGS,
  fetchSaasSettings,
  generateAsaasLinks,
  saveSaasSettings,
  type SaasSettings,
} from '../lib/saasSettings';

export interface AdminViewProps {
  onBackToPanel: () => void;
  onImpersonate: (salon: AdminSalon) => Promise<boolean>;
}

type AdminSection = 'dashboard' | 'salons' | 'settings';

type ActionKind = 'status' | 'impersonate' | 'plan' | 'reset';

interface Feedback {
  kind: 'success' | 'error';
  message: string;
}

const PLAN_ORDER: SalonPlan[] = ['basico', 'pro', 'premium'];

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Receita, churn e crescimento',
    icon: LayoutDashboard,
  },
  {
    id: 'salons',
    label: 'Salões',
    description: 'Assinaturas e acessos',
    icon: Store,
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Asaas e webhook',
    icon: Settings,
  },
];

const STATUS_STYLES: Record<SalonStatus, string> = {
  ativo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  inadimplente: 'border-amber-200 bg-amber-50 text-amber-800',
  inativo: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

const PLAN_STYLES: Record<SalonPlan, string> = {
  basico: 'border-zinc-200 bg-white text-zinc-700',
  pro: 'border-purple-200 bg-purple-50 text-purple-700',
  premium: 'border-purple-300 bg-purple-100 text-purple-800',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconClassName: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, iconClassName }) => (
  <Card className="gap-0 rounded-2xl border border-zinc-200 bg-white p-5 ring-0 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950">{value}</p>
      </div>
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', iconClassName)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-zinc-500">{hint}</p>
  </Card>
);

export const AdminView: React.FC<AdminViewProps> = ({ onBackToPanel, onImpersonate }) => {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [salons, setSalons] = useState<AdminSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [acting, setActing] = useState<{ id: string; action: ActionKind } | null>(null);
  const [query, setQuery] = useState('');
  const [paymentsSalon, setPaymentsSalon] = useState<AdminSalon | null>(null);

  const [settings, setSettings] = useState<SaasSettings>(EMPTY_SAAS_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [linksGenerating, setLinksGenerating] = useState<'create' | 'sync' | null>(null);
  const settingsRequested = useRef(false);

  const loadSalons = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchAllSalons();
    setSalons(result.salons);
    setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSalons();
  }, [loadSalons]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      const result = await fetchSaasSettings();
      if (result.settings) setSettings(result.settings);
      setSettingsError(result.error);
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : 'Erro inesperado ao carregar as configurações.'
      );
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carrega uma única vez ao abrir a aba. Não depende de settingsLoading:
    // antes, o próprio setSettingsLoading(true) cancelava o efeito e os
    // skeletons ficavam na tela indefinidamente.
    if (section !== 'settings' || settingsRequested.current) return;
    settingsRequested.current = true;
    void loadSettings();
  }, [section, loadSettings]);

  const stats = useMemo(() => {
    const active = salons.filter((salon) => salon.status === 'ativo');
    const delinquent = salons.filter((salon) => salon.status === 'inadimplente');
    const suspended = salons.filter((salon) => salon.status === 'inativo');
    const mrr = active.reduce((total, salon) => total + PLAN_PRICES[salon.plan], 0);
    const churnPercent =
      salons.length === 0 ? 0 : Math.round((suspended.length / salons.length) * 100);

    const byPlan = PLAN_ORDER.map((plan) => {
      const count = salons.filter((salon) => salon.plan === plan).length;
      return { plan, count, revenue: count * PLAN_PRICES[plan] };
    });

    return { active, delinquent, suspended, mrr, churnPercent, byPlan };
  }, [salons]);

  const growth = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
      const count = salons.filter((salon) => {
        if (!salon.createdAt) return false;
        const created = new Date(salon.createdAt).getTime();
        return Number.isFinite(created) && created >= start && created < end;
      }).length;

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        count,
      };
    });

    const max = Math.max(1, ...months.map((month) => month.count));

    return months.map((month) => ({
      ...month,
      height: month.count === 0 ? 4 : Math.max(12, Math.round((month.count / max) * 100)),
    }));
  }, [salons]);

  const filteredSalons = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return salons;

    return salons.filter(
      (salon) =>
        normalizeText(salon.nome).includes(term) ||
        normalizeText(salon.email ?? '').includes(term)
    );
  }, [salons, query]);

  const handleToggleStatus = async (salon: AdminSalon) => {
    const nextStatus: SalonStatus = salon.status === 'inativo' ? 'ativo' : 'inativo';

    if (
      nextStatus === 'inativo' &&
      !window.confirm(
        `Suspender o acesso de "${salon.nome}"? As clientes e o painel do salão ficarão bloqueados.`
      )
    ) {
      return;
    }

    setActing({ id: salon.id, action: 'status' });
    setFeedback(null);
    const { error } = await setSalonStatus(salon.id, nextStatus);
    setActing(null);

    if (error) {
      setFeedback({ kind: 'error', message: error });
      return;
    }

    setSalons((prev) =>
      prev.map((item) => (item.id === salon.id ? { ...item, status: nextStatus } : item))
    );
    setFeedback({
      kind: 'success',
      message:
        nextStatus === 'inativo'
          ? `${salon.nome} foi suspenso e o acesso está bloqueado.`
          : `${salon.nome} foi reativado.`,
    });
  };

  const handleImpersonate = async (salon: AdminSalon) => {
    setActing({ id: salon.id, action: 'impersonate' });
    setFeedback(null);

    try {
      const opened = await onImpersonate(salon);
      if (!opened) {
        setFeedback({
          kind: 'error',
          message:
            'Não foi possível carregar os dados deste salão. Confirme se a migração de RLS foi aplicada.',
        });
      }
    } catch {
      setFeedback({ kind: 'error', message: 'Erro inesperado ao abrir o salão.' });
    } finally {
      setActing(null);
    }
  };

  const handleChangePlan = async (salon: AdminSalon, plan: SalonPlan) => {
    if (salon.plan === plan) return;

    setActing({ id: salon.id, action: 'plan' });
    setFeedback(null);
    const { error } = await setSalonPlan(salon.id, plan);
    setActing(null);

    if (error) {
      setFeedback({ kind: 'error', message: error });
      return;
    }

    setSalons((prev) =>
      prev.map((item) => (item.id === salon.id ? { ...item, plan } : item))
    );
    setFeedback({
      kind: 'success',
      message: `${salon.nome} agora está no plano ${PLAN_LABELS[plan]} (${formatBRL(
        PLAN_PRICES[plan]
      )}/mês).`,
    });
  };

  const handleResetPassword = async (salon: AdminSalon) => {
    setActing({ id: salon.id, action: 'reset' });
    setFeedback(null);
    const { error } = await sendOwnerPasswordReset(salon.email ?? '');
    setActing(null);

    if (error) {
      setFeedback({ kind: 'error', message: error });
      return;
    }

    setFeedback({
      kind: 'success',
      message: `Se houver uma conta cadastrada para ${salon.email}, o e-mail de redefinição de senha foi enviado.`,
    });
  };

  const updateSettings = (field: keyof SaasSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    setFeedback(null);

    const { error } = await saveSaasSettings(settings);
    setSettingsSaving(false);

    if (error) {
      setFeedback({ kind: 'error', message: `Não foi possível salvar: ${error}` });
      return;
    }

    setFeedback({ kind: 'success', message: 'Configurações do Asaas salvas com sucesso.' });
  };

  const handleGenerateLinks = async (action: 'create' | 'sync') => {
    setLinksGenerating(action);
    setSettingsError(null);
    setFeedback(null);

    try {
      const result = await generateAsaasLinks(action);

      if (result.error) {
        setFeedback({
          kind: 'error',
          message: `Falha ao ${action === 'create' ? 'gerar' : 'sincronizar'} os links: ${result.error}`,
        });
        return;
      }

      const refreshed = await fetchSaasSettings();
      if (refreshed.settings) setSettings(refreshed.settings);

      const inLinks = Object.values(result.links);
      const created = inLinks.filter((link) => link?.created).length;
      const synced = inLinks.length - created;

      if (result.failures.length > 0) {
        setFeedback({
          kind: 'error',
          message: `Links atualizados (${created} criados, ${synced} sincronizados), mas ${result.failures.length} plano(s) falharam: ${result.failures
            .map((failure) => `${PLAN_LABELS[failure.plan as SalonPlan] ?? failure.plan}: ${failure.message}`)
            .join(' | ')}`,
        });
        return;
      }

      if (inLinks.length === 0) {
        setFeedback({
          kind: 'error',
          message:
            'Nenhum link foi gerado. Confira se a ASAAS_API_KEY está configurada nos secrets da Edge Function.',
        });
        return;
      }

      setFeedback({
        kind: 'success',
        message:
          action === 'create'
            ? `${created} link(s) criado(s) e ${synced} sincronizado(s) no Asaas.`
            : `${synced} link(s) sincronizado(s) com o Asaas.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Erro inesperado ao falar com o Asaas.',
      });
    } finally {
      setLinksGenerating(null);
    }
  };

  const isBusy = acting !== null;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <Badge
              variant="outline"
              className="hidden h-auto gap-1 rounded-full border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 sm:inline-flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Superadmin
            </Badge>
          </div>

          <Button
            variant="outline"
            className="h-9 rounded-xl border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={onBackToPanel}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar ao painel
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Administração
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'bg-purple-50 text-purple-800 ring-1 ring-purple-100'
                      : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-purple-600' : 'text-zinc-500')} />
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}

            <Card className="mt-6 gap-0 rounded-2xl border border-purple-100 bg-purple-50/60 p-4 ring-0">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              <p className="mt-2 text-xs font-bold text-purple-900">Acesso protegido por RLS</p>
              <p className="mt-1 text-[11px] leading-relaxed text-purple-800">
                Somente a role superadmin lê os dados de todos os salões. O isolamento por{' '}
                <code className="font-mono">salon_id</code> continua valendo para as manicures.
              </p>
            </Card>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Mobile navigation */}
          <div className="mb-6 grid grid-cols-3 gap-2 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                    active
                      ? 'border-purple-200 bg-purple-50 text-purple-800'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              role="status"
              className={cn(
                'mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
                feedback.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              )}
            >
              {feedback.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {section === 'dashboard' && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
                    Dashboard
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Receita recorrente, churn e evolução da base do Lume Nails.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  onClick={() => void loadSalons()}
                  disabled={loading}
                >
                  <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
                  Atualizar
                </Button>
              </div>

              {loading ? (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className="h-36 animate-pulse rounded-2xl border border-zinc-200 bg-white"
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="MRR"
                    value={formatBRL(stats.mrr)}
                    hint="Receita recorrente mensal dos salões ativos"
                    icon={Wallet}
                    iconClassName="bg-purple-50 text-purple-600"
                  />
                  <StatCard
                    label="Churn"
                    value={`${stats.churnPercent}%`}
                    hint={`${stats.suspended.length} salão(ões) suspenso(s) de ${salons.length}`}
                    icon={TrendingDown}
                    iconClassName="bg-rose-50 text-rose-600"
                  />
                  <StatCard
                    label="Salões ativos"
                    value={String(stats.active.length)}
                    hint={`${salons.length} salão(ões) cadastrado(s) no total`}
                    icon={Users}
                    iconClassName="bg-emerald-50 text-emerald-700"
                  />
                  <StatCard
                    label="Inadimplentes"
                    value={String(stats.delinquent.length)}
                    hint="Assinaturas aguardando regularização"
                    icon={AlertTriangle}
                    iconClassName="bg-amber-50 text-amber-700"
                  />
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
                <Card className="gap-0 rounded-2xl border border-zinc-200 bg-white p-0 ring-0 shadow-sm xl:col-span-3">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900">Crescimento de salões</h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Novos salões cadastrados nos últimos 6 meses.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-auto rounded-full border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600"
                    >
                      {salons.length} no total
                    </Badge>
                  </div>

                  <div className="px-5 pt-6 pb-5">
                    <div className="flex h-48 items-stretch gap-2 sm:gap-3">
                      {growth.map((month) => (
                        <div
                          key={month.key}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                        >
                          <span className="text-[11px] font-semibold text-zinc-600">
                            {month.count}
                          </span>
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className={cn(
                                'w-full rounded-t-lg transition-all',
                                month.count === 0
                                  ? 'bg-zinc-200'
                                  : 'bg-gradient-to-t from-purple-600 to-purple-400'
                              )}
                              style={{ height: `${month.height}%` }}
                              title={`${month.count} salão(ões) em ${month.label}`}
                            />
                          </div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            {month.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
                      Contagem baseada em <code className="font-mono">created_at</code>. Salões sem
                      data de criação não entram no gráfico.
                    </p>
                  </div>
                </Card>

                <Card className="gap-0 rounded-2xl border border-zinc-200 bg-white p-0 ring-0 shadow-sm xl:col-span-2">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900">Resumo por plano</h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Distribuição e receita potencial.
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {stats.byPlan.map((row) => (
                      <li key={row.plan} className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              PLAN_STYLES[row.plan]
                            )}
                          >
                            {PLAN_LABELS[row.plan]}
                          </Badge>
                          <span className="text-sm font-bold text-zinc-900">
                            {formatBRL(row.revenue)}/mês
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-500">
                          {row.count} salão(ões) · {formatBRL(PLAN_PRICES[row.plan])}/mês cada
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </section>
          )}

          {section === 'salons' && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
                    Salões
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Gerencie as assinaturas, planos e acessos de cada estúdio.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  onClick={() => void loadSalons()}
                  disabled={loading}
                >
                  <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
                  Atualizar
                </Button>
              </div>

              {loadError && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Não foi possível carregar os salões: {loadError}. Verifique a migração de RLS e
                    se o seu usuário tem a role superadmin.
                  </span>
                </div>
              )}

              <Card className="mt-6 gap-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 ring-0 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nome ou e-mail"
                      aria-label="Buscar salões por nome ou e-mail"
                      className="h-9 rounded-xl border-zinc-300 bg-white pl-9 text-sm"
                    />
                  </div>
                  <Badge
                    variant="outline"
                    className="h-auto rounded-full border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600"
                  >
                    {filteredSalons.length} de {salons.length} salão(ões)
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Salão
                        </th>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          E-mail
                        </th>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Plano
                        </th>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Status
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {loading &&
                        [0, 1, 2].map((index) => (
                          <tr key={`skeleton-${index}`}>
                            <td colSpan={5} className="px-5 py-4">
                              <div className="h-10 animate-pulse rounded-lg bg-zinc-100" />
                            </td>
                          </tr>
                        ))}

                      {!loading &&
                        filteredSalons.map((salon) => {
                          const busyStatus =
                            acting?.id === salon.id && acting.action === 'status';
                          const busyImpersonate =
                            acting?.id === salon.id && acting.action === 'impersonate';
                          const busyPlan = acting?.id === salon.id && acting.action === 'plan';
                          const busyReset = acting?.id === salon.id && acting.action === 'reset';
                          const suspended = salon.status === 'inativo';

                          return (
                            <tr key={salon.id} className="transition-colors hover:bg-zinc-50/70">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[11px] font-bold text-purple-700 ring-1 ring-purple-100">
                                    {initials(salon.nome)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-zinc-900">
                                      {salon.nome}
                                    </p>
                                    {salon.phone && (
                                      <p className="truncate text-xs text-zinc-500">{salon.phone}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-zinc-600">{salon.email ?? '—'}</td>
                              <td className="px-5 py-4">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'h-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                    PLAN_STYLES[salon.plan]
                                  )}
                                >
                                  {PLAN_LABELS[salon.plan]}
                                </Badge>
                              </td>
                              <td className="px-5 py-4">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'h-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                    STATUS_STYLES[salon.status]
                                  )}
                                >
                                  {STATUS_LABELS[salon.status]}
                                </Badge>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-zinc-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                    onClick={() => void handleImpersonate(salon)}
                                    disabled={isBusy}
                                    title={`Visualizar o sistema como ${salon.nome} (somente leitura)`}
                                  >
                                    {busyImpersonate ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Entrar como
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      'h-8 rounded-lg text-xs font-semibold',
                                      suspended
                                        ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                                        : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50'
                                    )}
                                    onClick={() => void handleToggleStatus(salon)}
                                    disabled={isBusy}
                                  >
                                    {busyStatus ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : suspended ? (
                                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                    ) : (
                                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    {suspended ? 'Reativar' : 'Suspender'}
                                  </Button>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-zinc-600 hover:bg-zinc-100"
                                        aria-label={`Mais ações para ${salon.nome}`}
                                      >
                                        {busyPlan || busyReset ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <MoreHorizontal className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60">
                                      <DropdownMenuLabel>{salon.nome}</DropdownMenuLabel>

                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger disabled={isBusy}>
                                          <CreditCard />
                                          Mudar plano
                                          <DropdownMenuChevron />
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          {PLAN_ORDER.map((plan) => (
                                            <DropdownMenuItem
                                              key={plan}
                                              onSelect={() => void handleChangePlan(salon, plan)}
                                              disabled={isBusy || salon.plan === plan}
                                            >
                                              {salon.plan === plan ? (
                                                <Check />
                                              ) : (
                                                <span className="h-4 w-4" />
                                              )}
                                              <span className="flex-1">
                                                {PLAN_LABELS[plan]}
                                              </span>
                                              <span className="text-xs text-zinc-500">
                                                {formatBRL(PLAN_PRICES[plan])}
                                              </span>
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>

                                      <DropdownMenuItem
                                        onSelect={() => void handleResetPassword(salon)}
                                        disabled={isBusy || !salon.email}
                                      >
                                        <RotateCcw />
                                        Resetar senha do dono
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator />

                                      <DropdownMenuItem
                                        onSelect={() => setPaymentsSalon(salon)}
                                      >
                                        <Wallet />
                                        Ver histórico de pagamentos
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      {!loading && filteredSalons.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12">
                            <div className="flex flex-col items-center text-center">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                                {query ? (
                                  <Search className="h-6 w-6" />
                                ) : (
                                  <Store className="h-6 w-6" />
                                )}
                              </div>
                              <p className="mt-3 text-sm font-semibold text-zinc-900">
                                {loadError
                                  ? 'Salões indisponíveis'
                                  : query
                                    ? 'Nenhum salão encontrado'
                                    : 'Nenhum salão cadastrado'}
                              </p>
                              <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
                                {loadError
                                  ? 'Aplique a migração de superadmin no Supabase e recarregue esta página.'
                                  : query
                                    ? 'Ajuste a busca por nome ou e-mail.'
                                    : 'Quando o primeiro estúdio criar uma conta, ele aparece aqui.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                Suspender altera o status para <strong>inativo</strong> e bloqueia o acesso do salão
                via RLS. "Entrar como" abre uma visualização somente leitura dos dados do salão,
                mantendo a sua sessão de superadmin.
              </p>
            </section>
          )}

          {section === 'settings' && (
            <section>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
                  Configurações
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Payment Links do Asaas e token do webhook de provisionamento.
                </p>
              </div>

              {settingsError && (
                <div className="mt-6 flex flex-wrap items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    Não foi possível carregar as configurações: {settingsError}. Confirme se as
                    migrações <code className="font-mono">20261118_admin_enterprise.sql</code> e{' '}
                    <code className="font-mono">20261120_asaas_integration.sql</code> foram
                    aplicadas.
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadSettings()}
                    disabled={settingsLoading}
                    className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              <Card className="mt-6 gap-0 rounded-2xl border border-zinc-200 bg-white p-0 ring-0 shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-sm font-bold text-zinc-900">Assinaturas no Asaas</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Gere os Payment Links recorrentes ou cole o ID de um link já existente. A
                    landing page usa a URL devolvida pelo Asaas nos botões de assinatura.
                  </p>
                </div>

                <form onSubmit={(event) => void handleSaveSettings(event)} className="px-5 py-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {PLAN_ORDER.map((plan) => {
                      const field =
                        plan === 'basico'
                          ? 'linkBasicoId'
                          : plan === 'pro'
                            ? 'linkProId'
                            : 'linkPremiumId';
                      const urlField =
                        plan === 'basico'
                          ? 'linkBasicoUrl'
                          : plan === 'pro'
                            ? 'linkProUrl'
                            : 'linkPremiumUrl';
                      const checkoutUrl = settings[urlField];

                      return (
                        <div key={plan} className="space-y-2">
                          <Label
                            htmlFor={`asaas-link-${plan}`}
                            className="text-xs font-semibold text-zinc-800"
                          >
                            ID do Link de Pagamento - {PLAN_LABELS[plan]}
                          </Label>
                          <Input
                            id={`asaas-link-${plan}`}
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="ID do Payment Link no Asaas"
                            value={settings[field]}
                            onChange={(event) => updateSettings(field, event.target.value)}
                            disabled={settingsLoading || linksGenerating !== null}
                            className="h-10 rounded-xl border-zinc-300 bg-white font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-500"
                          />
                          <p className="text-[11px] text-zinc-500">
                            Plano de {formatBRL(PLAN_PRICES[plan])}/mês.
                          </p>
                          {checkoutUrl ? (
                            <a
                              href={checkoutUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-[11px] font-medium text-purple-700 underline-offset-2 hover:underline"
                              title={checkoutUrl}
                            >
                              Abrir link gerado
                            </a>
                          ) : (
                            <p className="text-[11px] text-zinc-400">Nenhuma URL gerada ainda.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <div className="max-w-xl space-y-2">
                      <Label
                        htmlFor="asaas-webhook-token"
                        className="text-xs font-semibold text-zinc-800"
                      >
                        Token do Webhook (asaas-access-token)
                      </Label>
                      <div className="relative">
                        <Input
                          id="asaas-webhook-token"
                          type={showToken ? 'text' : 'password'}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="Token configurado no painel do Asaas"
                          value={settings.asaasWebhookToken}
                          onChange={(event) =>
                            updateSettings('asaasWebhookToken', event.target.value)
                          }
                          disabled={settingsLoading || linksGenerating !== null}
                          className="h-10 rounded-xl border-zinc-300 bg-white pr-11 font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken((prev) => !prev)}
                          aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          {showToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-500">
                        O webhook valida o header{' '}
                        <code className="font-mono">asaas-access-token</code> contra este valor.
                        Se estiver vazio, a Edge Function usa o secret{' '}
                        <code className="font-mono">ASAAS_WEBHOOK_TOKEN</code>. Visível apenas para
                        superadmins.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleGenerateLinks('create')}
                        disabled={settingsLoading || linksGenerating !== null}
                        className="h-10 rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white shadow-sm shadow-purple-600/25 hover:bg-purple-700"
                      >
                        {linksGenerating === 'create' ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-4 w-4" />
                        )}
                        Gerar links no Asaas
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleGenerateLinks('sync')}
                        disabled={settingsLoading || linksGenerating !== null}
                        className="h-10 rounded-xl border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {linksGenerating === 'sync' ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-4 w-4" />
                        )}
                        Sincronizar
                      </Button>
                      <p className="text-[11px] text-zinc-500">
                        {settingsLoading
                          ? 'Carregando configurações...'
                          : settings.updatedAt
                            ? `Última atualização: ${new Date(settings.updatedAt).toLocaleString('pt-BR')}`
                            : 'Nenhuma configuração salva até agora.'}
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={settingsSaving || settingsLoading || linksGenerating !== null}
                      className="h-10 w-full rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 sm:w-auto"
                    >
                      {settingsSaving ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-4 w-4" />
                      )}
                      Salvar configurações
                    </Button>
                  </div>
                </form>
              </Card>
            </section>
          )}
        </main>
      </div>

      <Dialog
        open={paymentsSalon !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentsSalon(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de pagamentos</DialogTitle>
            <DialogDescription>
              {paymentsSalon ? paymentsSalon.nome : ''} · {paymentsSalon?.email ?? 'sem e-mail'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
            <Wallet className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              Faturas de assinatura ainda não sincronizadas
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              O banco atual não possui uma tabela de cobranças do SaaS. Quando o Asaas for
              integrada por API, cada compra e renovação aparecerá aqui. A tabela{' '}
              <code className="font-mono">transacoes</code> existe, mas registra o caixa do salão —
              não as assinaturas do Lume Nails.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-xl border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              onClick={() => setPaymentsSalon(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
