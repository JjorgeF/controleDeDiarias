import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  List, 
  Calendar as CalendarIcon, 
  Search, 
  LogOut, 
  LogIn,
  Sun, 
  Moon,
  FileDown,
  Smartphone,
  BarChart3,
  Settings,
  Send
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ViewMode, AppNotification, CustomNotificationDoc } from '../types';
import { cn } from '../lib/utils';
import Logo from './Logo';
import NotificationCenter from './NotificationCenter';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onAddEmployee?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  onExportExcel: () => void;
  hideControls?: boolean;
  isAdmin?: boolean;
  notifications?: AppNotification[];
  unreadNotificationsCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onDismissNotification?: (id: string) => void;
  onNavigateToCalendar?: () => void;
  onOpenSendNotificationModal?: () => void;
  customNotificationsDocs?: CustomNotificationDoc[];
  onDeleteCustomNotification?: (id: string) => Promise<void>;
}

export default function Header({ 
  viewMode, 
  setViewMode, 
  searchQuery,
  setSearchQuery,
  isDarkMode,
  toggleTheme,
  onExportExcel,
  hideControls = false,
  isAdmin = false,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDismissNotification,
  onNavigateToCalendar,
  onOpenSendNotificationModal,
  customNotificationsDocs = [],
  onDeleteCustomNotification
}: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const isCancelError = error && (
        error.code === 'auth/cancelled-popup-request' || 
        error.code === 'auth/popup-closed-by-user' ||
        error.message?.includes('cancelled-popup-request') ||
        error.message?.includes('popup-closed-by-user')
      );
      if (isCancelError) {
        console.log("Login cancelado pelo usuário ou janela fechada.");
      } else {
        console.error("Login error:", error);
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-border bg-brand-bg/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-2 md:px-4 h-14 md:h-16 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-8">
          <div className="flex items-center gap-2">
            <Logo size={36} className="w-8 h-8 md:w-10 md:h-10 shrink-0" animate={true} />
            <h1 className="text-lg md:text-2xl font-bold text-brand-primary whitespace-nowrap font-playful tracking-wide">
              Liga Positiva{(import.meta.env.VITE_ENABLE_SIMULATION?.toLowerCase() === 'true' || import.meta.env.DEV) ? ' Dev2' : ''}
            </h1>
          </div>
          
          {!hideControls && (
            <div className="hidden md:flex items-center bg-brand-card rounded-md border border-brand-border px-2 py-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'grid' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
                title="Visualização em Grade"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'list' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
                title="Visualização em Lista"
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'calendar' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
                title="Calendário de Escalas"
              >
                <CalendarIcon size={18} />
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setViewMode('dashboard')}
                  className={cn(
                    "p-1.5 rounded transition-colors border-l border-brand-border/40 pl-2 ml-1",
                    viewMode === 'dashboard' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                  )}
                  title="Dashboard de Estatísticas"
                >
                  <BarChart3 size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        {!hideControls && (
          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-card border border-brand-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 md:gap-2">
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadNotificationsCount}
            onMarkRead={(id) => onMarkNotificationRead?.(id)}
            onMarkAllRead={() => onMarkAllNotificationsRead?.()}
            onDismiss={(id) => onDismissNotification?.(id)}
            onNavigateToCalendar={onNavigateToCalendar}
            onOpenSendModal={onOpenSendNotificationModal}
            isAdmin={isAdmin}
            customNotificationsDocs={customNotificationsDocs}
            onDeleteCustomNotification={onDeleteCustomNotification}
          />

          <button 
            onClick={toggleTheme}
            className="p-2 text-gray-400 hover:text-brand-primary transition-colors rounded-lg hover:bg-brand-card"
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Settings Menu Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-brand-card focus:outline-none flex items-center justify-center"
              title="Configurações e Conta"
              aria-label="Configurações e Conta"
            >
              <Settings size={20} className={cn("transition-transform duration-300", isSettingsOpen && "rotate-45 text-brand-primary")} />
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-brand-card border border-brand-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2 space-y-1">
                {user ? (
                  <div className="p-2.5 mb-1 bg-brand-bg/50 border border-brand-border/60 rounded-lg flex items-center gap-2.5">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      alt={user.displayName || ""} 
                      className="w-9 h-9 rounded-full border border-brand-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">
                        {user.displayName || 'Usuário'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {user.email || ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleLogin();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors text-left"
                  >
                    <LogIn size={16} />
                    <span>Entrar com Google</span>
                  </button>
                )}

                {isAdmin && onOpenSendNotificationModal && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenSendNotificationModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-brand-primary hover:text-white hover:bg-brand-primary/10 rounded-lg transition-colors text-left"
                  >
                    <Send size={16} className="text-brand-primary" />
                    <span>Enviar Notificação</span>
                  </button>
                )}

                {!hideControls && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onExportExcel();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-colors text-left"
                  >
                    <FileDown size={16} className="text-emerald-500" />
                    <span>Exportar Dados (Excel)</span>
                  </button>
                )}

                {!isStandalone && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      window.dispatchEvent(new CustomEvent('show-pwa-prompt'));
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-brand-primary/10 hover:text-brand-primary rounded-lg transition-colors text-left"
                  >
                    <Smartphone size={16} className="text-brand-primary" />
                    <span>Instalar App (PWA)</span>
                  </button>
                )}

                {user && (
                  <div className="border-t border-brand-border/60 pt-1 mt-1">
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                      <LogOut size={16} />
                      <span>Sair do App</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Search & View Toggle */}
      {!hideControls && (
        <div className="sm:hidden px-4 pb-3 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-card border border-brand-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          <div className="flex items-center bg-brand-card rounded-md border border-brand-border px-2 py-1 w-fit">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'grid' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'list' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'calendar' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <CalendarIcon size={18} />
            </button>
            {isAdmin && (
              <button 
                onClick={() => setViewMode('dashboard')}
                className={cn(
                  "p-1.5 rounded transition-colors border-l border-brand-border/40 pl-2 ml-1",
                  viewMode === 'dashboard' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
                title="Dashboard"
              >
                <BarChart3 size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
