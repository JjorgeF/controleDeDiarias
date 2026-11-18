import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  TrendingUp, 
  DollarSign, 
  Sparkles,
  CreditCard,
  Building2,
  PartyPopper,
  Calendar,
  Clock,
  UserRound,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Employee } from '../types';
import PaymentTimeline from './PaymentTimeline';
import { formatCurrency, getPartyPaymentDueDate, getCcspCycleAndDueDate, computeCcspBatchStatus, getWorkDayPayAmount } from '../lib/utils';
import { AnimatedCurrency } from './AnimatedCurrency';
import { format, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeEarningsViewProps {
  employee: Employee;
  onViewStory?: () => void;
}

export default function EmployeeEarningsView({
  employee,
  onViewStory
}: EmployeeEarningsViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setCurrentMonth(new Date());

  const monthName = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const currentMonthCcspKey = format(currentMonth, 'yyyy-MM-15');
  const currentMonthCcspFormatted = `15/${format(currentMonth, 'MM/yyyy')}`;

  // CCSP batch aligned with Admin (Vencimento em dia 15 de currentMonth)
  const ccspBatchStatus = React.useMemo(() => {
    return computeCcspBatchStatus(employee, currentMonthCcspKey);
  }, [employee, currentMonthCcspKey]);

  const monthCcspDays = ccspBatchStatus.matchingDays;

  // Party payments due inside currentMonth (Regime de Caixa / Vencimento igual ao Admin)
  const isManagement = employee.paymentGroup === 'management';
  const partyItemsComputed = React.useMemo(() => {
    const allPartyDays = (employee.workDays || []).filter(wd => !wd.isCancelled && wd.date && wd.type === 'party');
    const items: { pd: typeof allPartyDays[number]; isPaid: boolean; amount: number }[] = [];

    allPartyDays.forEach((pd, idx) => {
      try {
        const partyDateObj = parseISO(pd.date.includes('T') ? pd.date : `${pd.date}T12:00:00`);
        const forecastDate = getPartyPaymentDueDate(partyDateObj, isManagement);

        if (!isSameMonth(forecastDate, currentMonth)) {
          return;
        }

        const dueDateStr = format(forecastDate, 'yyyy-MM-dd');
        const partyUniqueKey = `party_${pd.date}_${pd.partyId || pd.partyName || idx}`;
        const sameDayPartyCount = allPartyDays.filter(p => p.date === pd.date).length;

        const isPaid =
          (employee.paidDates || []).includes(partyUniqueKey) ||
          !!pd.isPaid ||
          ((employee.paidDates || []).includes(dueDateStr) && sameDayPartyCount === 1) ||
          ((employee.paidDates || []).includes(pd.date) && sameDayPartyCount === 1);

        const amount = getWorkDayPayAmount(pd, employee);
        items.push({ pd, isPaid, amount });
      } catch {
        // Ignora registros inválidos
      }
    });

    return items;
  }, [employee, currentMonth, isManagement]);

  const totalDiariasMes = monthCcspDays.length + partyItemsComputed.length;

  const ccspTotalAmount = ccspBatchStatus.totalAmount;
  const ccspRemaining = ccspBatchStatus.remainingAmount;
  const paidCcspCount = ccspBatchStatus.paidDaysCount;

  const paidPartyCount = partyItemsComputed.filter(p => p.isPaid).length;
  const totalPaidCount = paidCcspCount + paidPartyCount;

  const partyTotalAmount = Number(partyItemsComputed.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
  const partyRemaining = Number(partyItemsComputed.reduce((acc, p) => acc + (p.isPaid ? 0 : p.amount), 0).toFixed(2));
  const remainingToPay = Number((ccspRemaining + partyRemaining).toFixed(2));

  const monthTotalEarnings = Number((ccspTotalAmount + partyTotalAmount).toFixed(2));
  const hasCcspPartialAlert = ccspBatchStatus.isPartiallyPaid || ccspBatchStatus.hasPaidFlagWithPendingBalance;

  const ccspDatesShort = monthCcspDays.map(d => {
    try {
      return format(parseISO(d.date), 'dd/MM');
    } catch {
      return d.date;
    }
  });
  const unpaidCcspDatesShort = ccspBatchStatus.unpaidDays.map(d => {
    try {
      return format(parseISO(d.date), 'dd/MM');
    } catch {
      return d.date;
    }
  });
  const ccspCompetenceLabel = monthCcspDays.length > 0
    ? getCcspCycleAndDueDate(monthCcspDays[0].date).cycleMonthName
    : format(subMonths(currentMonth, 1), 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Resumo de Ganhos */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <DollarSign size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-brand-text font-playful tracking-wide">
                  Meus Ganhos & Pagamentos
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  {employee.level}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Visão por lote de pagamento mensal (alinhada ao financeiro: CCSP no Dia 15 e Festas na 2ª seguinte)
              </p>
            </div>
          </div>

          {employee.pixKey && (
            <div className="bg-brand-bg/70 border border-brand-border/80 rounded-xl px-3 py-2 text-xs self-start sm:self-auto flex items-center gap-2">
              <CreditCard size={14} className="text-brand-primary shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">
                  Chave PIX ({employee.pixType?.toUpperCase() || 'CHAVE'})
                </span>
                <span className="font-mono text-brand-text font-bold">
                  {employee.pixKey}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Seletor de Mês / Lote de Pagamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-card border border-brand-border px-4 py-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-muted">
          <Calendar size={16} className="text-brand-primary shrink-0" />
          <div>
            <span className="uppercase tracking-wider block">Lote de Pagamento:</span>
            <span className="text-[10px] font-medium text-gray-400">
              Vencimento CCSP em {currentMonthCcspFormatted} + Festas com pagamento no mês
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-primary text-brand-text transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-black text-brand-text min-w-[140px] text-center capitalize">
            {capitalizedMonth}
          </span>
          <button 
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-primary text-brand-text transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight size={16} />
          </button>
          <button 
            type="button"
            onClick={handleCurrentMonth}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/25 transition-colors ml-1 whitespace-nowrap"
          >
            Mês Atual
          </button>
        </div>
      </div>

      {/* Grid com os 4 Cards de Estatísticas e Ganhos do Lote */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* 1. Diárias no Lote */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diárias no Lote</span>
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
              <Award size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text tabular-nums">{totalDiariasMes}</span>
            <div className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-1.5 tabular-nums">
              <span className="text-brand-primary">{monthCcspDays.length} CCSP</span>
              <span>•</span>
              <span className="text-brand-party">{partyItemsComputed.length} Festas</span>
            </div>
          </div>
        </motion.div>

        {/* 2. Diárias Pagas */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diárias Pagas</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-emerald-400 tabular-nums">{totalPaidCount}</span>
            <div className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-1.5 tabular-nums">
              <span className="text-emerald-400">{paidCcspCount}/{monthCcspDays.length} CCSP</span>
              <span>•</span>
              <span className="text-brand-party">{paidPartyCount}/{partyItemsComputed.length} Festas</span>
            </div>
          </div>
        </motion.div>

        {/* 3. Falta a Ser Pago */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Falta a Ser Pago</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <AlertCircle size={18} />
            </div>
          </div>
          <div>
            <AnimatedCurrency value={remainingToPay} className="text-xl md:text-2xl font-black text-amber-400 block tabular-nums" />
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              {remainingToPay === 0
                ? 'Tudo pago no lote!'
                : hasCcspPartialAlert
                  ? 'Saldo restante (lote parcial)'
                  : 'Pendente de quitação'}
            </p>
          </div>
        </motion.div>

        {/* 4. Previsão de Ganhos do Lote */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Previsão do Lote</span>
            <div className="p-2 bg-brand-party/10 text-brand-party rounded-xl">
              <Sparkles size={18} />
            </div>
          </div>
          <div>
            <AnimatedCurrency value={monthTotalEarnings} className="text-xl md:text-2xl font-black text-brand-text block tabular-nums" />
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              CCSP + Festas + Extras
            </p>
          </div>
        </motion.div>
      </div>

      {/* Detalhamento do Lote CCSP & Alerta de Saldo Restante */}
      {monthCcspDays.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                <Building2 size={17} />
              </div>
              <div>
                <h3 className="text-sm font-black text-brand-text">
                  Lote CCSP — Vencimento {currentMonthCcspFormatted}
                </h3>
                <p className="text-[11px] text-brand-muted capitalize">
                  Competência: {ccspCompetenceLabel} · {monthCcspDays.length} {monthCcspDays.length === 1 ? 'diária' : 'diárias'} ({ccspDatesShort.join(', ')})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:text-right">
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                ccspBatchStatus.isFullyPaid
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {ccspBatchStatus.isFullyPaid
                  ? 'Quitado'
                  : hasCcspPartialAlert
                    ? 'Pago Parcial'
                    : 'Pendente'}
              </span>
              <span className="text-sm font-black text-brand-text tabular-nums">
                {formatCurrency(ccspTotalAmount)}
              </span>
            </div>
          </div>

          {(ccspBatchStatus.pulledFromNextMonthDates.length > 0 || ccspBatchStatus.bridgeDatesInBatch.length > 0) && (
            <p className="text-[11px] text-cyan-300 font-semibold">
              {ccspBatchStatus.pulledFromNextMonthDates.length > 0
                ? `Inclui diárias de feriado/emenda na virada do mês (${ccspBatchStatus.pulledFromNextMonthDates.join(', ')}) agrupadas no lote ${currentMonthCcspFormatted}.`
                : `Inclui bloco de feriado prolongado na virada do mês (${ccspBatchStatus.bridgeDatesInBatch.join(', ')}) agrupado no lote ${currentMonthCcspFormatted}.`}
            </p>
          )}

          {hasCcspPartialAlert && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-300">
                  Saldo restante a receber neste lote: <span className="tabular-nums">{formatCurrency(ccspRemaining)}</span>
                </p>
                <p className="text-[11px] text-amber-200/85">
                  {ccspBatchStatus.alreadyPaidAmount > 0
                    ? `Já pago anteriormente: ${formatCurrency(ccspBatchStatus.alreadyPaidAmount)}. `
                    : 'Este lote teve atualização nas datas após a baixa anterior. '}
                  {unpaidCcspDatesShort.length > 0
                    ? `Diárias pendentes neste fechamento: ${unpaidCcspDatesShort.join(', ')}.`
                    : 'Diferença em aberto aguardando quitação.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linha do Tempo de Pagamento e Escalas */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <PaymentTimeline employee={employee} />
      </motion.div>

      {/* Atalho para a aba de Perfil */}
      {onViewStory && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <button
            type="button"
            onClick={onViewStory}
            className="w-full bg-brand-card hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary/40 rounded-2xl p-4 flex items-center justify-between text-left transition-all group shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-brand-primary/15 text-brand-primary rounded-xl group-hover:scale-110 transition-transform">
                <UserRound size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-brand-text group-hover:text-brand-primary transition-colors">
                  Ver Meu Perfil & Uniformes
                </p>
                <p className="text-xs text-gray-400">
                  Consulte ou altere dados de uniformes, conta bancária, data de entrada e reconhecimentos
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-brand-primary group-hover:translate-x-1 transition-all shrink-0" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
