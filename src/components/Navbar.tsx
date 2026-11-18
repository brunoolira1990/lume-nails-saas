import React from 'react';
import {
  Calendar,
  Users,
  Sparkles,
  DollarSign,
  Palette,
  Plus,
  Phone,
  Instagram,
  MapPin,
  Globe,
  Share2,
  LogOut,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export type TabType = 'agenda' | 'clientes' | 'servicos' | 'financeiro' | 'estudio' | 'google';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onNewAppointment: () => void;
  todayAppointmentsCount: number;
  onSwitchToPublic: () => void;
  onShareClientLink: () => void;
  onLogout: () => void;
  /** Nome do salão logado (fallback: Lume Nails). */
  salonName?: string;
  /** Logo do salão logado (fallback: logo padrão do Lume Nails). */
  salonLogoUrl?: string;
  isSuperadmin?: boolean;
  onOpenAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onNewAppointment,
  todayAppointmentsCount,
  onSwitchToPublic,
  onShareClientLink,
  onLogout,
  salonName,
  salonLogoUrl,
  isSuperadmin = false,
  onOpenAdmin,
}) => {
  const studioName = salonName?.trim() || 'Lume Nails';

  const tabs = [
    {
      id: 'agenda' as TabType,
      label: 'Agenda',
      icon: Calendar,
      badge: todayAppointmentsCount > 0 ? todayAppointmentsCount : undefined,
    },
    { id: 'clientes' as TabType, label: 'Clientes & Ficha', icon: Users },
    { id: 'servicos' as TabType, label: 'Serviços & Preços', icon: Sparkles },
    { id: 'financeiro' as TabType, label: 'Financeiro', icon: DollarSign },
    { id: 'estudio' as TabType, label: 'Esmalteca', icon: Palette },
    { id: 'google' as TabType, label: 'Google Meu Negócio', icon: Store },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E3DFFD]/60 shadow-xs">
      {/* Top micro contact banner */}
      <div className="bg-[#F5F3FF] border-b border-[#E3DFFD]/60 py-1 px-4 sm:px-6 lg:px-8 text-[11px] text-[#6B21A8] hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Seu estúdio, sua gestão</span>
            </span>
            <span className="text-stone-300">•</span>
            <a
              href="https://wa.me/5511952517402"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-stone-900 transition-colors font-medium"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Fale conosco</span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/lumenails"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#8B5CF6] font-semibold transition-colors"
            >
              <Instagram className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>@lumenails</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo / Studio Name */}
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="md" showText={false} src={salonLogoUrl} alt={studioName} />
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="text-sm font-bold text-stone-900 truncate max-w-[200px]">
                {studioName}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#7C3AED]">
                Painel da Manicure
              </span>
            </div>
          </div>

          {/* Navigation Tabs - Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl border border-stone-200/70">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#8B5CF6] shadow-xs shadow-stone-200 font-bold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#8B5CF6]' : 'text-stone-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="bg-[#8B5CF6] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onShareClientLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#7C3AED] bg-[#F5F3FF]/80 border border-[#E3DFFD]/80 hover:bg-[#EEEBFF]/80 hover:border-[#C4B5FD]/80 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              title="Copiar e compartilhar o link do Portal da Cliente"
            >
              <Share2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="hidden sm:inline">Link da Cliente</span>
            </button>

            <button
              onClick={onSwitchToPublic}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-stone-700 bg-white border border-stone-200 hover:border-[#8B5CF6] hover:text-[#8B5CF6] text-xs font-semibold transition-colors cursor-pointer"
              title="Visualizar a Landing Page pública"
            >
              <Globe className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="hidden lg:inline">Ver Site</span>
            </button>

            <button
              id="btn-novo-agendamento-nav"
              onClick={onNewAppointment}
              className="inline-flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs sm:text-sm font-semibold shadow-sm shadow-[#8b5cf6]/30 hover:shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Novo</span>
            </button>

            {isSuperadmin && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#7C3AED] bg-[#F5F3FF] border border-[#C4B5FD]/70 hover:bg-[#EEEBFF] text-xs font-bold transition-colors cursor-pointer"
                title="Abrir o Painel Superadmin"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span className="hidden lg:inline">Superadmin</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-stone-500 hover:text-[#8B5CF6] hover:bg-[#F5F3FF] border border-stone-200 transition-colors cursor-pointer"
              title="Sair / Bloquear Painel da Manicure"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2.5 gap-1.5 scrollbar-none border-t border-stone-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#F5F3FF] text-[#8B5CF6] font-semibold border border-[#E3DFFD]/80'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#8B5CF6]' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="bg-[#8B5CF6] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
