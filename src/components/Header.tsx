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
  DollarSign,
  Settings,
  Send,
  Table,
  Activity,
  Sliders
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
  onOpenPushDiagnostics?: () => void;
  onOpenAdvancedSettingsModal?: () => void;
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
  onDeleteCustomNotification,
  onOpenPushDiagnostics,
  onOpenAdvancedSettingsModal
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3">
          <Logo size={36} className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" animate={true} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-brand-primary whitespace-nowrap font-playful tracking-wide flex items-center gap-1.5">
              <span>Liga Positiva</span>
              {(import.meta.env.VITE_ENABLE_SIMULATION?.toLowerCase() === 'true' || import.meta.env.DEV) && (
                <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.2 rounded-md font-sans">Dev</span>
              )}
            </h1>
          </div>
        </div>

        {!hideControls && (viewMode === 'grid' || viewMode === 'list') && (
          <div className="flex-1 max-w-md hidden sm:flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar recreador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-card border border-brand-border rounded-xl py-1.5 pl-9 pr-3 text-xs sm:text-sm text-brand-text focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
            <div className="flex items-center bg-brand-card rounded-xl border border-brand-border p-0.5">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === 'grid' ? "bg-brand-bg text-brand-primary shadow-sm" : "text-gray-400 hover:text-white"
                )}
                title="Visualização em Grade"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === 'list' ? "bg-brand-bg text-brand-primary shadow-sm" : "text-gray-400 hover:text-white"
                )}
                title="Visualização em Lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
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
            onOpenPushDiagnostics={onOpenPushDiagnostics}
            userEmail={user?.email || undefined}
            userName={user?.displayName || undefined}
          />

          <button 
            onClick={toggleTheme}
            className="p-2 text-gray-400 hover:text-brand-primary transition-colors rounded-xl hover:bg-brand-card"
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Settings Menu Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-brand-card focus:outline-none flex items-center justify-center"
              title="Configurações e Conta"
              aria-label="Configurações e Conta"
            >
              <Settings size={18} className={cn("transition-transform duration-300", isSettingsOpen && "rotate-45 text-brand-primary")} />
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

                {onOpenPushDiagnostics && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenPushDiagnostics();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-brand-party hover:text-brand-party hover:bg-brand-party/10 rounded-lg transition-colors text-left"
                  >
                    <Activity size={16} className="text-brand-party" />
                    <span>Diagnóstico de Notificações</span>
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

                {isAdmin && onOpenAdvancedSettingsModal && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenAdvancedSettingsModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cyan-300 hover:text-white hover:bg-cyan-500/10 rounded-lg transition-colors text-left"
                  >
                    <Sliders size={16} className="text-cyan-400" />
                    <span>Configurações Avançadas</span>
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
      
      {/* Mobile Search Bar for Grid / List View */}
      {!hideControls && (viewMode === 'grid' || viewMode === 'list') && (
        <div className="sm:hidden px-3 pb-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar recreador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-card border border-brand-border rounded-xl py-1.5 pl-9 pr-3 text-xs text-brand-text focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          <div className="flex items-center bg-brand-card rounded-xl border border-brand-border p-0.5">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'grid' ? "bg-brand-bg text-brand-primary shadow-sm" : "text-gray-400 hover:text-white"
              )}
              title="Visualização em Grade"
            >
              <LayoutGrid size={15} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'list' ? "bg-brand-bg text-brand-primary shadow-sm" : "text-gray-400 hover:text-white"
              )}
              title="Visualização em Lista"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
