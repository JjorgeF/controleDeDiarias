import React, { useRef, useEffect, useState } from 'react';
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  parseISO, 
  isBefore, 
  startOfDay,
  getDate
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Info,
  X,
  PartyPopper
} from 'lucide-react';
import { Employee, WorkDay } from '../types';

interface PaymentTimelineProps {
  employee: Employee;
  currentDate?: Date;
}

export type TimelineEventType = 'paid' | 'payment_forecast' | 'future_work' | 'past_work' | 'today';

export interface TimelineItem {
  id: string;
  date: Date;
  dateStr: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "15/08"
  dayOfWeek: string; // e.g. "Sáb"
  title: string; // e.g. "Pagamento Efetuado", "Previsão Pagamento", "Escalado(a)"
  subtitle?: string; // e.g. "CCSP", "Festa Infantil"
  type: TimelineEventType;
  isToday: boolean;
}

export default function PaymentTimeline({ employee, currentDate = new Date() }: PaymentTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const today = startOfDay(currentDate);

  // Range: 7 days ago to 7 days ahead (-7 to +7 days)
  const startDate = subDays(today, 7);
  const endDate = addDays(today, 7);

  // Build items array
  const items: TimelineItem[] = [];

  // Helper map for workDays
  const workDaysMap = new Map<string, WorkDay>();
  const partiesList: WorkDay[] = [];

  (employee.workDays || []).forEach(wd => {
    if (!wd.isCancelled && wd.date) {
      workDaysMap.set(wd.date, wd);
      if (wd.type === 'party') {
        partiesList.push(wd);
      }
    }
  });

  // Loop through all days in [-7, +7] range
  let current = startDate;
  while (isBefore(current, addDays(endDate, 1))) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const dayNum = getDate(current);
    const formattedDate = format(current, 'dd/MM');
    const dayOfWeek = format(current, 'EEE', { locale: ptBR }).replace('.', '');
    const isToday = isSameDay(current, today);

    const workDay = workDaysMap.get(dateStr);
    const isExplicitlyPaid = employee.paidDates?.includes(dateStr) || workDay?.isPaid;

    let itemType: TimelineEventType | null = null;
    let title = '';
    let subtitle = '';

    // Check if explicitly marked as paid by Admin for this specific date
    if (isExplicitlyPaid) {
      itemType = 'paid';
      title = 'Pagamento Efetuado';
      subtitle = workDay ? (workDay.partyName || 'Diária') : 'Confirmado pelo Admin';
    }
    // Check if workDay on this date
    else if (workDay) {
      const isPastOrToday = isBefore(current, addDays(today, 1));
      if (isPastOrToday) {
        itemType = 'past_work';
        title = 'Diária Realizada';
        subtitle = workDay.type === 'party' ? (workDay.partyName || 'Festa') : 'CCSP';
      } else {
        itemType = 'future_work';
        title = 'Escalado(a)';
        subtitle = workDay.type === 'party' ? (workDay.partyName || 'Festa') : 'CCSP';
      }
    } 
    // Check if 7 days after a Party Event (Payment Forecast for Parties = Party Date + 7 days)
    else {
      const matchingPartyForPayment = partiesList.find(p => {
        try {
          const partyDateObj = parseISO(p.date);
          const forecastPaymentDate = addDays(partyDateObj, 7);
          return isSameDay(forecastPaymentDate, current);
        } catch {
          return false;
        }
      });

      if (matchingPartyForPayment) {
        const partyPaymentPaid = employee.paidDates?.includes(dateStr) || matchingPartyForPayment.isPaid;
        if (partyPaymentPaid) {
          itemType = 'paid';
          title = 'Pagamento Efetuado';
          subtitle = matchingPartyForPayment.partyName || 'Festa (7 dias)';
        } else {
          itemType = 'payment_forecast';
          title = 'Previsão Pagamento';
          subtitle = `${matchingPartyForPayment.partyName || 'Festa'} (7d após)`;
        }
      }
      // Check if standard monthly payment milestone date (Dia 15 de cada mês)
      else if (dayNum === 15) {
        if (isExplicitlyPaid) {
          itemType = 'paid';
          title = 'Pagamento Efetuado';
          subtitle = 'Diárias CCSP Mês';
        } else {
          itemType = 'payment_forecast';
          title = 'Previsão Pagamento';
          subtitle = 'Dia 15 (CCSP Mês)';
        }
      }
      // Check if today indicator
      else if (isToday) {
        itemType = 'today';
        title = 'Hoje';
        subtitle = 'Em dia';
      }
    }

    if (itemType) {
      items.push({
        id: `${dateStr}-${itemType}-${items.length}`,
        date: new Date(current),
        dateStr,
        formattedDate,
        dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
        title,
        subtitle,
        type: itemType,
        isToday
      });
    }

    current = addDays(current, 1);
  }

  // Ensure "Hoje" is included if not present
  if (!items.some(i => i.isToday)) {
    const todayStr = format(today, 'yyyy-MM-dd');
    items.push({
      id: `${todayStr}-today`,
      date: today,
      dateStr: todayStr,
      formattedDate: format(today, 'dd/MM'),
      dayOfWeek: format(today, 'EEE', { locale: ptBR }).replace('.', ''),
      title: 'Hoje',
      subtitle: 'Em dia',
      type: 'today',
      isToday: true
    });
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Scroll to "Hoje" node on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const todayElement = scrollContainerRef.current.querySelector('[data-istoday="true"]');
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, []);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const getNodeStyles = (type: TimelineEventType, isToday: boolean) => {
    switch (type) {
      case 'paid':
        return {
          bg: 'bg-emerald-500',
          border: 'border-emerald-400/80',
          glow: 'shadow-lg shadow-emerald-500/30',
          textColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
          icon: <CheckCircle2 size={13} className="text-white" />
        };
      case 'payment_forecast':
        return {
          bg: 'bg-amber-500',
          border: 'border-amber-400/80',
          glow: 'shadow-lg shadow-amber-500/30',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
          icon: <Clock size={13} className="text-slate-950" />
        };
      case 'future_work':
        return {
          bg: 'bg-cyan-500',
          border: 'border-cyan-400/80',
          glow: 'shadow-lg shadow-cyan-500/30',
          textColor: 'text-cyan-400',
          badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
          icon: <Calendar size={13} className="text-slate-950" />
        };
      case 'past_work':
        return {
          bg: 'bg-purple-500',
          border: 'border-purple-400/80',
          glow: 'shadow-lg shadow-purple-500/30',
          textColor: 'text-purple-400',
          badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
          icon: <TrendingUp size={13} className="text-white" />
        };
      case 'today':
      default:
        return {
          bg: 'bg-indigo-500',
          border: 'border-indigo-300',
          glow: 'shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-400/50',
          textColor: 'text-indigo-300',
          badgeBg: 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200',
          icon: <Sparkles size={12} className="text-white animate-pulse" />
        };
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 my-4 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <DollarSign size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5">
              <span>Linha do Tempo de Pagamento & Escalas</span>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="inline-flex items-center justify-center p-1 rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300 transition-colors"
                title="Ver regras de pagamento"
              >
                <Info size={13} />
              </button>
            </h4>
            <p className="text-[10px] text-brand-muted">
              Visão semanal (-7 dias a +7 dias)
            </p>
          </div>
        </div>

        {/* Scroll Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleScrollLeft}
            type="button"
            className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-gray-400 hover:text-white transition-colors"
            title="Rolar para esquerda"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleScrollRight}
            type="button"
            className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-gray-400 hover:text-white transition-colors"
            title="Rolar para direita"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Timeline Scrollable Track */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-none py-2 px-1 relative flex items-start gap-0 cursor-grab active:cursor-grabbing snap-x select-none"
      >
        {/* Continuous Horizontal Background Line */}
        <div className="absolute top-[52px] left-8 right-8 h-0.5 bg-slate-800 z-0 pointer-events-none" />

        {items.map((item) => {
          const style = getNodeStyles(item.type, item.isToday);

          return (
            <div 
              key={item.id}
              data-istoday={item.isToday}
              className="flex-1 min-w-[105px] max-w-[125px] shrink-0 flex flex-col items-center text-center relative z-10 px-1 snap-center"
            >
              {/* TOP: Text ABOVE node (Short title & subtitle) */}
              <div className="h-10 flex flex-col items-center justify-end mb-1.5 w-full">
                <span className={`text-[10px] font-black leading-tight truncate max-w-full px-1 ${style.textColor}`}>
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="text-[9px] font-medium text-gray-400 truncate max-w-full">
                    {item.subtitle}
                  </span>
                )}
              </div>

              {/* CENTER: Node Dot on Line */}
              <div className="relative my-0.5 flex items-center justify-center">
                <div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${style.bg} ${style.border} ${style.glow} transition-transform duration-200 hover:scale-110`}
                >
                  {style.icon}
                </div>
                {item.isToday && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                )}
              </div>

              {/* BOTTOM: Date BELOW node */}
              <div className="h-8 flex flex-col items-center justify-start mt-1.5 w-full">
                <span className={`text-[11px] font-extrabold ${item.isToday ? 'text-indigo-300 font-black' : 'text-gray-200'}`}>
                  {item.formattedDate}
                </span>
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  {item.dayOfWeek}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[9px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Pagamento Efetuado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <span>Previsão Pagamento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
          <span>Escalado(a)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span>Diária Realizada</span>
        </div>
      </div>

      {/* Modal de Regras de Pagamento */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 relative my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Info size={18} />
                <span>Regras de Pagamento de Diárias</span>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 text-gray-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3 text-xs text-gray-200">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <Calendar size={14} />
                  Diárias CCSP / Mês
                </h4>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  O pagamento das diárias regulares é realizado no <strong>dia 15 de cada mês</strong>.
                </p>
                
                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                  <p className="font-bold">📌 Virada de Mês & Feriado Prolongado:</p>
                  <ul className="list-disc list-inside text-[10px] space-y-0.5 text-amber-200/90 leading-normal">
                    <li>Se o mês virar num domingo (Dia 01), o pagamento será dia 15 do mês que entrou.</li>
                    <li>Se o mês virar durante um feriadão prolongado, o pagamento será realizado no dia 15 do mês que entrou durante o feriadão.</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <PartyPopper size={14} />
                  Eventos & Festas
                </h4>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Os pagamentos referentes a eventos e festas ocorrem exatamente <strong>1 semana (7 dias) após a realização do evento</strong>, variando conforme a data da festa.
                </p>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md shadow-amber-950/50"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
