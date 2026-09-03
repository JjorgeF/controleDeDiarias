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
import { formatCurrency } from '../lib/utils';
import { AnimatedCurrency } from './AnimatedCurrency';
import { format, isSameMonth, parseISO, addMonths, subMonths, addDays } from 'date-fns';
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

  // Month work days
  const monthWorkDays = React.useMemo(() => {
    return (employee.workDays || []).filter(wd => {
      if (wd.isCancelled || !wd.date) return false;
      try {
        return isSameMonth(parseISO(wd.date), currentMonth);
      } catch {
        return false;
      }
    });
  }, [employee.workDays, currentMonth]);

  const monthCcspDays = monthWorkDays.filter(wd => wd.type === 'common');
  const monthPartyDays = monthWorkDays.filter(wd => wd.type === 'party');
  const totalDiariasMes = monthWorkDays.length;

  // CCSP Payment status & amount
  const isCcspPaid = (employee.paidDates || []).includes(currentMonthCcspKey);
  const ccspTotalAmount = monthCcspDays.reduce((acc, d) => {
    const rate = d.isReducedHours && d.customTotalPay !== undefined && d.customTotalPay >= 0
      ? d.customTotalPay
      : (d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : employee.dailyRate);
    const extraRate = d.extraHourRateAtTime !== undefined ? d.extraHourRateAtTime : employee.extraHourRate;
    const extra = (d.extraHours || 0) * extraRate;
    return acc + rate + extra;
  }, 0);

  // Party Payment status & amounts
  const partyItemsComputed = monthPartyDays.map(pd => {
    try {
      const partyDateObj = parseISO(pd.date);
      const forecastDate = addDays(partyDateObj, 7);
      const dueDateStr = format(forecastDate, 'yyyy-MM-dd');
      const isPaid = (employee.paidDates || []).includes(dueDateStr) || (employee.paidDates || []).includes(pd.date) || !!pd.isPaid;

      const rate = pd.isReducedHours && pd.customTotalPay !== undefined && pd.customTotalPay >= 0
        ? pd.customTotalPay
        : (pd.partyRateAtTime !== undefined ? pd.partyRateAtTime : employee.partyRate);
      const extraRate = pd.extraHourRateAtTime !== undefined ? pd.extraHourRateAtTime : employee.extraHourRate;
      const extra = (pd.extraHours || 0) * extraRate;
      const amount = rate + extra;

      return { pd, isPaid, amount };
    } catch {
      return { pd, isPaid: false, amount: 0 };
    }
  });

  const paidCcspCount = isCcspPaid ? monthCcspDays.length : 0;
  const paidPartyCount = partyItemsComputed.filter(p => p.isPaid).length;
  const totalPaidCount = paidCcspCount + paidPartyCount;

  const ccspRemaining = isCcspPaid ? 0 : ccspTotalAmount;
  const partyRemaining = partyItemsComputed.reduce((acc, p) => acc + (p.isPaid ? 0 : p.amount), 0);
  const remainingToPay = ccspRemaining + partyRemaining;

  const monthTotalEarnings = ccspTotalAmount + partyItemsComputed.reduce((acc, p) => acc + p.amount, 0);

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
                Histórico consolidado de diárias trabalhadas, cachês e previsões de pagamento
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

      {/* Seletor de Mês */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-card border border-brand-border px-4 py-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-wider">
          <Calendar size={16} className="text-brand-primary" />
          <span>Mês de Referência:</span>
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
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/25 transition-colors ml-1"
          >
            Mês Atual
          </button>
        </div>
      </div>

      {/* Grid com os 4 Cards de Estatísticas e Ganhos do Mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* 1. Diárias no Mês */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diárias no Mês</span>
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
              <Award size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-brand-text">{totalDiariasMes}</span>
            <div className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-1.5">
              <span className="text-brand-primary">{monthCcspDays.length} CCSP</span>
              <span>•</span>
              <span className="text-brand-party">{monthPartyDays.length} Festas</span>
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
            <span className="text-2xl md:text-3xl font-black text-emerald-400">{totalPaidCount}</span>
            <div className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-1.5">
              <span className="text-emerald-400">{paidCcspCount}/{monthCcspDays.length} CCSP</span>
              <span>•</span>
              <span className="text-brand-party">{paidPartyCount}/{monthPartyDays.length} Festas</span>
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
            <AnimatedCurrency value={remainingToPay} className="text-xl md:text-2xl font-black text-amber-400 block" />
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              {remainingToPay === 0 ? 'Tudo pago no mês!' : 'Pendente de quitação'}
            </p>
          </div>
        </motion.div>

        {/* 4. Previsão de Ganhos desse Mês */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-brand-card border border-brand-border p-4 rounded-2xl flex flex-col justify-between shadow-md hover:border-brand-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-brand-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Previsão do Mês</span>
            <div className="p-2 bg-brand-party/10 text-brand-party rounded-xl">
              <Sparkles size={18} />
            </div>
          </div>
          <div>
            <AnimatedCurrency value={monthTotalEarnings} className="text-xl md:text-2xl font-black text-brand-text block" />
            <p className="text-[11px] font-medium text-gray-400 mt-1">
              CCSP + Festas + Extras
            </p>
          </div>
        </motion.div>
      </div>

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
