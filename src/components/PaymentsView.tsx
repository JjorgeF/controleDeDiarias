import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  PartyPopper, 
  Building2, 
  User, 
  CreditCard, 
  AlertCircle,
  Filter,
  ArrowUpRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Employee, WorkDay } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  parseISO, 
  addMonths, 
  subMonths, 
  addDays, 
  isPast,
  isToday,
  isBefore
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface PaymentsViewProps {
  employees: Employee[];
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  onUpdateDetails: (employeeId: string, updatedFields: Partial<Employee>) => Promise<void>;
  onViewStory?: (employee: Employee) => void;
}

type PaymentTypeFilter = 'all' | 'ccsp' | 'parties';
type PaymentStatusFilter = 'all' | 'pending' | 'paid';

interface CCSPPaymentItem {
  id: string;
  type: 'ccsp';
  employee: Employee;
  daysCount: number;
  totalAmount: number;
  dueDateStr: string;
  dueDateFormatted: string;
  isPaid: boolean;
  workDays: WorkDay[];
}

interface PartyPaymentItem {
  id: string;
  type: 'party';
  employee: Employee;
  partyName: string;
  partyDate: string;
  partyDateFormatted: string;
  dueDateStr: string;
  dueDateFormatted: string;
  amount: number;
  isPaid: boolean;
  workDay: WorkDay;
}

export default function PaymentsView({
  employees,
  currentMonth,
  setCurrentMonth,
  onUpdateDetails,
  onViewStory
}: PaymentsViewProps) {
  const [typeFilter, setTypeFilter] = useState<PaymentTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Month navigation handlers
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setCurrentMonth(new Date());

  const monthName = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const currentMonthCcspKey = format(currentMonth, 'yyyy-MM-15');

  // Copy PIX to clipboard
  const handleCopyPix = (pixKey: string, id: string) => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(id);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  // Toggle CCSP Payment
  const handleToggleCCSPPayment = async (employee: Employee, isPaid: boolean) => {
    const itemKey = `ccsp-${employee.id}-${currentMonthCcspKey}`;
    try {
      setIsProcessing(itemKey);
      const currentPaid = employee.paidDates || [];
      const newPaid = isPaid
        ? currentPaid.filter(d => d !== currentMonthCcspKey)
        : [...currentPaid, currentMonthCcspKey];

      await onUpdateDetails(employee.id, { paidDates: newPaid });
    } catch (error) {
      console.error('Erro ao alternar status do pagamento CCSP:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  // Toggle Party Payment
  const handleTogglePartyPayment = async (employee: Employee, dueDateStr: string, isPaid: boolean) => {
    const itemKey = `party-${employee.id}-${dueDateStr}`;
    try {
      setIsProcessing(itemKey);
      const currentPaid = employee.paidDates || [];
      const newPaid = isPaid
        ? currentPaid.filter(d => d !== dueDateStr)
        : [...currentPaid, dueDateStr];

      await onUpdateDetails(employee.id, { paidDates: newPaid });
    } catch (error) {
      console.error('Erro ao alternar status do pagamento de festa:', error);
    } finally {
      setIsProcessing(null);
    }
  };



  // Process and compute all payment records for currentMonth
  const { ccspItems, partyItems, stats } = useMemo(() => {
    const ccspList: CCSPPaymentItem[] = [];
    const partyList: PartyPaymentItem[] = [];

    const activeEmps = employees.filter(e => e.status !== 'inactive');

    activeEmps.forEach(emp => {
      const monthDays = (emp.workDays || []).filter(wd => {
        if (wd.isCancelled || !wd.date) return false;
        try {
          return isSameMonth(parseISO(wd.date), currentMonth);
        } catch {
          return false;
        }
      });

      // 1. CCSP Diárias
      const ccspDays = monthDays.filter(wd => wd.type === 'common');
      if (ccspDays.length > 0) {
        const totalAmount = ccspDays.reduce((acc, d) => {
          const rate = d.isReducedHours && d.customTotalPay !== undefined && d.customTotalPay >= 0
            ? d.customTotalPay
            : (d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : emp.dailyRate);
          const extraRate = d.extraHourRateAtTime !== undefined ? d.extraHourRateAtTime : emp.extraHourRate;
          const extra = (d.extraHours || 0) * extraRate;
          return acc + rate + extra;
        }, 0);

        const isPaid = (emp.paidDates || []).includes(currentMonthCcspKey);

        ccspList.push({
          id: `ccsp-${emp.id}-${currentMonthCcspKey}`,
          type: 'ccsp',
          employee: emp,
          daysCount: ccspDays.length,
          totalAmount,
          dueDateStr: currentMonthCcspKey,
          dueDateFormatted: `15/${format(currentMonth, 'MM/yyyy')}`,
          isPaid,
          workDays: ccspDays
        });
      }

      // 2. Festas e Eventos
      const partyDays = monthDays.filter(wd => wd.type === 'party');
      partyDays.forEach((pd, idx) => {
        try {
          const partyDateObj = parseISO(pd.date);
          const forecastDate = addDays(partyDateObj, 7);
          const dueDateStr = format(forecastDate, 'yyyy-MM-dd');
          const isPaid = (emp.paidDates || []).includes(dueDateStr) || (emp.paidDates || []).includes(pd.date) || !!pd.isPaid;

          const rate = pd.isReducedHours && pd.customTotalPay !== undefined && pd.customTotalPay >= 0
            ? pd.customTotalPay
            : (pd.partyRateAtTime !== undefined ? pd.partyRateAtTime : emp.partyRate);
          const extraRate = pd.extraHourRateAtTime !== undefined ? pd.extraHourRateAtTime : emp.extraHourRate;
          const extra = (pd.extraHours || 0) * extraRate;
          const amount = rate + extra;

          partyList.push({
            id: `party-${emp.id}-${idx}-${pd.date}`,
            type: 'party',
            employee: emp,
            partyName: pd.partyName || 'Evento / Festa',
            partyDate: pd.date,
            partyDateFormatted: format(partyDateObj, 'dd/MM/yyyy'),
            dueDateStr,
            dueDateFormatted: format(forecastDate, 'dd/MM/yyyy'),
            amount,
            isPaid,
            workDay: pd
          });
        } catch (e) {
          console.error('Erro ao calcular festa:', e);
        }
      });
    });

    // Compute Overall Financial Statistics
    const allTotalAmount = ccspList.reduce((acc, c) => acc + c.totalAmount, 0) +
                           partyList.reduce((acc, p) => acc + p.amount, 0);

    const paidTotalAmount = ccspList.filter(c => c.isPaid).reduce((acc, c) => acc + c.totalAmount, 0) +
                            partyList.filter(p => p.isPaid).reduce((acc, p) => acc + p.amount, 0);

    const pendingTotalAmount = allTotalAmount - paidTotalAmount;

    const totalCount = ccspList.length + partyList.length;
    const paidCount = ccspList.filter(c => c.isPaid).length + partyList.filter(p => p.isPaid).length;
    const pendingCount = totalCount - paidCount;

    return {
      ccspItems: ccspList.sort((a, b) => a.employee.artisticName.localeCompare(b.employee.artisticName)),
      partyItems: partyList.sort((a, b) => a.dueDateStr.localeCompare(b.dueDateStr)),
      stats: {
        allTotalAmount,
        paidTotalAmount,
        pendingTotalAmount,
        totalCount,
        paidCount,
        pendingCount
      }
    };
  }, [employees, currentMonth, currentMonthCcspKey]);

  // Apply filters
  const filteredCcspItems = useMemo(() => {
    if (typeFilter === 'parties') return [];
    return ccspItems.filter(item => {
      if (statusFilter === 'pending' && item.isPaid) return false;
      if (statusFilter === 'paid' && !item.isPaid) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.employee.name.toLowerCase().includes(query);
        const matchesArtistic = item.employee.artisticName.toLowerCase().includes(query);
        const matchesPix = (item.employee.pixKey || '').toLowerCase().includes(query);
        if (!matchesName && !matchesArtistic && !matchesPix) return false;
      }
      return true;
    });
  }, [ccspItems, typeFilter, statusFilter, searchQuery]);

  const filteredPartyItems = useMemo(() => {
    if (typeFilter === 'ccsp') return [];
    return partyItems.filter(item => {
      if (statusFilter === 'pending' && item.isPaid) return false;
      if (statusFilter === 'paid' && !item.isPaid) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.employee.name.toLowerCase().includes(query);
        const matchesArtistic = item.employee.artisticName.toLowerCase().includes(query);
        const matchesParty = item.partyName.toLowerCase().includes(query);
        const matchesPix = (item.employee.pixKey || '').toLowerCase().includes(query);
        if (!matchesName && !matchesArtistic && !matchesParty && !matchesPix) return false;
      }
      return true;
    });
  }, [partyItems, typeFilter, statusFilter, searchQuery]);



  return (
    <div className="space-y-6">
      {/* Header com Navegação Mensal e Informações */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <DollarSign size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-brand-text font-playful tracking-wide">
                  Gestão Financeira & Pagamentos
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Exclusivo Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Controle de quitação mensal (CCSP no Dia 15 e Festas em 7 dias após o evento)
              </p>
            </div>
          </div>

          {/* Seletor de Mês Centralizado/Sincronizado */}
          <div className="flex items-center justify-between sm:justify-end gap-2 bg-brand-bg/60 border border-brand-border/80 rounded-xl p-1.5 self-stretch sm:self-auto">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-brand-card text-gray-300 hover:text-white transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 text-center min-w-[140px]">
              <span className="text-sm font-black text-brand-text block">{capitalizedMonth}</span>
              <button
                onClick={handleCurrentMonth}
                className="text-[10px] font-bold text-brand-primary hover:underline"
              >
                Ir para Mês Atual
              </button>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-brand-card text-gray-300 hover:text-white transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Resumo Financeiro / KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
          {/* Total Previsto */}
          <div className="bg-brand-bg/50 border border-brand-border rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-brand-muted font-bold">
              <span>Total a Pagar no Mês</span>
              <Calendar size={15} className="text-brand-primary" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-brand-text block">
                {formatCurrency(stats.allTotalAmount)}
              </span>
              <span className="text-[11px] text-gray-400 font-semibold mt-0.5 block">
                {stats.totalCount} {stats.totalCount === 1 ? 'pagamento cadastrado' : 'pagamentos cadastrados'}
              </span>
            </div>
          </div>

          {/* Total Já Quitado */}
          <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
              <span>Total Já Quitado (Pago)</span>
              <CheckCircle2 size={15} className="text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-400 block">
                {formatCurrency(stats.paidTotalAmount)}
              </span>
              <span className="text-[11px] text-emerald-500/80 font-semibold mt-0.5 block">
                {stats.paidCount} de {stats.totalCount} quitados
              </span>
            </div>
          </div>

          {/* Total Pendente */}
          <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
              <span>Total Pendente</span>
              <Clock size={15} className="text-amber-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-400 block">
                {formatCurrency(stats.pendingTotalAmount)}
              </span>
              <span className="text-[11px] text-amber-500/80 font-semibold mt-0.5 block">
                {stats.pendingCount} {stats.pendingCount === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}
              </span>
            </div>
          </div>
        </div>

        {/* Filtros e Barra de Busca */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6 pt-4 border-t border-brand-border/60">
          {/* Busca por Recreador ou PIX */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, apelido ou chave PIX..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-bg/80 border border-brand-border rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm focus:outline-none focus:border-brand-primary transition-colors text-brand-text placeholder-gray-500"
            />
          </div>

          {/* Controles de Filtro */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tipo */}
            <div className="flex items-center bg-brand-bg/80 border border-brand-border rounded-xl p-1 text-xs">
              <button
                onClick={() => setTypeFilter('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  typeFilter === 'all' ? "bg-brand-primary text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setTypeFilter('ccsp')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1",
                  typeFilter === 'ccsp' ? "bg-brand-primary text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
                )}
              >
                <Building2 size={12} />
                CCSP (Dia 15)
              </button>
              <button
                onClick={() => setTypeFilter('parties')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1",
                  typeFilter === 'parties' ? "bg-brand-primary text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
                )}
              >
                <PartyPopper size={12} />
                Festas (7d)
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center bg-brand-bg/80 border border-brand-border rounded-xl p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  statusFilter === 'all' ? "bg-brand-card text-brand-text shadow-sm" : "text-gray-400 hover:text-white"
                )}
              >
                Status: Todos
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  statusFilter === 'pending' ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-gray-400 hover:text-white"
                )}
              >
                Pendentes
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  statusFilter === 'paid' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-gray-400 hover:text-white"
                )}
              >
                Pagos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: Lote Mensal CCSP (Previsão: Dia 15) */}
      {(typeFilter === 'all' || typeFilter === 'ccsp') && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Building2 className="text-brand-primary" size={18} />
              <h3 className="text-base sm:text-lg font-black text-brand-text">
                Lote Mensal CCSP — Vencimento Dia 15/{format(currentMonth, 'MM')}
              </h3>
              <span className="text-xs font-bold bg-brand-card border border-brand-border px-2 py-0.5 rounded-full text-brand-muted">
                {filteredCcspItems.length} {filteredCcspItems.length === 1 ? 'recreador' : 'recreadores'}
              </span>
            </div>


          </div>

          {filteredCcspItems.length === 0 ? (
            <div className="bg-brand-card/60 border border-brand-border rounded-2xl p-8 text-center text-brand-muted">
              <p className="text-sm font-medium">
                Nenhum pagamento CCSP encontrado para os filtros selecionados em {capitalizedMonth}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCcspItems.map(item => {
                const emp = item.employee;
                const isItemProcessing = isProcessing === `ccsp-${emp.id}-${currentMonthCcspKey}`;

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all duration-200 shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden",
                      item.isPaid 
                        ? "bg-emerald-950/15 border-emerald-500/30 hover:border-emerald-500/50" 
                        : "bg-brand-card border-brand-border hover:border-brand-primary/30"
                    )}
                  >
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-brand-primary">
                              {emp.artisticName?.slice(0, 2).toUpperCase() || 'LP'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-sm sm:text-base text-brand-text leading-tight">
                              {emp.artisticName}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand-bg border border-brand-border text-brand-muted">
                              {emp.level}
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-muted leading-tight mt-0.5">
                            {emp.name}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1",
                        item.isPaid 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      )}>
                        {item.isPaid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {item.isPaid ? 'Quitado' : 'Pendente'}
                      </span>
                    </div>

                    {/* Dados de Diárias e Valores */}
                    <div className="bg-brand-bg/60 rounded-xl p-3 border border-brand-border/60 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-brand-muted font-semibold block">
                          Diárias Trabalhadas (CCSP)
                        </span>
                        <span className="text-xs font-bold text-brand-text">
                          {item.daysCount} {item.daysCount === 1 ? 'dia' : 'dias'} × {formatCurrency(emp.dailyRate)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-brand-muted uppercase font-bold block">
                          Valor a Pagar
                        </span>
                        <span className={cn(
                          "text-base sm:text-lg font-black",
                          item.isPaid ? "text-emerald-400" : "text-brand-primary"
                        )}>
                          {formatCurrency(item.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Dados Bancários & PIX com Copiar em 1 Clique */}
                    <div className="bg-slate-900/60 rounded-xl p-2.5 border border-brand-border/40 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-gray-300 truncate">
                          <CreditCard size={13} className="text-brand-primary shrink-0" />
                          <span className="font-bold text-[11px] text-gray-400">
                            PIX ({emp.pixType?.toUpperCase() || 'CHAVE'}):
                          </span>
                          <span className="font-mono text-brand-text truncate font-semibold">
                            {emp.pixKey || 'Chave não cadastrada'}
                          </span>
                        </div>

                        {emp.pixKey && (
                          <button
                            onClick={() => handleCopyPix(emp.pixKey!, item.id)}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 border",
                              copiedKey === item.id 
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" 
                                : "bg-brand-card hover:bg-brand-primary/10 border-brand-border text-gray-300 hover:text-white"
                            )}
                            title="Copiar chave PIX"
                          >
                            {copiedKey === item.id ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedKey === item.id ? 'Copiado!' : 'Copiar PIX'}</span>
                          </button>
                        )}
                      </div>

                      {(emp.pixBank || emp.pixOwnerName) && (
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 pl-4">
                          {emp.pixBank && <span>Banco: <strong className="text-gray-300">{emp.pixBank}</strong></span>}
                          {emp.pixBank && emp.pixOwnerName && <span>•</span>}
                          {emp.pixOwnerName && <span>Titular: <strong className="text-gray-300">{emp.pixOwnerName}</strong></span>}
                        </div>
                      )}
                    </div>

                    {/* Ações: Alternar Quitação */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {onViewStory && (
                        <button
                          onClick={() => onViewStory(emp)}
                          className="text-[11px] font-bold text-gray-400 hover:text-brand-primary flex items-center gap-1 transition-colors"
                        >
                          <User size={12} />
                          <span>Ver História</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleCCSPPayment(emp, item.isPaid)}
                        disabled={isItemProcessing}
                        className={cn(
                          "ml-auto px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50",
                          item.isPaid
                            ? "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/20"
                        )}
                      >
                        {item.isPaid ? <CheckCircle2 size={14} /> : <Check size={14} />}
                        <span>{item.isPaid ? 'MARCADO COMO PAGO' : 'CONFIRMAR PAGAMENTO'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 2: Festas & Eventos (Previsão: 7 dias após o evento) */}
      {(typeFilter === 'all' || typeFilter === 'parties') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 px-1">
            <PartyPopper className="text-pink-400" size={18} />
            <h3 className="text-base sm:text-lg font-black text-brand-text">
              Festas & Eventos — Prazo de Pagamento (7 dias após o evento)
            </h3>
            <span className="text-xs font-bold bg-brand-card border border-brand-border px-2 py-0.5 rounded-full text-brand-muted">
              {filteredPartyItems.length} {filteredPartyItems.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>

          {filteredPartyItems.length === 0 ? (
            <div className="bg-brand-card/60 border border-brand-border rounded-2xl p-8 text-center text-brand-muted">
              <p className="text-sm font-medium">
                Nenhuma festa ou evento encontrado para os filtros selecionados em {capitalizedMonth}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPartyItems.map(item => {
                const emp = item.employee;
                const isItemProcessing = isProcessing === `party-${emp.id}-${item.dueDateStr}`;
                const isDueDatePast = isBefore(parseISO(item.dueDateStr), new Date());

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all duration-200 shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden",
                      item.isPaid 
                        ? "bg-emerald-950/15 border-emerald-500/30 hover:border-emerald-500/50" 
                        : "bg-brand-card border-brand-border hover:border-pink-500/30"
                    )}
                  >
                    {/* Header do Card da Festa */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-pink-400">
                              {emp.artisticName?.slice(0, 2).toUpperCase() || 'LP'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-sm sm:text-base text-brand-text leading-tight">
                              {emp.artisticName}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                              Festa
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-muted leading-tight mt-0.5">
                            {emp.name}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1",
                        item.isPaid 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      )}>
                        {item.isPaid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {item.isPaid ? 'Quitado' : 'Pendente'}
                      </span>
                    </div>

                    {/* Dados do Evento e Datas */}
                    <div className="bg-brand-bg/60 rounded-xl p-3 border border-brand-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-semibold">Evento:</span>
                        <strong className="text-brand-text font-bold">{item.partyName}</strong>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-semibold">Realizada em:</span>
                        <span className="text-gray-300 font-medium">{item.partyDateFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-border/40">
                        <span className="text-gray-400 font-semibold flex items-center gap-1">
                          <Clock size={12} className="text-brand-primary" />
                          Previsão Pgto (7d):
                        </span>
                        <strong className={cn(
                          "font-bold",
                          item.isPaid ? "text-emerald-400" : isDueDatePast ? "text-amber-400" : "text-brand-text"
                        )}>
                          {item.dueDateFormatted}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-border/40">
                        <span className="text-gray-400 font-semibold">Valor do Cachê:</span>
                        <strong className="text-base font-black text-brand-primary">
                          {formatCurrency(item.amount)}
                        </strong>
                      </div>
                    </div>

                    {/* Chave PIX */}
                    <div className="bg-slate-900/60 rounded-xl p-2.5 border border-brand-border/40 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-gray-300 truncate">
                          <CreditCard size={13} className="text-pink-400 shrink-0" />
                          <span className="font-bold text-[11px] text-gray-400">
                            PIX ({emp.pixType?.toUpperCase() || 'CHAVE'}):
                          </span>
                          <span className="font-mono text-brand-text truncate font-semibold">
                            {emp.pixKey || 'Chave não cadastrada'}
                          </span>
                        </div>

                        {emp.pixKey && (
                          <button
                            onClick={() => handleCopyPix(emp.pixKey!, item.id)}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 border",
                              copiedKey === item.id 
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" 
                                : "bg-brand-card hover:bg-brand-primary/10 border-brand-border text-gray-300 hover:text-white"
                            )}
                            title="Copiar chave PIX"
                          >
                            {copiedKey === item.id ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedKey === item.id ? 'Copiado!' : 'Copiar PIX'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {onViewStory && (
                        <button
                          onClick={() => onViewStory(emp)}
                          className="text-[11px] font-bold text-gray-400 hover:text-brand-primary flex items-center gap-1 transition-colors"
                        >
                          <User size={12} />
                          <span>Ver História</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTogglePartyPayment(emp, item.dueDateStr, item.isPaid)}
                        disabled={isItemProcessing}
                        className={cn(
                          "ml-auto px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50",
                          item.isPaid
                            ? "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/20"
                        )}
                      >
                        {item.isPaid ? <CheckCircle2 size={14} /> : <Check size={14} />}
                        <span>{item.isPaid ? 'MARCADO COMO PAGO' : 'CONFIRMAR PAGAMENTO'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
