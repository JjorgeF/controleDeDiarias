import React, { useState, useMemo } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { AnimatedCurrency } from './AnimatedCurrency';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Award, 
  BarChart2, 
  Briefcase, 
  PieChart as PieChartIcon, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Medal, 
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { Employee, DayConfig, Promotion } from '../types';

function getEffectiveEmp(emp: Employee) {
  return emp;
}

interface KpisViewProps {
  employees: Employee[];
  monthConfigs: Record<string, DayConfig>;
  promotions?: Promotion[];
  currentMonth: Date;
}

const LEVEL_COLORS: Record<string, string> = {
  'Trainee': '#94a3b8',
  'Aprendiz': '#38bdf8',
  'Recreador(a)': '#c093ff',
  'Recreador(a) Experiente': '#f59e0b',
  'Coordenador(a)': '#06b6d4',
  'Motorista': '#10b981'
};

export function KpisView({ employees, monthConfigs, promotions = [], currentMonth: initialMonth }: KpisViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonth || new Date());

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handlePrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setSelectedMonth(new Date());

  const monthKey = format(selectedMonth, 'yyyy-MM');
  const selectedMonthName = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    let totalCcspDays = 0;
    let totalPartyDays = 0;
    let totalExtraHours = 0;
    let totalCcspCost = 0;
    let totalPartyCost = 0;
    let totalExtraHoursCost = 0;

    const levelCounts: Record<string, number> = {
      'Trainee': 0,
      'Aprendiz': 0,
      'Recreador(a)': 0,
      'Recreador(a) Experiente': 0,
      'Coordenador(a)': 0,
      'Motorista': 0
    };

    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];

    const empRankings: Array<{
      employee: Employee;
      ccspCount: number;
      partyCount: number;
      extraHours: number;
      totalCost: number;
      effectiveLevel: string;
    }> = [];

    const dayStatsMap: Record<string, {
      dateStr: string;
      formattedDate: string;
      workerCount: number;
      ccspCount: number;
      partyCount: number;
      extraHours: number;
      totalCost: number;
      isExtraordinary: boolean;
    }> = {};

    daysInMonth.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const cfg = monthConfigs[dStr];
      dayStatsMap[dStr] = {
        dateStr: dStr,
        formattedDate: format(day, "dd 'de' MMM (eee)", { locale: ptBR }),
        workerCount: 0,
        ccspCount: 0,
        partyCount: 0,
        extraHours: 0,
        totalCost: 0,
        isExtraordinary: !!cfg?.isExtraordinaryOpen
      };
    });

    employees.forEach(emp => {
      const effectiveEmp = getEffectiveEmp(emp);
      let empCcsp = 0;
      let empParty = 0;
      let empExtra = 0;
      let empCost = 0;

      (effectiveEmp.workDays || []).forEach(wd => {
        if (!wd.date.startsWith(monthKey)) return;

        const dayOfWeek = getDay(new Date(wd.date + 'T12:00:00'));
        dayOfWeekCounts[dayOfWeek]++;

        const level = wd.levelAtTime || effectiveEmp.level || 'Trainee';
        if (levelCounts[level] !== undefined) {
          levelCounts[level]++;
        } else {
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        }

        const dailyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
          ? wd.customTotalPay
          : (wd.dailyRateAtTime !== undefined ? wd.dailyRateAtTime : (effectiveEmp.dailyRate || 0));
        const partyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
          ? wd.customTotalPay
          : (wd.partyRateAtTime !== undefined ? wd.partyRateAtTime : (effectiveEmp.partyRate || 0));
        const extraRate = wd.extraHourRateAtTime !== undefined ? wd.extraHourRateAtTime : (effectiveEmp.extraHourRate || 0);

        let dayCost = 0;
        if (wd.type === 'common') {
          totalCcspDays++;
          empCcsp++;
          totalCcspCost += dailyRate;
          dayCost += dailyRate;
        } else if (wd.type === 'party') {
          totalPartyDays++;
          empParty++;
          totalPartyCost += partyRate;
          dayCost += partyRate;
        }

        if (wd.extraHours && wd.extraHours > 0) {
          totalExtraHours += wd.extraHours;
          empExtra += wd.extraHours;
          const eCost = wd.extraHours * extraRate;
          totalExtraHoursCost += eCost;
          dayCost += eCost;
        }

        empCost += dayCost;

        if (dayStatsMap[wd.date]) {
          dayStatsMap[wd.date].workerCount++;
          if (wd.type === 'common') dayStatsMap[wd.date].ccspCount++;
          if (wd.type === 'party') dayStatsMap[wd.date].partyCount++;
          dayStatsMap[wd.date].extraHours += (wd.extraHours || 0);
          dayStatsMap[wd.date].totalCost += dayCost;
        }
      });

      if (empCcsp > 0 || empParty > 0 || empExtra > 0) {
        empRankings.push({
          employee: emp,
          ccspCount: empCcsp,
          partyCount: empParty,
          extraHours: empExtra,
          totalCost: empCost,
          effectiveLevel: effectiveEmp.level
        });
      }
    });

    empRankings.sort((a, b) => b.totalCost - a.totalCost);

    const peakDays = Object.values(dayStatsMap)
      .filter(d => d.workerCount > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    const totalScheduled = totalCcspDays + totalPartyDays;
    const totalGrandCost = totalCcspCost + totalPartyCost + totalExtraHoursCost;
    const activeWorkersCount = empRankings.length;
    const avgCostPerWorker = activeWorkersCount > 0 ? totalGrandCost / activeWorkersCount : 0;

    return {
      totalCcspDays,
      totalPartyDays,
      totalExtraHours,
      totalCcspCost,
      totalPartyCost,
      totalExtraHoursCost,
      totalGrandCost,
      totalScheduled,
      activeWorkersCount,
      avgCostPerWorker,
      levelCounts,
      dayOfWeekCounts,
      empRankings,
      peakDays
    };
  }, [selectedMonth, employees, monthConfigs, promotions, monthKey]);

  // Comprehensive Comparative Data (Current Month vs Previous Month)
  const comparisonData = useMemo(() => {
    const prevM = subMonths(selectedMonth, 1);
    const prevKey = format(prevM, 'yyyy-MM');
    const prevMonthName = format(prevM, "MMM/yy", { locale: ptBR }).toUpperCase();
    const currentMonthName = format(selectedMonth, "MMM/yy", { locale: ptBR }).toUpperCase();

    let prevCcspDays = 0;
    let prevPartyDays = 0;
    let prevExtraHours = 0;
    let prevCcspCost = 0;
    let prevPartyCost = 0;
    let prevExtraHoursCost = 0;
    const prevActiveEmpIds = new Set<string>();

    employees.forEach(emp => {
      const effectiveEmp = getEffectiveEmp(emp);
      (effectiveEmp.workDays || []).forEach(wd => {
        if (!wd.date.startsWith(prevKey)) return;

        const dailyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
          ? wd.customTotalPay
          : (wd.dailyRateAtTime !== undefined ? wd.dailyRateAtTime : (effectiveEmp.dailyRate || 0));
        const partyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
          ? wd.customTotalPay
          : (wd.partyRateAtTime !== undefined ? wd.partyRateAtTime : (effectiveEmp.partyRate || 0));
        const extraRate = wd.extraHourRateAtTime !== undefined ? wd.extraHourRateAtTime : (effectiveEmp.extraHourRate || 0);

        if (wd.type === 'common') {
          prevCcspDays++;
          prevCcspCost += dailyRate;
          prevActiveEmpIds.add(emp.id);
        } else if (wd.type === 'party') {
          prevPartyDays++;
          prevPartyCost += partyRate;
          prevActiveEmpIds.add(emp.id);
        }

        if (wd.extraHours && wd.extraHours > 0) {
          prevExtraHours += wd.extraHours;
          prevExtraHoursCost += (wd.extraHours * extraRate);
          prevActiveEmpIds.add(emp.id);
        }
      });
    });

    const prevGrandCost = prevCcspCost + prevPartyCost + prevExtraHoursCost;

    const calcPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const diff = ((curr - prev) / prev) * 100;
      const rounded = Math.round(diff);
      return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
    };

    const financialChartData = [
      {
        categoria: 'Total Folha',
        [prevMonthName]: prevGrandCost,
        [currentMonthName]: monthStats.totalGrandCost
      },
      {
        categoria: 'CCSP',
        [prevMonthName]: prevCcspCost,
        [currentMonthName]: monthStats.totalCcspCost
      },
      {
        categoria: 'Festas',
        [prevMonthName]: prevPartyCost,
        [currentMonthName]: monthStats.totalPartyCost
      },
      {
        categoria: 'Extras',
        [prevMonthName]: prevExtraHoursCost,
        [currentMonthName]: monthStats.totalExtraHoursCost
      }
    ];

    return {
      prevMonthName,
      currentMonthName,
      prevCcspDays,
      prevPartyDays,
      prevExtraHours,
      prevGrandCost,
      prevActiveCount: prevActiveEmpIds.size,
      pctCost: calcPct(monthStats.totalGrandCost, prevGrandCost),
      pctCcsp: calcPct(monthStats.totalCcspDays, prevCcspDays),
      pctParty: calcPct(monthStats.totalPartyDays, prevPartyDays),
      pctExtra: calcPct(monthStats.totalExtraHours, prevExtraHours),
      financialChartData
    };
  }, [selectedMonth, employees, monthStats]);

  const prevMonthStats = useMemo(() => {
    return {
      totalGrandCost: comparisonData.prevGrandCost,
      totalScheduled: comparisonData.prevCcspDays + comparisonData.prevPartyDays
    };
  }, [comparisonData]);

  const sixMonthTrend = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = subMonths(selectedMonth, i);
      const mKey = format(mDate, 'yyyy-MM');
      const mName = format(mDate, 'MMM', { locale: ptBR });

      let ccspCost = 0;
      let partyCost = 0;
      let extraCost = 0;

      employees.forEach(emp => {
        const effectiveEmp = getEffectiveEmp(emp);
        (effectiveEmp.workDays || []).forEach(wd => {
          if (!wd.date.startsWith(mKey)) return;

          const dailyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
            ? wd.customTotalPay
            : (wd.dailyRateAtTime !== undefined ? wd.dailyRateAtTime : (effectiveEmp.dailyRate || 0));
          const partyRate = wd.isReducedHours && wd.customTotalPay !== undefined && wd.customTotalPay >= 0
            ? wd.customTotalPay
            : (wd.partyRateAtTime !== undefined ? wd.partyRateAtTime : (effectiveEmp.partyRate || 0));
          const extraRate = wd.extraHourRateAtTime !== undefined ? wd.extraHourRateAtTime : (effectiveEmp.extraHourRate || 0);

          if (wd.type === 'common') ccspCost += dailyRate;
          if (wd.type === 'party') partyCost += partyRate;
          if (wd.extraHours) extraCost += (wd.extraHours * extraRate);
        });
      });

      result.push({
        name: mName.toUpperCase(),
        CCSP: ccspCost,
        Festas: partyCost,
        Extras: extraCost,
        Total: ccspCost + partyCost + extraCost
      });
    }
    return result;
  }, [selectedMonth, employees, promotions]);

  const costDiffPercent = useMemo(() => {
    if (prevMonthStats.totalGrandCost === 0) return monthStats.totalGrandCost > 0 ? 100 : 0;
    return Math.round(((monthStats.totalGrandCost - prevMonthStats.totalGrandCost) / prevMonthStats.totalGrandCost) * 100);
  }, [monthStats.totalGrandCost, prevMonthStats.totalGrandCost]);

  const pieChartData = useMemo(() => {
    return (Object.entries(monthStats.levelCounts) as [string, number][])
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({
        name: level,
        value: count,
        color: LEVEL_COLORS[level] || '#c093ff'
      }));
  }, [monthStats.levelCounts]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days.map((day, idx) => ({
      day,
      escalas: monthStats.dayOfWeekCounts[idx]
    }));
  }, [monthStats.dayOfWeekCounts]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="bg-brand-card rounded-2xl border border-brand-border p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BarChart2 size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-brand-text tracking-tight flex items-center gap-2">
                Painel de Indicadores & KPIs
              </h2>
              <p className="text-xs text-gray-400">
                Análise orçamentária, volume de escalas e desempenho da equipe
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-brand-bg p-1.5 rounded-xl border border-brand-border/80 self-stretch md:self-auto justify-between md:justify-start">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-brand-card rounded-lg text-gray-400 hover:text-brand-text transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-xs font-black text-brand-text uppercase px-3 tracking-wider min-w-[130px] text-center">
            {selectedMonthName}
          </span>

          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-brand-card rounded-lg text-gray-400 hover:text-brand-text transition-colors"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={handleCurrentMonth}
            className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary hover:text-slate-950 transition-all ml-1"
          >
            Mês Atual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-brand-card rounded-2xl border border-brand-border p-5 relative overflow-hidden shadow-2xs"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Investimento Folha</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-brand-text tracking-tight mb-1">
            <AnimatedCurrency value={monthStats.totalGrandCost} />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {costDiffPercent >= 0 ? (
              <span className="flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                <TrendingUp size={12} className="mr-0.5" /> +{costDiffPercent}%
              </span>
            ) : (
              <span className="flex items-center text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded text-[10px]">
                <TrendingDown size={12} className="mr-0.5" /> {costDiffPercent}%
              </span>
            )}
            <span className="text-[10px] text-gray-400">vs. mês anterior</span>
          </div>

          <div className="mt-3 pt-3 border-t border-brand-border/40 grid grid-cols-3 text-[10px] gap-1 text-gray-400">
            <div>
              <span className="block text-emerald-400 font-bold">CCSP</span>
              <AnimatedCurrency value={monthStats.totalCcspCost} />
            </div>
            <div>
              <span className="block text-brand-party font-bold">Festas</span>
              <AnimatedCurrency value={monthStats.totalPartyCost} />
            </div>
            <div>
              <span className="block text-amber-400 font-bold">Extras</span>
              <AnimatedCurrency value={monthStats.totalExtraHoursCost} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-brand-card rounded-2xl border border-brand-border p-5 relative overflow-hidden shadow-2xs"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-party/5 rounded-full blur-2xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Escalas Realizadas</span>
            <span className="p-1.5 rounded-lg bg-brand-party/10 text-brand-party border border-brand-party/20">
              <Briefcase size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-brand-text tracking-tight mb-1 flex items-baseline gap-2">
            {monthStats.totalScheduled}
            <span className="text-xs font-medium text-gray-400">diárias prestadas</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              {monthStats.totalCcspDays} CCSP
            </span>
            <span className="px-1.5 py-0.5 rounded bg-brand-party/10 text-brand-party font-bold border border-brand-party/20">
              {monthStats.totalPartyDays} Festas
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-brand-border/40 text-[10px] text-gray-400 flex items-center justify-between">
            <span>Horas Extras Totais:</span>
            <span className="font-bold text-amber-400">{monthStats.totalExtraHours}h extras</span>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-brand-card rounded-2xl border border-brand-border p-5 relative overflow-hidden shadow-2xs"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Equipe Escalada</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Users size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-brand-text tracking-tight mb-1 flex items-baseline gap-2">
            {monthStats.activeWorkersCount}
            <span className="text-xs font-medium text-gray-400">de {employees.length} no cadastro</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            Taxa de atividade da equipe:{' '}
            <strong className="text-cyan-400 font-bold">
              {employees.length > 0 ? Math.round((monthStats.activeWorkersCount / employees.length) * 100) : 0}%
            </strong>
          </div>

          <div className="mt-3 pt-3 border-t border-brand-border/40 text-[10px] text-gray-400 flex items-center justify-between">
            <span>Ticket Média p/ Recreador:</span>
            <AnimatedCurrency value={monthStats.avgCostPerWorker} className="font-bold text-brand-text" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-brand-card rounded-2xl border border-brand-border p-5 relative overflow-hidden shadow-2xs"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Recreador Destaque</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award size={16} />
            </span>
          </div>
          
          {monthStats.empRankings.length > 0 ? (
            <div>
              <div className="text-base font-black text-brand-text truncate">
                {monthStats.empRankings[0].employee.artisticName || monthStats.empRankings[0].employee.name}
              </div>
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                {monthStats.empRankings[0].effectiveLevel}
              </div>
              <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                  {formatCurrency(monthStats.empRankings[0].totalCost)}
                </span>
                <span>({monthStats.empRankings[0].ccspCount + monthStats.empRankings[0].partyCount} escalas)</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 py-2">Sem escalas neste mês</div>
          )}

          <div className="mt-3 pt-3 border-t border-brand-border/40 text-[10px] text-gray-400 flex items-center justify-between">
            <span>Dias Pico de Trabalho:</span>
            <span className="font-bold text-brand-party">{monthStats.peakDays.length} dias intensos</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-brand-card rounded-2xl border border-brand-border p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-brand-text uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Evolução Financeira (Últimos 6 Meses)
              </h3>
              <p className="text-xs text-gray-400">Comparativo do custo total de folha acumulado</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> CCSP</span>
              <span className="flex items-center gap-1 text-brand-party"><span className="w-2 h-2 rounded-full bg-brand-party" /> Festas</span>
              <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" /> Extras</span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sixMonthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCcsp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorParty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c093ff" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#c093ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                />
                <Area type="monotone" dataKey="CCSP" stroke="#10b981" fillOpacity={1} fill="url(#colorCcsp)" />
                <Area type="monotone" dataKey="Festas" stroke="#c093ff" fillOpacity={1} fill="url(#colorParty)" />
                <Area type="monotone" dataKey="Extras" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-brand-card rounded-2xl border border-brand-border p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-brand-text uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon size={16} className="text-cyan-400" />
              Escalas por Nível
            </h3>
            <p className="text-xs text-gray-400">Proporção de presenças no mês por categoria</p>
          </div>

          {pieChartData.length > 0 ? (
            <div className="h-52 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                    formatter={(val: any) => [`${val} diárias`, 'Qtde']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-xs text-gray-500">
              Nenhuma escala registrada este mês
            </div>
          )}

          <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto pr-1">
            {pieChartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-300 truncate text-[11px] font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-brand-text text-[11px] shrink-0">{item.value} ({Math.round((item.value / monthStats.totalScheduled) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Comparativo Mês Atual vs Mês Anterior */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/60 pb-4">
          <div>
            <h3 className="text-base font-black text-brand-text uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-400" />
              Comparativo de Desempenho ({comparisonData.prevMonthName} vs {comparisonData.currentMonthName})
            </h3>
            <p className="text-xs text-gray-400">
              Análise detalhada do crescimento ou retração de custos e volume de escalas em relação ao mês anterior
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              {comparisonData.prevMonthName}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/30">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
              {comparisonData.currentMonthName}
            </span>
          </div>
        </div>

        {/* Metric Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Comparison Item 1: Total Folha */}
          <div className="p-4 rounded-xl bg-brand-bg/80 border border-brand-border/80 space-y-2">
            <div className="text-[11px] font-bold uppercase text-gray-400 flex items-center justify-between">
              <span>Investimento Folha</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${comparisonData.pctCost.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                {comparisonData.pctCost}
              </span>
            </div>
            <div className="text-xl font-black text-brand-text">
              {formatCurrency(monthStats.totalGrandCost)}
            </div>
            <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-brand-border/40">
              <span>Anterior ({comparisonData.prevMonthName}):</span>
              <span className="font-bold text-gray-300">{formatCurrency(comparisonData.prevGrandCost)}</span>
            </div>
          </div>

          {/* Comparison Item 2: Diárias CCSP */}
          <div className="p-4 rounded-xl bg-brand-bg/80 border border-brand-border/80 space-y-2">
            <div className="text-[11px] font-bold uppercase text-gray-400 flex items-center justify-between">
              <span>Diárias CCSP</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${comparisonData.pctCcsp.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                {comparisonData.pctCcsp}
              </span>
            </div>
            <div className="text-xl font-black text-emerald-400">
              {monthStats.totalCcspDays} <span className="text-xs text-gray-400 font-normal">escalas</span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-brand-border/40">
              <span>Anterior ({comparisonData.prevMonthName}):</span>
              <span className="font-bold text-gray-300">{comparisonData.prevCcspDays} escalas</span>
            </div>
          </div>

          {/* Comparison Item 3: Festas */}
          <div className="p-4 rounded-xl bg-brand-bg/80 border border-brand-border/80 space-y-2">
            <div className="text-[11px] font-bold uppercase text-gray-400 flex items-center justify-between">
              <span>Festas / Eventos</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${comparisonData.pctParty.startsWith('+') ? 'bg-brand-party/10 text-brand-party border border-brand-party/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                {comparisonData.pctParty}
              </span>
            </div>
            <div className="text-xl font-black text-brand-party">
              {monthStats.totalPartyDays} <span className="text-xs text-gray-400 font-normal">eventos</span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-brand-border/40">
              <span>Anterior ({comparisonData.prevMonthName}):</span>
              <span className="font-bold text-gray-300">{comparisonData.prevPartyDays} eventos</span>
            </div>
          </div>

          {/* Comparison Item 4: Horas Extras */}
          <div className="p-4 rounded-xl bg-brand-bg/80 border border-brand-border/80 space-y-2">
            <div className="text-[11px] font-bold uppercase text-gray-400 flex items-center justify-between">
              <span>Horas Extras</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${comparisonData.pctExtra.startsWith('+') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                {comparisonData.pctExtra}
              </span>
            </div>
            <div className="text-xl font-black text-amber-400">
              {monthStats.totalExtraHours}h <span className="text-xs text-gray-400 font-normal">extras</span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-brand-border/40">
              <span>Anterior ({comparisonData.prevMonthName}):</span>
              <span className="font-bold text-gray-300">{comparisonData.prevExtraHours}h extras</span>
            </div>
          </div>
        </div>

        {/* Comparative Chart (BarChart) */}
        <div className="pt-3">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Comparativo Financeiro por Categoria
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData.financialChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="categoria" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                  formatter={(val: any) => [formatCurrency(Number(val) || 0), '']}
                />
                <Bar dataKey={comparisonData.prevMonthName} fill="#64748b" radius={[6, 6, 0, 0]} />
                <Bar dataKey={comparisonData.currentMonthName} fill="#eab308" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
