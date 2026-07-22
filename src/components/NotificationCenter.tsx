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
  History
} from 'lucide-react';
import { AppNotification, NotificationType, CustomNotificationDoc } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

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
  onDeleteCustomNotification
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'cancellation' | 'deadline' | 'sent_history'>('all');
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Request browser notification permission
  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não suporta notificações de sistema.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        new Notification('Liga Positiva', {
          body: 'Notificações do sistema ativadas com sucesso!',
          icon: '/logo.svg'
        });
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
              {unreadCount > 0 && (
                <span className="bg-red-500/20 text-red-500 border border-red-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {isAdmin && onOpenSendModal && (
                <button
                  onClick={() => {
                    onOpenSendModal();
                    setIsOpen(false);
                  }}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-extrabold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                  title="Enviar notificação personalizada para a equipe"
                >
                  <Send size={12} />
                  <span>Nova</span>
                </button>
              )}
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
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-bg transition-colors"
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

          {/* Filter Tabs */}
          <div className="flex items-center border-b border-brand-border/60 bg-brand-bg/40 text-xs px-2 pt-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-t-lg font-bold transition-colors whitespace-nowrap",
                filter === 'all'
                  ? "bg-brand-card text-brand-primary border-t-2 border-brand-primary shadow-sm"
                  : "text-brand-muted hover:text-brand-text"
              )}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                "px-3 py-1.5 rounded-t-lg font-bold transition-colors whitespace-nowrap",
                filter === 'unread'
                  ? "bg-brand-card text-brand-primary border-t-2 border-brand-primary shadow-sm"
                  : "text-brand-muted hover:text-brand-text"
              )}
            >
              Não lidas ({unreadCount})
            </button>
            {isAdmin && (
              <button
                onClick={() => setFilter('cancellation')}
                className={cn(
                  "px-3 py-1.5 rounded-t-lg font-bold transition-colors whitespace-nowrap",
                  filter === 'cancellation'
                    ? "bg-brand-card text-brand-primary border-t-2 border-brand-primary shadow-sm"
                    : "text-brand-muted hover:text-brand-text"
                )}
              >
                Cancelamentos
              </button>
            )}
            <button
              onClick={() => setFilter('deadline')}
              className={cn(
                "px-3 py-1.5 rounded-t-lg font-bold transition-colors whitespace-nowrap",
                filter === 'deadline'
                  ? "bg-brand-card text-brand-primary border-t-2 border-brand-primary shadow-sm"
                  : "text-brand-muted hover:text-brand-text"
              )}
            >
              Prazos
            </button>
            {isAdmin && (
              <button
                onClick={() => setFilter('sent_history')}
                className={cn(
                  "px-3 py-1.5 rounded-t-lg font-bold transition-colors whitespace-nowrap flex items-center gap-1",
                  filter === 'sent_history'
                    ? "bg-brand-card text-brand-primary border-t-2 border-brand-primary shadow-sm"
                    : "text-brand-muted hover:text-brand-text"
                )}
                title="Histórico de Notificações enviadas pela administração"
              >
                <History size={13} />
                <span>Histórico ({customNotificationsDocs.length})</span>
              </button>
            )}
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
                filteredNotifications.map((notif) => (
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
                    {notif.type === 'cancellation' && onNavigateToCalendar && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            onNavigateToCalendar();
                            setIsOpen(false);
                          }}
                          className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1"
                        >
                          Ver no Calendário
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
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
