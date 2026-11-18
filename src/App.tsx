import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { AppointmentsView } from './components/AppointmentsView';
import { ClientsView } from './components/ClientsView';
import { ServicesView } from './components/ServicesView';
import { FinancialView } from './components/FinancialView';
import { PolishStudioView } from './components/PolishStudioView';
import { AppointmentModal } from './components/AppointmentModal';
import { QuickMessagesModal } from './components/QuickMessagesModal';
import { LandingPageView } from './components/LandingPageView';
import { ClientPortalView } from './components/ClientPortalView';
import { ManicureLoginModal } from './components/ManicureLoginModal';
import { ShareClientLinkModal } from './components/ShareClientLinkModal';
import { GoogleBusinessAdminView } from './components/GoogleBusinessAdminView';
import { AdminView } from './components/AdminView';
import { AdminLoginView } from './components/AdminLoginView';
import { SalonContextProvider, useSalon } from './context/SalonContext';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS,
  INITIAL_SERVICES,
  INITIAL_TRANSACTIONS,
} from './data/initialData';
import { Appointment, Client, ServiceItem, Transaction, PolishDraft, PolishItem, AppointmentStatus } from './types';
import {
  db,
  isSupabaseConfigured,
  checkSupabaseConnection,
  setCurrentSalonId,
} from './lib/supabase';
import type { AdminSalon } from './lib/admin';
import {
  CheckCircle2,
  RotateCcw,
  Lock,
  Share2,
  Ban,
  ShieldAlert,
  Loader2,
  Eye,
} from 'lucide-react';

export type AppViewMode = 'landing' | 'client_portal' | 'manicure_panel' | 'admin';

/**
 * AppContent consome o contexto do salão (useSalon) e contém toda a lógica
 * de navegação, persistência e handlers de negócio. Ele é renderizado dentro
 * do <SalonContextProvider> pelo componente App para evitar o erro de hook
 * chamado fora do provider.
 */
function AppContent() {
  const {
    user,
    salon,
    salonId,
    isLoading,
    isRoleLoading,
    isSuperadmin,
    signIn,
    signOut: handleAuthSignOut,
  } = useSalon();

  // App View Modes
  const [viewMode, setViewMode] = useState<AppViewMode>('landing');
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<string | undefined>(undefined);
  // Salão identificado no link público (?salao=...), usado no portal sem login.
  const [publicSalonId, setPublicSalonId] = useState<string>('');

  // Manicure Panel Sub-Navigation
  const [currentTab, setCurrentTab] = useState<TabType>('agenda');

  // Auth state derived from Supabase session
  const isManicureAuthenticated = Boolean(user);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isShareClientLinkModalOpen, setIsShareClientLinkModalOpen] = useState(false);
  const [impersonatedSalon, setImpersonatedSalon] = useState<AdminSalon | null>(null);
  // Login iniciado pelo CTA "painel": após autenticar, o superadmin segue
  // para /admin e a manicure para o painel operacional.
  const [adminIntentAfterLogin, setAdminIntentAfterLogin] = useState(false);

  // Persistence States - Clean slate for production (services preserved, schedule and clients start fresh)
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    if (!localStorage.getItem('kethelin_clean_v2')) {
      localStorage.removeItem('kethelin_appointments_v1');
      localStorage.removeItem('kethelin_clients_v1');
      localStorage.removeItem('kethelin_transactions_v1');
      localStorage.setItem('kethelin_clean_v2', 'true');
      return [];
    }
    const saved = localStorage.getItem('kethelin_appointments_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('kethelin_clients_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [services, setServices] = useState<ServiceItem[]>(() => {
    const saved = localStorage.getItem('kethelin_services_v2');
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('kethelin_transactions_v2');
    return saved ? JSON.parse(saved) : [];
  });

  // A esmalteca vem da tabela `esmaltes` do salão — nada de cores fixas.
  const [polishes, setPolishes] = useState<PolishItem[]>([]);

  // Modals state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [defaultAppointmentDate, setDefaultAppointmentDate] = useState<string | undefined>(undefined);

  const [isQuickMessagesOpen, setIsQuickMessagesOpen] = useState(false);
  const [quickMessageClient, setQuickMessageClient] = useState<Client | null>(null);
  const [quickMessageAppointment, setQuickMessageAppointment] = useState<Appointment | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Check Supabase connection & initial cloud fetch on mount
  useEffect(() => {
    async function initSupabase() {
      if (isSupabaseConfigured) {
        const isConnected = await checkSupabaseConnection();

        // useSalon's effect already loads the session + salon + sets currentSalonId.
        // Once the salon is known, fetch the data filtered by that salon.
        if (isConnected && salonId) {
          const [remoteApts, remoteClients, remoteServices, remoteTxs, remotePolishes] =
            await Promise.all([
              db.fetchAppointments(),
              db.fetchClients(),
              db.fetchServices(),
              db.fetchTransactions(),
              db.fetchPolishes(),
            ]);

          setAppointments(remoteApts || []);
          setClients(remoteClients || []);
          if (remoteServices && remoteServices.length > 0) setServices(remoteServices);
          setTransactions(remoteTxs || []);
          setPolishes(remotePolishes || []);
        }
      }
    }
    initSupabase();
  }, [isSupabaseConfigured, salonId]);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem('kethelin_appointments_v2', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('kethelin_clients_v2', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('kethelin_services_v2', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('kethelin_transactions_v2', JSON.stringify(transactions));
  }, [transactions]);

  // Read URL for client portal, manicure direct link or /admin (superadmin)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const portal = urlParams.get('p') || urlParams.get('portal');
    const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/admin';
    const salao = (urlParams.get('salao') || urlParams.get('salon') || '').trim();
    setPublicSalonId(salao);

    if (isAdminPath || portal === 'admin') {
      setViewMode('admin');
      return;
    }

    if (portal === 'cliente' || portal === 'agendar' || portal === 'client') {
      setViewMode('client_portal');
    } else if (portal === 'manicure') {
      if (isManicureAuthenticated) {
        setViewMode('manicure_panel');
      } else {
        setIsLoginModalOpen(true);
      }
    }
  }, [isManicureAuthenticated]);

  const changeViewMode = (mode: AppViewMode) => {
    if (mode === 'manicure_panel' && !isManicureAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }
    setViewMode(mode);
    const url = new URL(window.location.href);
    const isAdminPath = url.pathname.replace(/\/+$/, '') === '/admin';

    if (mode === 'admin') {
      url.pathname = '/admin';
      url.searchParams.delete('p');
      url.searchParams.delete('portal');
    } else {
      if (isAdminPath) url.pathname = '/';
      if (mode === 'client_portal') {
        url.searchParams.set('p', 'cliente');
        const brandId = impersonatedSalon?.id || salon?.id || publicSalonId;
        if (brandId) {
          url.searchParams.set('salao', brandId);
          setPublicSalonId(brandId);
        } else {
          url.searchParams.delete('salao');
        }
      } else if (mode === 'manicure_panel') {
        url.searchParams.set('p', 'manicure');
      } else {
        url.searchParams.delete('p');
        url.searchParams.delete('portal');
      }
    }
    window.history.replaceState(null, '', url.toString());
  };

  const handleGoToManicurePanel = () => {
    // O superadmin entra direto no console administrativo; a manicure segue
    // para o painel operacional e nunca é exposta à rota /admin.
    if (isSuperadmin) {
      changeViewMode('admin');
      return;
    }
    if (isManicureAuthenticated) {
      changeViewMode('manicure_panel');
    } else {
      setAdminIntentAfterLogin(true);
      setIsLoginModalOpen(true);
    }
  };

  const handleSuccessLogin = () => {
    setIsLoginModalOpen(false);

    // No /admin, a própria view decide entre AdminView e acesso negado.
    if (viewMode === 'admin') {
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      url.searchParams.delete('p');
      url.searchParams.delete('portal');
      window.history.replaceState(null, '', url.toString());
      showToast('Login realizado. Verificando permissões...');
      return;
    }

    // Quem clicou em "painel" aguarda a role carregar para saber se vai
    // para o console administrativo ou para o painel operacional.
    if (adminIntentAfterLogin) {
      showToast('Login realizado. Verificando permissões...');
      return;
    }

    setViewMode('manicure_panel');
    const url = new URL(window.location.href);
    url.searchParams.set('p', 'manicure');
    window.history.replaceState(null, '', url.toString());
    showToast('Acesso autorizado! Bem-vinda ao painel da manicure.');
  };

  const handleLogout = async () => {
    await handleAuthSignOut();
    setImpersonatedSalon(null);
    setViewMode('landing');
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('p');
    window.history.replaceState(null, '', url.toString());
    showToast('Você saiu do painel da manicure.');
  };

  // Proteção de rota /admin: usuário autenticado sem a role superadmin é
  // enviado ao painel normal com mensagem de acesso negado.
  // isRoleLoading evita negar acesso antes de a role ser lida do banco.
  const isAuthPending = isLoading || isRoleLoading;
  useEffect(() => {
    if (viewMode !== 'admin' || isAuthPending) return;
    if (!isManicureAuthenticated || isSuperadmin) return;

    changeViewMode('manicure_panel');
    showToast('Acesso negado: esta área é exclusiva do superadmin.');
  }, [viewMode, isAuthPending, isManicureAuthenticated, isSuperadmin]);

  // Conclui o login iniciado pelo CTA "painel" assim que a role é conhecida.
  useEffect(() => {
    if (!adminIntentAfterLogin || isAuthPending || !isManicureAuthenticated) return;

    setAdminIntentAfterLogin(false);
    if (isSuperadmin) {
      changeViewMode('admin');
      showToast('Acesso autorizado. Bem-vindo ao painel administrativo.');
    } else {
      changeViewMode('manicure_panel');
      showToast('Acesso autorizado! Bem-vinda ao painel da manicure.');
    }
  }, [adminIntentAfterLogin, isAuthPending, isManicureAuthenticated, isSuperadmin]);

  const handleOpenAdmin = () => {
    if (impersonatedSalon) {
      void handleExitImpersonation();
      return;
    }
    changeViewMode('admin');
  };

  // Impersonation de superadmin: carrega os dados do salão alvo e exibe o
  // painel normal em modo somente leitura. A sessão de autenticação continua
  // sendo a do superadmin — não há troca de usuário no Supabase Auth.
  const handleImpersonate = async (target: AdminSalon): Promise<boolean> => {
    const [remoteApts, remoteClients, remoteServices, remoteTx, remotePolishes] =
      await Promise.all([
        db.fetchAppointments(target.id),
        db.fetchClients(target.id),
        db.fetchServices(target.id),
        db.fetchTransactions(target.id),
        db.fetchPolishes(target.id),
      ]);

    if (!remoteApts || !remoteClients || !remoteServices || !remoteTx) {
      return false;
    }

    setAppointments(remoteApts);
    setClients(remoteClients);
    setServices(remoteServices);
    setTransactions(remoteTx);
    setPolishes(remotePolishes || []);
    setCurrentSalonId(target.id);
    setImpersonatedSalon(target);
    setCurrentTab('agenda');
    setViewMode('manicure_panel');

    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('p', 'manicure');
    window.history.replaceState(null, '', url.toString());
    showToast(`Visualizando ${target.nome} — modo somente leitura.`);
    return true;
  };

  const handleExitImpersonation = async () => {
    setImpersonatedSalon(null);
    setCurrentSalonId(salon?.id ?? null);

    if (salon?.id) {
      const [remoteApts, remoteClients, remoteServices, remoteTx, remotePolishes] =
        await Promise.all([
          db.fetchAppointments(salon.id),
          db.fetchClients(salon.id),
          db.fetchServices(salon.id),
          db.fetchTransactions(salon.id),
          db.fetchPolishes(salon.id),
        ]);
      if (remoteApts) setAppointments(remoteApts);
      if (remoteClients) setClients(remoteClients);
      if (remoteServices) setServices(remoteServices);
      if (remoteTx) setTransactions(remoteTx);
      setPolishes(remotePolishes || []);
    } else {
      setAppointments([]);
      setClients([]);
      setServices([]);
      setTransactions([]);
      setPolishes([]);
    }

    changeViewMode('admin');
    showToast('Você saiu da visualização do salão.');
  };

  const blockIfImpersonating = (): boolean => {
    if (!impersonatedSalon) return false;
    showToast('Modo visualização: alterações estão desativadas.');
    return true;
  };

  // Today's count for navbar badge
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointmentsCount = appointments.filter(
    (a) => a.date === todayStr && a.status !== 'cancelado'
  ).length;

  // Handlers for Appointments
  const handleOpenNewAppointment = (date?: string) => {
    if (blockIfImpersonating()) return;
    setAppointmentToEdit(null);
    setDefaultAppointmentDate(date || todayStr);
    setIsAppointmentModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    if (blockIfImpersonating()) return;
    setAppointmentToEdit(appointment);
    setIsAppointmentModalOpen(true);
  };

  const handleDeleteAppointment = (id: string) => {
    if (blockIfImpersonating()) return;
    if (window.confirm('Tem certeza que deseja remover este agendamento?')) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      db.deleteAppointment(id);
      showToast('Agendamento removido.');
    }
  };

  const handleSaveAppointment = (savedApt: Appointment, newClientData?: Partial<Client>) => {
    if (blockIfImpersonating()) return;
    if (newClientData && newClientData.name) {
      const fullNewClient: Client = {
        id: newClientData.id || 'cli-' + Date.now(),
        salonId: salonId || '',
        name: newClientData.name,
        phone: newClientData.phone || '',
        createdAt: todayStr,
        totalSpent: 0,
        appointmentsCount: 1,
        lastVisit: savedApt.date,
        preferredNailShape: (newClientData.preferredNailShape as any) || 'amendoada',
        cuticleType: 'normal',
      };
      setClients((prev) => {
        const exists = prev.some((c) => c.phone && c.phone === fullNewClient.phone);
        if (exists) return prev;
        return [fullNewClient, ...prev];
      });
      db.saveClient(fullNewClient);
    }

    setAppointments((prev) => {
      const exists = prev.some((a) => a.id === savedApt.id);
      if (exists) {
        return prev.map((a) => (a.id === savedApt.id ? savedApt : a));
      }
      return [savedApt, ...prev];
    });

    const aptToSave: Appointment = {
      ...savedApt,
      salonId: savedApt.salonId || salonId || '',
    };
    db.saveAppointment(aptToSave);

    showToast(
      appointmentToEdit
        ? 'Agendamento atualizado com sucesso!'
        : 'Novo agendamento confirmado na agenda!'
    );
  };

  const handleClientSelfBooking = (newApt: Appointment, clientData: Partial<Client>) => {
    if (blockIfImpersonating()) return;
    handleSaveAppointment(newApt, clientData);
    showToast('Agendamento recebido! Você pode enviar a confirmação pelo WhatsApp.');
  };

  const handleUpdateStatus = (id: string, newStatus: AppointmentStatus, markPaid?: boolean) => {
    if (blockIfImpersonating()) return;
    const apt = appointments.find((a) => a.id === id);
    if (!apt) return;

    const updatedApt = {
      ...apt,
      salonId: apt.salonId || salonId || '',
      status: newStatus,
      paid: markPaid ? true : apt.paid,
    };

    setAppointments((prev) => prev.map((a) => (a.id === id ? updatedApt : a)));
    db.saveAppointment(updatedApt);

    // If marked as finished & paid, auto-register transaction and update client stats
    if (newStatus === 'concluido' && markPaid) {
      const newTx: Transaction = {
        id: 'tx-' + Date.now(),
        salonId: salonId || '',
        date: todayStr,
        time: new Date().toTimeString().substring(0, 5),
        type: 'entrada',
        description: `Atendimento ${apt.clientName} - ${apt.serviceNames.join(', ')}`,
        amount: apt.totalPrice,
        category: 'servico',
        paymentMethod: apt.paymentMethod === 'pendente' ? 'pix' : apt.paymentMethod || 'pix',
        appointmentId: apt.id,
      };

      setTransactions((prev) => [newTx, ...prev]);
      db.saveTransaction(newTx);

      // Update client stats
      setClients((prev) =>
        prev.map((c) => {
          if (c.id === apt.clientId || c.name === apt.clientName) {
            const updatedClient = {
              ...c,
              salonId: c.salonId || salonId || '',
              totalSpent: (c.totalSpent || 0) + apt.totalPrice,
              appointmentsCount: (c.appointmentsCount || 0) + 1,
              lastVisit: todayStr,
            };
            db.saveClient(updatedClient);
            return updatedClient;
          }
          return c;
        })
      );

      showToast(`Atendimento concluído e R$ ${apt.totalPrice.toFixed(2)} lançado no Caixa!`);
    } else {
      showToast(`Status atualizado para: ${newStatus.replace('_', ' ')}`);
    }
  };

  // Quick WhatsApp Message modal opener
  const handleOpenQuickMessages = (client?: Client, appointment?: Appointment) => {
    setQuickMessageClient(client || null);
    setQuickMessageAppointment(appointment || null);
    setIsQuickMessagesOpen(true);
  };

  // Handlers for Clients
  const handleSaveClient = (client: Client) => {
    if (blockIfImpersonating()) return;
    const clientWithSalon: Client = {
      ...client,
      salonId: client.salonId || salonId || '',
    };
    setClients((prev) => {
      const exists = prev.some((c) => c.id === client.id);
      if (exists) {
        return prev.map((c) => (c.id === client.id ? clientWithSalon : c));
      }
      return [clientWithSalon, ...prev];
    });
    db.saveClient(clientWithSalon);
    showToast('Ficha da cliente salva com sucesso!');
  };

  const handleDeleteClient = (id: string) => {
    if (blockIfImpersonating()) return;
    if (window.confirm('Excluir o cadastro desta cliente?')) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      db.deleteClient(id);
      showToast('Cliente removida.');
    }
  };

  const handleNewAppointmentWithClient = (client: Client) => {
    if (blockIfImpersonating()) return;
    setAppointmentToEdit(null);
    setDefaultAppointmentDate(todayStr);
    setIsAppointmentModalOpen(true);
  };

  // Handlers for Services
  const handleSaveService = (service: ServiceItem) => {
    if (blockIfImpersonating()) return;
    const serviceWithSalon: ServiceItem = {
      ...service,
      salonId: service.salonId || salonId || '',
    };
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      if (exists) {
        return prev.map((s) => (s.id === service.id ? serviceWithSalon : s));
      }
      return [serviceWithSalon, ...prev];
    });
    db.saveService(serviceWithSalon);
    showToast('Procedimento salvo na tabela de preços!');
  };

  const handleDeleteService = (id: string) => {
    if (blockIfImpersonating()) return;
    if (window.confirm('Remover este serviço do catálogo?')) {
      setServices((prev) => prev.filter((s) => s.id !== id));
      db.deleteService(id);
      showToast('Serviço removido.');
    }
  };

  const handleToggleActiveService = (id: string) => {
    if (blockIfImpersonating()) return;
    setServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, active: !s.active, salonId: s.salonId || salonId || '' };
          db.saveService(updated);
          return updated;
        }
        return s;
      })
    );
  };

  // Handlers for Finances
  const handleAddTransaction = (tx: Transaction) => {
    if (blockIfImpersonating()) return;
    const txWithSalon: Transaction = {
      ...tx,
      salonId: tx.salonId || salonId || '',
    };
    setTransactions((prev) => [txWithSalon, ...prev]);
    db.saveTransaction(txWithSalon);
    showToast(tx.type === 'entrada' ? 'Receita lançada no Caixa!' : 'Despesa registrada no Caixa!');
  };

  const handleDeleteTransaction = (id: string) => {
    if (blockIfImpersonating()) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    db.deleteTransaction(id);
    showToast('Lançamento removido.');
  };

  // Handlers for Polishes (tabela `esmaltes`)
  const handleAddPolish = async (draft: PolishDraft): Promise<boolean> => {
    if (blockIfImpersonating()) return false;
    if (!isSupabaseConfigured) {
      showToast('Supabase não está configurado: não foi possível salvar o esmalte.');
      return false;
    }

    const newPolish: PolishItem = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pol-${Date.now()}`,
      salonId: salonId || undefined,
      name: draft.name,
      brand: draft.brand,
      colorHex: draft.colorHex,
    };

    const saved = await db.savePolish(newPolish);
    if (!saved) {
      showToast('Erro ao salvar o esmalte. Tente novamente.');
      return false;
    }

    setPolishes((prev) => [newPolish, ...prev]);
    showToast('Esmalte cadastrado na esmalteca!');
    return true;
  };

  const handleDeletePolish = async (id: string): Promise<boolean> => {
    if (blockIfImpersonating()) return false;

    const removed = await db.deletePolish(id);
    if (!removed) {
      showToast('Erro ao excluir o esmalte. Tente novamente.');
      return false;
    }

    setPolishes((prev) => prev.filter((p) => p.id !== id));
    showToast('Esmalte removido da esmalteca.');
    return true;
  };

  // Reset to initial sample data helper
  const handleResetData = () => {
    if (blockIfImpersonating()) return;
    if (
      window.confirm(
        'Deseja restaurar os dados de demonstração do Lume Nails (clientes, agenda, financeiro e esmalteca)?'
      )
    ) {
      setAppointments(INITIAL_APPOINTMENTS);
      setClients(INITIAL_CLIENTS);
      setServices(INITIAL_SERVICES);
      setTransactions(INITIAL_TRANSACTIONS);
      setPolishes([]);
      localStorage.clear();
      showToast('Dados restaurados com sucesso!');
    }
  };

  // While Supabase auth session is loading, show a neutral loading state
  if (isLoading && !isManicureAuthenticated && viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-[#E3DFFD] border-t-[#8B5CF6] animate-spin mx-auto mb-4" />
          <p className="text-xs text-stone-500">Conectando ao estúdio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-800 flex flex-col font-sans">
      {/* 0. ADMIN VIEW (Superadmin only) */}
      {viewMode === 'admin' &&
        (isSuperadmin ? (
          <AdminView
            onBackToPanel={() => changeViewMode('manicure_panel')}
            onImpersonate={handleImpersonate}
          />
        ) : isAuthPending ? (
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <p className="text-sm font-medium text-zinc-300">
              Validando credenciais administrativas...
            </p>
          </div>
        ) : !isManicureAuthenticated ? (
          <AdminLoginView
            onSignIn={signIn}
            onSuccessLogin={handleSuccessLogin}
            onBackToSite={() => changeViewMode('landing')}
          />
        ) : (
          <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl shadow-black/40">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/25">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Acesso negado</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Sua conta não possui a role superadmin. Redirecionando para o painel normal...
              </p>
            </div>
          </div>
        ))}

      {/* 1. LANDING PAGE VIEW */}
      {viewMode === 'landing' && (
        <LandingPageView
          services={services}
          onGoToBooking={(serviceId) => {
            setSelectedServiceForBooking(serviceId);
            changeViewMode('client_portal');
          }}
          onGoToClientPortal={() => changeViewMode('client_portal')}
          onGoToManicurePanel={handleGoToManicurePanel}
          onShareClientLink={() => setIsShareClientLinkModalOpen(true)}
          isManicureLoggedIn={isManicureAuthenticated}
        />
      )}

      {/* 2. CLIENT PORTAL VIEW (Self-booking, My Appointments, Loyalty Card, Care Tips) */}
      {viewMode === 'client_portal' && (
        <ClientPortalView
          services={services}
          appointments={appointments}
          clients={clients}
          salon={
            impersonatedSalon
              ? { id: impersonatedSalon.id, name: impersonatedSalon.nome, phone: impersonatedSalon.phone }
              : salon
                ? {
                    id: salon.id,
                    name: salon.name,
                    logoUrl: salon.logoUrl,
                    phone: salon.phone,
                    address: salon.address,
                  }
                : null
          }
          salonId={impersonatedSalon?.id || salon?.id || publicSalonId || undefined}
          initialSelectedServiceId={selectedServiceForBooking}
          onBookAppointment={handleClientSelfBooking}
          onBackToHome={() => changeViewMode('landing')}
          onGoToManicurePanel={handleGoToManicurePanel}
          onShareClientLink={() => setIsShareClientLinkModalOpen(true)}
        />
      )}

      {/* 3. MANICURE PANEL VIEW (Protected with Login) */}
      {viewMode === 'manicure_panel' && !isManicureAuthenticated && (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#E3DFFD]/80 text-center shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F3FF] text-[#8B5CF6] flex items-center justify-center mx-auto mb-4 border border-[#C4B5FD]/60 shadow-xs">
              <Lock className="w-8 h-8" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#7C3AED] bg-[#F5F3FF] px-2.5 py-0.5 rounded-full border border-[#E3DFFD]">
              Acesso Protegido
            </span>
            <h2 className="text-2xl font-bold font-['Playfair_Display',serif] text-stone-900 mt-2 mb-2">
              Painel Lume
            </h2>
            <p className="text-xs text-stone-600 mb-6 leading-relaxed">
              Esta área contém os dados da agenda, controle de clientes e o fluxo de caixa do estúdio <strong>Lume Nails</strong>. Faça o login de profissional para prosseguir.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white font-bold text-sm shadow-md shadow-[#8b5cf6]/30 hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Fazer Login do Painel</span>
              </button>
              <button
                onClick={() => changeViewMode('landing')}
                className="w-full py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Voltar para a Página Inicial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2.1 SUSPENDED SALON (billing block) */}
      {viewMode === 'manicure_panel' &&
        isManicureAuthenticated &&
        salon?.status === 'inativo' &&
        !isSuperadmin && (
          <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                <Ban className="h-8 w-8" />
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800">
                Assinatura suspensa
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
                Painel temporariamente bloqueado
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                O acesso do salão <strong>{salon.name}</strong> está suspenso. Regularize a
                assinatura com o suporte para voltar a usar agenda, clientes e financeiro.
              </p>
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => void handleLogout()}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 py-3 text-sm font-semibold text-white shadow-md shadow-purple-600/20 transition-all hover:from-purple-700 hover:to-purple-800"
                >
                  Sair da conta
                </button>
                <button
                  onClick={() => changeViewMode('landing')}
                  className="w-full rounded-xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  Voltar ao site
                </button>
              </div>
            </div>
          </div>
        )}

      {viewMode === 'manicure_panel' &&
        isManicureAuthenticated &&
        !(salon?.status === 'inativo' && !isSuperadmin) && (
        <>
          {/* Top Navigation */}
          <Navbar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            onNewAppointment={() => handleOpenNewAppointment()}
            todayAppointmentsCount={todayAppointmentsCount}
            onSwitchToPublic={() => changeViewMode('landing')}
            onShareClientLink={() => setIsShareClientLinkModalOpen(true)}
            onLogout={handleLogout}
            salonName={impersonatedSalon?.nome || salon?.name}
            salonLogoUrl={impersonatedSalon ? undefined : salon?.logoUrl}
            isSuperadmin={isSuperadmin}
            onOpenAdmin={handleOpenAdmin}
          />

          {impersonatedSalon && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Eye className="h-3.5 w-3.5" />
                  Visualizando <strong>{impersonatedSalon.nome}</strong> — modo somente leitura.
                </span>
                <button
                  onClick={() => void handleExitImpersonation()}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-bold text-amber-900 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  Sair da visualização
                </button>
              </div>
            </div>
          )}

          {/* Quick Notice Banner inside Manicure Panel */}
          <div className="bg-white border-b border-[#E3DFFD]/60 py-2 px-4 sm:px-6 lg:px-8 text-xs text-stone-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                <strong>
                  {impersonatedSalon ? 'Visualizando' : 'Sessão Ativa'} (
                  {impersonatedSalon?.nome || salon?.name || 'Lume Pro'}):
                </strong>{' '}
                Gerenciamento protegido de agenda, clientes e caixa.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsShareClientLinkModalOpen(true)}
                className="text-[#7C3AED] hover:text-[#6D28D9] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar Link da Cliente</span>
              </button>
              <span className="text-stone-300">|</span>
              <button
                onClick={() => changeViewMode('client_portal')}
                className="text-stone-600 hover:text-stone-900 font-semibold underline cursor-pointer"
              >
                Ver como Cliente →
              </button>
            </div>
          </div>

          {/* Main Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
            {currentTab === 'agenda' && (
              <AppointmentsView
                appointments={appointments}
                clients={clients}
                services={services}
                onNewAppointment={handleOpenNewAppointment}
                onEditAppointment={handleEditAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                onUpdateStatus={handleUpdateStatus}
                onOpenQuickMessages={handleOpenQuickMessages}
              />
            )}

            {currentTab === 'clientes' && (
              <ClientsView
                clients={clients}
                appointments={appointments}
                onSaveClient={handleSaveClient}
                onDeleteClient={handleDeleteClient}
                onNewAppointmentWithClient={handleNewAppointmentWithClient}
              />
            )}

            {currentTab === 'servicos' && (
              <ServicesView
                services={services}
                onSaveService={handleSaveService}
                onDeleteService={handleDeleteService}
                onToggleActive={handleToggleActiveService}
              />
            )}

            {currentTab === 'financeiro' && (
              <FinancialView
                transactions={transactions}
                onAddTransaction={handleAddTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {currentTab === 'estudio' && (
              <PolishStudioView
                polishes={polishes}
                onAddPolish={handleAddPolish}
                onDeletePolish={handleDeletePolish}
              />
            )}

            {currentTab === 'google' && (
              <GoogleBusinessAdminView />
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-stone-200/80 bg-white/70 py-4 mt-12 mb-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
              <p>
                <strong>Lume Nails</strong> • Sistema de Gestão para Estúdios de Beleza
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleResetData}
                  className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar dados demo</span>
                </button>
                <span>v2.0</span>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        onSave={handleSaveAppointment}
        appointmentToEdit={appointmentToEdit}
        clients={clients}
        services={services}
        defaultDate={defaultAppointmentDate}
      />

      {/* Quick Messages WhatsApp Modal */}
      <QuickMessagesModal
        isOpen={isQuickMessagesOpen}
        onClose={() => setIsQuickMessagesOpen(false)}
        clients={clients}
        appointments={appointments}
        preselectedClient={quickMessageClient}
        preselectedAppointment={quickMessageAppointment}
      />

      {/* Manicure Login Modal */}
      <ManicureLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setAdminIntentAfterLogin(false);
        }}
        onSuccessLogin={handleSuccessLogin}
        onSignIn={signIn}
      />

      {/* Share Client Link Modal */}
      <ShareClientLinkModal
        isOpen={isShareClientLinkModalOpen}
        onClose={() => setIsShareClientLinkModalOpen(false)}
        salonId={impersonatedSalon?.id || salon?.id || publicSalonId || undefined}
        studioName={impersonatedSalon?.nome || salon?.name}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

/**
 * App é o ponto de entrada. Ele envolve toda a aplicação no
 * <SalonContextProvider> para que o hook useSalon() possa ser consumido
 * com segurança por AppContent e seus filhos.
 */
export default function App() {
  return (
    <SalonContextProvider>
      <AppContent />
    </SalonContextProvider>
  );
}
