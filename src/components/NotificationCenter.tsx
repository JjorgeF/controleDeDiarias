import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  Check, 
  BellRing, 
  Info,
  ExternalLink,
  Plus,
  Sparkles,
  Send,
  History,
  Zap,
  Activity,
  Filter,
  ChevronDown
} from 'lucide-react';
import { AppNotification, NotificationType, CustomNotificationDoc } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { registerPushSubscription } from '../lib/pushNotifications';

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onNavigateToCalendar?: () => void;
  onOpenSendModal?: () => void;
  isAdmin: boolean;
  customNotificationsDocs?: CustomNotificationDoc[];
  onDeleteCustomNotification?: (id: string) => Promise<void>;
  onOpenPushDiagnostics?: () => void;
  userEmail?: string;
  userName?: string;
}

export default function NotificationCenter({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onNavigateToCalendar,
  onOpenSendModal,
  isAdmin,
  customNotificationsDocs = [],
  onDeleteCustomNotification,
  onOpenPushDiagnostics,
  userEmail,
  userName
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'cancellation' | 'deadline' | 'sent_history'>('all');
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  const [notificationLimit, setNotificationLimit] = useState(15);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    if (isOpen || isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isFilterOpen]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setNotificationLimit(prev => prev + 15);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [isOpen, filter]);

  // Request browser & PWA background notification permission
  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não suporta notificações de sistema.');
      return;
    }

    try {
      const result = await registerPushSubscription(userEmail, userName);
      if (typeof Notification !== 'undefined') {
        setBrowserPermission(Notification.permission);
      }
      if (result.success) {
        console.log('Push subscription status:', result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificações:', error);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'cancellation') return n.type === 'cancellation';
    if (filter === 'deadline') return n.type === 'deadline_warning' || n.type === 'deadline_expired';
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'cancellation':
        return <AlertTriangle className="text-red-500 shrink-0" size={18} />;
      case 'extraordinary_avail':
        return <Zap className="text-amber-400 fill-amber-400 shrink-0 animate-pulse" size={18} />;
      case 'deadline_warning':
        return <Clock className="text-yellow-500 shrink-0" size={18} />;
      case 'deadline_expired':
        return <Clock className="text-red-400 shrink-0" size={18} />;
      case 'custom':
        return <Sparkles className="text-brand-primary shrink-0 animate-pulse" size={18} />;
      default:
        return <Info className="text-blue-400 shrink-0" size={18} />;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return format(parsed, "dd/MM 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-brand-muted hover:text-brand-primary transition-colors rounded-lg hover:bg-brand-card focus:outline-none"
        title="Central de Notificações"
        aria-label="Central de Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-red-500 rounded-full border-2 border-brand-card shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 w-auto sm:w-96 max-h-[80vh] sm:max-h-[85vh] bg-brand-card border border-brand-border rounded-2xl sm:rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col text-brand-text animate-in fade-in slide-in-from-top-2">
          {/* Popover Header */}
          <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-bg/50">
            <div className="flex items-center gap-2">
              <BellRing className="text-brand-primary" size={18} />
              <h3 className="font-bold text-brand-text text-sm">Notificações</h3>
            </div>
            
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-primary/10 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={14} />
                  <span className="hidden sm:inline">Lidas</span>
                </button>
              )}
              
              <div className="relative group">
                <button
                  className="p-1 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-bg transition-colors flex items-center justify-center"
                  title="Mais ações"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                <div className="absolute right-0 top-full mt-1 w-40 bg-brand-card border border-brand-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col overflow-hidden">
                  {onOpenPushDiagnostics && (
                    <button
                      onClick={() => {
                        onOpenPushDiagnostics();
                        setIsOpen(false);
                      }}
                      className="text-left px-3 py-2 text-xs text-purple-300 hover:bg-purple-500/10 flex items-center gap-2 transition-colors"
                    >
                      <Activity size={14} />
                      Diagnóstico
                    </button>
                  )}
                  {isAdmin && onOpenSendModal && (
                    <button
                      onClick={() => {
                        onOpenSendModal();
                        setIsOpen(false);
                      }}
                      className="text-left px-3 py-2 text-xs text-brand-primary hover:bg-brand-primary/10 flex items-center gap-2 transition-colors border-t border-brand-border/50"
                    >
                      <Send size={14} />
                      Nova Notificação
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-bg transition-colors ml-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Browser Push Permission Banner */}
          {browserPermission !== 'granted' && (
            <div className="p-3 bg-brand-primary/10 border-b border-brand-primary/20 flex items-center justify-between gap-2 text-xs">
              <span className="text-brand-text font-medium">
                Deseja receber alertas do sistema no dispositivo?
              </span>
              <button
                onClick={handleEnableBrowserNotifications}
                className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold px-2.5 py-1 rounded transition-colors text-[11px] shrink-0"
              >
                Ativar
              </button>
            </div>
          )}

          {/* Filter Tabs / Selector */}
          <div className="flex items-center justify-between border-b border-brand-border/60 bg-brand-bg/40 px-3 py-2">
            <div className="relative group" ref={filterDropdownRef}>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-brand-text bg-brand-card border border-brand-border px-3 py-1.5 rounded-lg shadow-sm hover:bg-brand-bg transition-colors"
              >
                <Filter size={14} className="text-brand-primary" />
                <span>
                  {filter === 'all' && `Todas (${notifications.length})`}
                  {filter === 'unread' && `Não lidas (${unreadCount})`}
                  {filter === 'cancellation' && 'Cancelamentos'}
                  {filter === 'deadline' && 'Prazos'}
                </span>
                <ChevronDown size={14} className="text-brand-muted ml-1" />
              </button>
              
              {/* Dropdown Menu */}
              {isFilterOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-brand-card border border-brand-border rounded-lg shadow-xl transition-all z-20 flex flex-col py-1 animate-in fade-in slide-in-from-top-1">
                  <button
                    onClick={() => {
                      setFilter('all');
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                      filter === 'all' ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-brand-text hover:bg-brand-bg"
                    )}
                  >
                    <Bell size={14} />
                    Todas ({notifications.length})
                  </button>
                  <button
                    onClick={() => {
                      setFilter('unread');
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                      filter === 'unread' ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-brand-text hover:bg-brand-bg"
                    )}
                  >
                    <div className="relative">
                      <Bell size={14} />
                      {unreadCount > 0 && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                    </div>
                    Não lidas ({unreadCount})
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setFilter('cancellation');
                        setIsFilterOpen(false);
                      }}
                      className={cn(
                        "text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        filter === 'cancellation' ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-brand-text hover:bg-brand-bg"
                      )}
                    >
                      <AlertTriangle size={14} />
                      Cancelamentos
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFilter('deadline');
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                      filter === 'deadline' ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-brand-text hover:bg-brand-bg"
                    )}
                  >
                    <Clock size={14} />
                    Prazos
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notifications List */}
          {filter === 'sent_history' ? (
            <div className="overflow-y-auto flex-1 divide-y divide-brand-border/40 p-2">
              {customNotificationsDocs.length > 0 ? (
                customNotificationsDocs.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-brand-border/60 bg-brand-bg/40 my-1 flex flex-col gap-2 transition-all hover:bg-brand-bg/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <Send className="text-brand-primary shrink-0 mt-0.5" size={16} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-brand-text">{item.title}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                              {item.targetType === 'all'
                                ? 'Todos da equipe'
                                : `Para: ${item.targetEmployeeName || 'Funcionário'}`}
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted mt-1 leading-relaxed font-medium">
                            {item.message}
                          </p>
                          <p className="text-[10px] text-brand-muted/80 font-mono mt-1.5">
                            Enviado por {item.createdBy || 'Admin'} em {formatTimestamp(item.createdAt)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteCustomNotification?.(item.id)}
                        className="p-1.5 hover:bg-red-500/10 text-brand-muted hover:text-red-500 rounded transition-colors shrink-0"
                        title="Excluir do sistema para todos"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Send className="text-brand-muted opacity-60" size={32} />
                  <p className="text-xs text-brand-muted font-bold">
                    Nenhuma notificação enviada hoje no histórico.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 divide-y divide-brand-border/40 p-1">
              {filteredNotifications.length > 0 ? (
                <>
                  {filteredNotifications.slice(0, notificationLimit).map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "p-3 rounded-lg transition-all duration-200 flex flex-col gap-2 my-1",
                        !notif.isRead
                          ? "bg-brand-primary/10 border border-brand-primary/30"
                          : "hover:bg-brand-bg/60 border border-transparent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {getNotificationIcon(notif.type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-brand-text">
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-brand-muted mt-1 leading-relaxed font-medium">
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-brand-muted/80 font-mono mt-1.5">
                              {formatTimestamp(notif.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!notif.isRead && (
                            <button
                              onClick={() => onMarkRead(notif.id)}
                              className="p-1 hover:bg-emerald-500/10 text-brand-muted hover:text-emerald-500 rounded transition-colors"
                              title="Marcar como lida"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => onDismiss(notif.id)}
                            className="p-1 hover:bg-red-500/10 text-brand-muted hover:text-red-500 rounded transition-colors"
                            title="Ocultar notificação"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Actions inside notification item */}
                      {(notif.type === 'cancellation' || notif.type === 'extraordinary_avail') && onNavigateToCalendar && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              onNavigateToCalendar();
                              setIsOpen(false);
                            }}
                            className="text-[11px] font-bold text-amber-500 hover:text-amber-400 dark:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            Ver no Calendário
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {notificationLimit < filteredNotifications.length && (
                    <div ref={loaderRef} className="py-4 flex justify-center items-center">
                      <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Bell className="text-brand-muted opacity-60" size={32} />
                  <p className="text-xs text-brand-muted font-bold">
                    {filter === 'unread'
                      ? 'Nenhuma notificação pendente!'
                      : 'Nenhuma notificação encontrada.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
