import React from 'react';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  PartyPopper, 
  Table, 
  Users, 
  DollarSign, 
  BarChart3,
  UserRound
} from 'lucide-react';
import { ViewMode } from '../types';
import { cn } from '../lib/utils';

interface AdminDockItem {
  id: ViewMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

interface EmployeeDockItem {
  id: 'schedule' | 'master_schedule' | 'profile' | 'earnings';
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

interface NavigationDockProps {
  isAdmin: boolean;
  adminViewMode?: ViewMode;
  onAdminViewModeChange?: (mode: ViewMode) => void;
  employeeActiveTab?: 'schedule' | 'master_schedule' | 'profile' | 'earnings';
  onEmployeeTabChange?: (tab: 'schedule' | 'master_schedule' | 'profile' | 'earnings') => void;
  partiesCount?: number;
}

export default function NavigationDock({
  isAdmin,
  adminViewMode = 'calendar',
  onAdminViewModeChange,
  employeeActiveTab = 'schedule',
  onEmployeeTabChange,
  partiesCount = 0
}: NavigationDockProps) {
  const adminItems: AdminDockItem[] = [
    {
      id: 'calendar',
      label: 'Calendário',
      shortLabel: 'Calendário',
      icon: CalendarIcon,
    },
    {
      id: 'parties',
      label: 'Festas & Eventos',
      shortLabel: 'Festas',
      icon: PartyPopper,
      badge: partiesCount > 0 ? partiesCount : undefined,
      badgeColor: 'bg-brand-party text-white'
    },
    {
      id: 'master_schedule',
      label: 'Escala Geral',
      shortLabel: 'Escala',
      icon: Table,
    },
    {
      id: 'grid',
      label: 'Recreadores',
      shortLabel: 'Equipe',
      icon: Users,
    },
    {
      id: 'payments',
      label: 'Pagamentos',
      shortLabel: 'Financeiro',
      icon: DollarSign,
    },
    {
      id: 'dashboard',
      label: 'Indicadores & KPIs',
      shortLabel: 'Métricas',
      icon: BarChart3,
    },
  ];

  const employeeItems: EmployeeDockItem[] = [
    {
      id: 'schedule',
      label: 'Meu Calendário',
      shortLabel: 'Calendário',
      icon: CalendarIcon,
    },
    {
      id: 'master_schedule',
      label: 'Escala Geral',
      shortLabel: 'Escala',
      icon: Table,
    },
    {
      id: 'profile',
      label: 'Meu Perfil',
      shortLabel: 'Perfil',
      icon: UserRound,
    },
    {
      id: 'earnings',
      label: 'Meus Ganhos',
      shortLabel: 'Ganhos',
      icon: DollarSign,
    },
  ];

  if (isAdmin) {
    return (
      <div 
        className="fixed bottom-0 left-0 w-full z-40 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]"
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40 }}
      >
        <div className="w-full px-2 pb-2 pt-2 md:px-0 md:pb-6 md:pt-0 pointer-events-auto flex justify-center">
          <nav 
            aria-label="Menu principal de navegação do administrador"
            className="w-full max-w-[600px] md:max-w-none md:w-max flex items-center justify-between md:justify-center gap-0.5 md:gap-1.5 rounded-2xl md:rounded-3xl bg-slate-900/95 dark:bg-slate-950/95 px-1 py-1.5 md:p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl border border-slate-700/80 dark:border-slate-800/90"
          >
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isSelected = 
                item.id === adminViewMode || 
                (item.id === 'grid' && adminViewMode === 'list') ||
                (item.id === 'dashboard' && adminViewMode === 'kpis');

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAdminViewModeChange?.(item.id)}
                  className={cn(
                    "relative flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-0.5 md:px-3.5 py-1.5 md:py-2 md:rounded-2xl transition-all duration-200 group text-center flex-1 md:flex-initial min-w-0 md:min-w-fit outline-none rounded-xl",
                    isSelected
                      ? "text-slate-950 font-black shadow-md bg-brand-primary"
                      : "text-slate-300 hover:text-white hover:bg-white/5 active:scale-95"
                  )}
                  title={item.label}
                >
                  <div className="relative z-10 flex items-center justify-center">
                    <Icon size={18} className={cn("transition-transform duration-200 group-hover:scale-110", isSelected ? "text-slate-950" : "text-brand-primary/90")} />
                    {item.badge !== undefined && (
                       <span className={cn(
                        "absolute -top-1.5 -right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-slate-900 shadow-sm leading-none",
                        item.badgeColor || "bg-brand-party text-white"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <span className={cn(
                    "relative z-10 text-[9px] md:text-xs tracking-tight transition-colors whitespace-nowrap leading-tight truncate md:overflow-visible mt-0.5 md:mt-0",
                    isSelected ? "text-slate-950 font-extrabold" : "text-slate-300 group-hover:text-white"
                  )}>
                    <span className="block md:hidden">{item.shortLabel}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  // Employee Dock
  return (
    <div 
      className="fixed bottom-0 left-0 w-full z-40 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]"
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40 }}
    >
      <div className="w-full px-2 pb-2 pt-2 md:px-0 md:pb-6 md:pt-0 pointer-events-auto flex justify-center">
        <nav 
          aria-label="Menu de navegação do funcionário"
          className="w-full max-w-[400px] md:max-w-none md:w-max flex items-center justify-between md:justify-center gap-0.5 md:gap-1.5 rounded-2xl md:rounded-3xl bg-slate-900/95 dark:bg-slate-950/95 px-1 py-1.5 md:p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl border border-slate-700/80 dark:border-slate-800/90"
        >
          {employeeItems.map((item) => {
            const Icon = item.icon;
            const isSelected = item.id === employeeActiveTab;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onEmployeeTabChange?.(item.id)}
                className={cn(
                  "relative flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-0.5 md:px-4 py-1.5 md:py-2 md:rounded-2xl transition-all duration-200 group text-center flex-1 md:flex-initial min-w-0 md:min-w-fit outline-none rounded-xl",
                  isSelected
                    ? "text-slate-950 font-black shadow-md bg-brand-primary"
                    : "text-slate-300 hover:text-white hover:bg-white/5 active:scale-95"
                )}
                title={item.label}
              >
                <div className="relative z-10 flex items-center justify-center">
                  <Icon size={18} className={cn("transition-transform duration-200 group-hover:scale-110", isSelected ? "text-slate-950" : "text-brand-primary/90")} />
                </div>

                <span className={cn(
                  "relative z-10 text-[10px] md:text-xs tracking-tight transition-colors whitespace-nowrap leading-tight truncate md:overflow-visible mt-0.5 md:mt-0",
                  isSelected ? "text-slate-950 font-extrabold" : "text-slate-300 group-hover:text-white"
                )}>
                  <span className="block md:hidden">{item.shortLabel}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
