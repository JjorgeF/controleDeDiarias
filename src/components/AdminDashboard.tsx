import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, WorkDay } from '../types';
import { 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Award, 
  History, 
  Activity, 
  Sparkles,
  Search,
  CheckCircle2,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface AdminDashboardProps {
  employees: Employee[];
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  dayConfigs?: Record<string, { isCommon: boolean; isParty: boolean; partyTime?: string }>;
}

interface AccessLog {
  id: string;
  email: string;
  name: string;
  timestamp: string;
}

export default function AdminDashboard({ employees, currentMonth, setCurrentMonth, dayConfigs = {} }: AdminDashboardProps) {
  const [cancellationsLogs, setCancellationsLogs] = useState<AccessLog[]>([]);
  const [adminSettingsLogs, setAdminSettingsLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [rankMetric, setRankMetric] = useState<'confirmed' | 'availabilities' | 'cancellations'>('confirmed');
  const [rankPeriod, setRankPeriod] = useState<'monthly' | 'allTime'>('monthly');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const currentMonthKey = format(currentMonth, 'yyyy-MM');

  const getDayConfig = (dateStr: string) => {
    const config = dayConfigs?.[dateStr];
    if (config) {
      return {
        isCommon: !!config.isCommon,
        isParty: !!config.isParty,
        partyTime: config.partyTime || '',
      };
    }

    const hasCommonWorkers = employees.some(emp => 
      emp.workDays?.some(d => d.date === dateStr && d.type === 'common' && !d.isCancelled)
    );
    const hasPartyWorkers = employees.some(emp => 
      emp.workDays?.some(d => d.date === dateStr && d.type === 'party' && !d.isCancelled)
    );
    
    const hasPastAvailabilities = employees.some(emp => 
      emp.availabilities?.some(av => av === dateStr || av === `${dateStr}_common`)
    );
    const hasPastPartyAvailabilities = employees.some(emp => 
      emp.availabilities?.some(av => av === `${dateStr}_party`)
    );

    if (hasCommonWorkers || hasPartyWorkers || hasPastAvailabilities || hasPastPartyAvailabilities) {
      return {
        isCommon: hasCommonWorkers || hasPastAvailabilities || (!hasPartyWorkers && !hasPastPartyAvailabilities),
        isParty: hasPartyWorkers || hasPastPartyAvailabilities,
        partyTime: '',
      };
    }

    return { isCommon: false, isParty: false, partyTime: '' };
  };

  // Load access logs
  useEffect(() => {
    if (!db) {
      setLoadingLogs(false);
      return;
    }

    let unsubscribeCancellations = () => {};
    let unsubscribeSettings = () => {};
    let completedCancellations = false;
    let completedSettings = false;

    const checkLoading = () => {
      if (completedCancellations && completedSettings) {
        setLoadingLogs(false);
      }
    };

    // 1. Listen to cancellations collection for access logs (which isSignedIn users can access)
    try {
      const qCancel = query(collection(db, 'cancellations'));
      unsubscribeCancellations = onSnapshot(qCancel, (snapshot) => {
        const logs: AccessLog[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.type === 'access_log') {
            logs.push({
              id: doc.id,
              email: data.email || '',
              name: data.name || '',
              timestamp: data.timestamp || new Date().toISOString()
            });
          }
        });
        setCancellationsLogs(logs);
        completedCancellations = true;
        checkLoading();
      }, (error) => {
        console.warn("Permission restricted for loading access logs from cancellations:", error);
        completedCancellations = true;
        checkLoading();
      });
    } catch (err) {
      console.warn("Error setting up cancellations logs listener:", err);
      completedCancellations = true;
      checkLoading();
    }

    // 2. Listen to settings/access_logs (admin logs)
    try {
      const settingsRef = doc(db, 'settings', 'access_logs');
      unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
        const logs: AccessLog[] = [];
        if (docSnap.exists()) {
          const data = docSnap.data();
          Object.entries(data).forEach(([logId, logVal]: [string, any]) => {
            if (logVal && typeof logVal === 'object') {
              logs.push({
                id: logId,
                email: logVal.email || '',
                name: logVal.name || '',
                timestamp: logVal.timestamp || new Date().toISOString()
              });
            }
          });
        }
        setAdminSettingsLogs(logs);
        completedSettings = true;
        checkLoading();
      }, (error) => {
        console.warn("Permission restricted for loading access logs from settings:", error);
        completedSettings = true;
        checkLoading();
      });
    } catch (err) {
      console.warn("Error setting up settings logs listener:", err);
      completedSettings = true;
      checkLoading();
    }

    // Backup safety timeout to hide loader
    const timeout = setTimeout(() => {
      setLoadingLogs(false);
    }, 2000);

    return () => {
      unsubscribeCancellations();
      unsubscribeSettings();
      clearTimeout(timeout);
    };
  }, []);

  // 3. Extract logins directly from employees prop (reactive, zero-DB read, 100% bypass of permission blocks)
  const employeeLogs = useMemo(() => {
    const logs: AccessLog[] = [];
    employees.forEach(emp => {
      const avails = emp.availabilities || [];
      avails.forEach(av => {
        if (av.startsWith('login_')) {
          const timestamp = av.substring('login_'.length);
          logs.push({
            id: `${emp.id}_${timestamp}`,
            email: emp.email || '',
            name: emp.artisticName || emp.name,
            timestamp: timestamp
          });
        }
      });
    });
    return logs;
  }, [employees]);

  // Merge, de-duplicate and sort all three log sources
  const accessLogs = useMemo(() => {
    const all = [...cancellationsLogs, ...adminSettingsLogs, ...employeeLogs];
    const seen = new Set<string>();
    const unique: AccessLog[] = [];
    
    const sorted = all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    sorted.forEach(log => {
      const key = log.email.trim().toLowerCase(); // Deduplicate by email so only the latest login remains
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(log);
      }
    });
    
    return unique;
  }, [cancellationsLogs, adminSettingsLogs, employeeLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return accessLogs;
    const lower = logSearchQuery.toLowerCase();
    return accessLogs.filter(log => 
      log.name.toLowerCase().includes(lower) || 
      log.email.toLowerCase().includes(lower)
    );
  }, [accessLogs, logSearchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    
    // Total work days scheduled across all employees this month
    let totalScheduledDaysThisMonth = 0;
    let totalAvailabilitiesThisMonth = 0;

    employees.forEach(emp => {
      // Confirmed days in this month
      const monthWorkDays = emp.workDays?.filter(d => 
        d.date.startsWith(currentMonthKey) && !d.isCancelled
      ) || [];
      totalScheduledDaysThisMonth += monthWorkDays.length;

      // Availabilities in this month (filtering for active configs only)
      const monthAvailabilities = emp.availabilities?.filter(dateStr => {
        if (!dateStr.startsWith(currentMonthKey)) return false;
        if (dateStr.startsWith('login_')) return false;

        const datePart = dateStr.includes('_') ? dateStr.split('_')[0] : dateStr;
        const config = getDayConfig(datePart);
        const isPartyAvail = dateStr.endsWith('_party');
        if (isPartyAvail) {
          return config.isParty;
        } else {
          return config.isCommon;
        }
      }) || [];
      totalAvailabilitiesThisMonth += monthAvailabilities.length;
    });

    return {
      totalEmployees,
      totalScheduledDaysThisMonth,
      totalAvailabilitiesThisMonth,
    };
  }, [employees, currentMonthKey, dayConfigs]);

  // Ranking data
  const rankingData = useMemo(() => {
    const data = employees.map(emp => {
      const confirmedThisMonth = emp.workDays?.filter(d => 
        d.date.startsWith(currentMonthKey) && !d.isCancelled
      ).length || 0;

      const cancellationsThisMonthList = emp.workDays?.filter(d => 
        d.date.startsWith(currentMonthKey) && d.isCancelled
      ) || [];
      const cancellationsThisMonth = cancellationsThisMonthList.length;

      // Track exact dates with active/inactive state
      const activeAvails: { day: string; type: 'common' | 'party' }[] = [];
      const inactiveAvails: { day: string; type: 'common' | 'party' }[] = [];

      emp.availabilities?.forEach(dateStr => {
        if (!dateStr.startsWith(currentMonthKey)) return;
        if (dateStr.startsWith('login_')) return;

        const datePart = dateStr.includes('_') ? dateStr.split('_')[0] : dateStr;
        const config = getDayConfig(datePart);
        const isParty = dateStr.endsWith('_party');
        const isActive = isParty ? config.isParty : config.isCommon;
        const dayNum = datePart.split('-')[2];

        if (isActive) {
          activeAvails.push({ day: dayNum, type: isParty ? 'party' : 'common' });
        } else {
          inactiveAvails.push({ day: dayNum, type: isParty ? 'party' : 'common' });
        }
      });

      const availabilitiesThisMonth = activeAvails.length;

      const totalConfirmedAllTime = emp.workDays?.filter(d => !d.isCancelled).length || 0;
      const totalCancellationsAllTime = emp.workDays?.filter(d => d.isCancelled).length || 0;
      
      const totalAvailabilitiesAllTime = emp.availabilities?.filter(dateStr => {
        if (dateStr.startsWith('login_')) return false;

        const datePart = dateStr.includes('_') ? dateStr.split('_')[0] : dateStr;
        const config = getDayConfig(datePart);
        const isPartyAvail = dateStr.endsWith('_party');
        if (isPartyAvail) {
          return config.isParty;
        } else {
          return config.isCommon;
        }
      }).length || 0;

      return {
        id: emp.id,
        name: emp.name,
        artisticName: emp.artisticName || emp.name,
        level: emp.level,
        confirmedThisMonth,
        availabilitiesThisMonth,
        cancellationsThisMonth,
        totalConfirmedAllTime,
        totalAvailabilitiesAllTime,
        totalCancellationsAllTime,
        activeAvails: activeAvails.sort((a, b) => a.day.localeCompare(b.day)),
        inactiveAvails: inactiveAvails.sort((a, b) => a.day.localeCompare(b.day)),
        monthCancellations: cancellationsThisMonthList.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    // Sort based on the selected metric and period
    if (rankPeriod === 'monthly') {
      if (rankMetric === 'confirmed') {
        return [...data].sort((a, b) => b.confirmedThisMonth - a.confirmedThisMonth || b.totalConfirmedAllTime - a.totalConfirmedAllTime);
      } else if (rankMetric === 'availabilities') {
        return [...data].sort((a, b) => b.availabilitiesThisMonth - a.availabilitiesThisMonth || b.totalAvailabilitiesAllTime - a.totalAvailabilitiesAllTime);
      } else {
        return [...data].sort((a, b) => b.cancellationsThisMonth - a.cancellationsThisMonth || b.totalCancellationsAllTime - a.totalCancellationsAllTime);
      }
    } else {
      if (rankMetric === 'confirmed') {
        return [...data].sort((a, b) => b.totalConfirmedAllTime - a.totalConfirmedAllTime || b.confirmedThisMonth - a.confirmedThisMonth);
      } else if (rankMetric === 'availabilities') {
        return [...data].sort((a, b) => b.totalAvailabilitiesAllTime - a.totalAvailabilitiesAllTime || b.availabilitiesThisMonth - a.availabilitiesThisMonth);
      } else {
        return [...data].sort((a, b) => b.totalCancellationsAllTime - a.totalCancellationsAllTime || b.cancellationsThisMonth - a.cancellationsThisMonth);
      }
    }
  }, [employees, currentMonthKey, rankMetric, rankPeriod, dayConfigs]);

  const maxMetricValue = useMemo(() => {
    if (rankingData.length === 0) return 1;
    return Math.max(
      ...rankingData.map(item => {
        if (rankPeriod === 'monthly') {
          if (rankMetric === 'confirmed') return item.confirmedThisMonth;
          if (rankMetric === 'availabilities') return item.availabilitiesThisMonth;
          return item.cancellationsThisMonth;
        } else {
          if (rankMetric === 'confirmed') return item.totalConfirmedAllTime;
          if (rankMetric === 'availabilities') return item.totalAvailabilitiesAllTime;
          return item.totalCancellationsAllTime;
        }
      }),
      1
    );
  }, [rankingData, rankMetric, rankPeriod]);

  const formatLogTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      const relative = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
      const absolute = format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
      return { relative, absolute };
    } catch (e) {
      return { relative: 'agora pouco', absolute: '' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-brand-primary" size={24} />
            <h2 className="text-2xl font-black text-white tracking-wide font-playful">
              Painel de Administração e Auditoria
            </h2>
          </div>
          <p className="text-sm text-gray-400 font-semibold">
            Visualização consolidada de métricas, rankings de dedicação e controle de acessos em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-brand-bg/60 border border-brand-border p-2 rounded-xl">
          <div className="flex items-center gap-1 bg-brand-bg border border-brand-border rounded-lg p-1 shrink-0">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white"
              title="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white"
              title="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="text-right pr-2">
            <span className="block text-[10px] uppercase tracking-wider font-extrabold text-gray-500">Mês de Auditoria</span>
            <span className="text-sm font-black text-white capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Stat 1 */}
        <div className="bg-gradient-to-br from-brand-card to-brand-card/50 p-6 rounded-2xl border border-brand-border hover:border-brand-primary/25 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Total de Recriadores</span>
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary group-hover:scale-110 duration-200">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{stats.totalEmployees}</span>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Colaboradores ativos cadastrados</p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-gradient-to-br from-brand-card to-brand-card/50 p-6 rounded-2xl border border-brand-border hover:border-brand-primary/25 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Escalas Confirmadas (Mês)</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 duration-200">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-emerald-400">{stats.totalScheduledDaysThisMonth}</span>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Dias de trabalho agendados neste mês</p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-gradient-to-br from-brand-card to-brand-card/50 p-6 rounded-2xl border border-brand-border hover:border-brand-primary/25 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Disponibilidades Dadas (Mês)</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 duration-200">
              <CalendarDays size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-purple-400">{stats.totalAvailabilitiesThisMonth}</span>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Datas de disponibilidade enviadas</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Rankings (8 cols) */}
        <div className="lg:col-span-7 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md flex flex-col h-fit">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-brand-border/60 mb-6">
            <div className="flex items-center gap-2.5">
              <Award className="text-brand-primary" size={20} />
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider font-playful">
                  Ranking de Dedicação
                </h3>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
                  Ordenado por: {rankPeriod === 'monthly' ? 'Mês Selecionado' : 'Acumulado Geral'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Period Selector (Mensal vs Geral) */}
              <div className="flex bg-brand-bg/60 p-1 rounded-xl border border-brand-border">
                <button
                  onClick={() => setRankPeriod('monthly')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankPeriod === 'monthly' 
                      ? "bg-white/10 text-white border border-white/10 shadow-sm" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setRankPeriod('allTime')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankPeriod === 'allTime' 
                      ? "bg-white/10 text-white border border-white/10 shadow-sm" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Geral
                </button>
              </div>

              {/* Metric Selector (Dias Agendados vs Disponibilidades vs Desistências) */}
              <div className="flex bg-brand-bg/60 p-1 rounded-xl border border-brand-border flex-wrap gap-1">
                <button
                  onClick={() => setRankMetric('confirmed')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankMetric === 'confirmed' 
                      ? "bg-brand-primary text-brand-bg shadow-md" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Dias Agendados
                </button>
                <button
                  onClick={() => setRankMetric('availabilities')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankMetric === 'availabilities' 
                      ? "bg-purple-500 text-white shadow-md" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Disponibilidades
                </button>
                <button
                  onClick={() => setRankMetric('cancellations')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankMetric === 'cancellations' 
                      ? "bg-rose-500 text-white shadow-md" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  Desistências
                </button>
              </div>
            </div>
          </div>

          {/* Ranking list */}
          <div className="space-y-5">
            {rankingData.map((item, index) => {
              const currentValue = rankMetric === 'confirmed' 
                ? item.confirmedThisMonth 
                : rankMetric === 'availabilities' 
                  ? item.availabilitiesThisMonth 
                  : item.cancellationsThisMonth;

              const allTimeValue = rankMetric === 'confirmed' 
                ? item.totalConfirmedAllTime 
                : rankMetric === 'availabilities' 
                  ? item.totalAvailabilitiesAllTime 
                  : item.totalCancellationsAllTime;
              
              const activeValue = rankPeriod === 'monthly' ? currentValue : allTimeValue;
              const percentage = Math.max((activeValue / maxMetricValue) * 100, 2); // At least 2% so bar is visible

              // Rank Badge background
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              return (
                <div key={item.id} className="group relative flex items-center gap-4 p-3.5 rounded-xl bg-brand-bg/40 border border-brand-border/40 hover:border-brand-primary/20 hover:bg-brand-bg/80 transition-all duration-200">
                  {/* Position number / medal */}
                  <div className={cn(
                    "w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-black text-sm",
                    isFirst ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 scale-110" :
                    isSecond ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" :
                    isThird ? "bg-amber-700/20 text-amber-500 border border-amber-700/30" :
                    "bg-brand-card text-gray-500 border border-brand-border/60"
                  )}>
                    {isFirst ? "🥇" : isSecond ? "🥈" : isThird ? "🥉" : index + 1}
                  </div>

                  {/* Avatar Initials */}
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center font-extrabold text-sm text-brand-primary uppercase shrink-0">
                    {item.artisticName.substring(0, 2)}
                  </div>

                  {/* Name and Bar details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <div className="truncate">
                        <span className="text-sm font-bold text-white">{item.artisticName}</span>
                        <span className="ml-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{item.level}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={cn(
                          "text-sm font-black",
                          rankMetric === 'confirmed' ? "text-brand-primary" : 
                          rankMetric === 'availabilities' ? "text-purple-400" : "text-rose-400"
                        )}>
                          {activeValue} {
                            rankMetric === 'confirmed' 
                              ? (activeValue === 1 ? 'dia' : 'dias') 
                              : rankMetric === 'availabilities' 
                                ? 'disps' 
                                : (activeValue === 1 ? 'desistência' : 'desistências')
                          }
                        </span>
                        <span className="block text-[9px] font-semibold text-gray-500 mt-0.5">
                          {rankPeriod === 'monthly' ? `Acumulado: ${allTimeValue}` : `No mês: ${currentValue}`}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-brand-card rounded-full overflow-hidden border border-brand-border/40">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          rankMetric === 'confirmed' 
                            ? "bg-gradient-to-r from-brand-primary/60 to-brand-primary shadow-[0_0_8px_rgba(251,191,36,0.3)]" 
                            : rankMetric === 'availabilities'
                              ? "bg-gradient-to-r from-purple-500/60 to-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]"
                              : "bg-gradient-to-r from-rose-500/60 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Micro-lista de datas para depuração transparente */}
                    {rankMetric === 'availabilities' && (item.activeAvails.length > 0 || item.inactiveAvails.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px]">
                        {item.activeAvails.map((av, idx) => (
                          <span 
                            key={`act-${idx}`} 
                            className={cn(
                              "px-1.5 py-0.5 rounded font-black border text-[9px] flex items-center gap-0.5",
                              av.type === 'party' 
                                ? "bg-purple-500/10 border-purple-500/20 text-purple-300" 
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            )}
                            title={av.type === 'party' ? `Disponibilidade de Festa para dia ${av.day}` : `Disponibilidade de CCSP para dia ${av.day}`}
                          >
                            Dia {av.day} {av.type === 'party' ? '🎉' : '🏢'}
                          </span>
                        ))}
                        {item.inactiveAvails.map((av, idx) => (
                          <span 
                            key={`inact-${idx}`} 
                            className="px-1.5 py-0.5 rounded font-black bg-gray-500/5 border border-gray-500/10 text-gray-500 line-through text-[9px]"
                            title={`Registrou para o dia ${av.day}, mas este dia não está ativo no calendário (CCSP/Festa)`}
                          >
                            Dia {av.day} (Inativo)
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Micro-lista de desistências para transparência */}
                    {rankMetric === 'cancellations' && item.monthCancellations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px]">
                        {item.monthCancellations.map((c, idx) => {
                          const dayNum = c.date.split('-')[2];
                          return (
                            <span 
                              key={`canc-${idx}`} 
                              className="px-1.5 py-0.5 rounded font-black border border-rose-500/20 bg-rose-500/10 text-rose-400 text-[9px] flex items-center gap-0.5"
                              title={`Desistência de ${c.type === 'party' ? 'Festa' : 'CCSP'} para o dia ${dayNum}`}
                            >
                              Dia {dayNum} {c.type === 'party' ? '🎉' : '🏢'}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {rankingData.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-xl">
                <p className="text-gray-500 font-semibold text-sm">Nenhum funcionário cadastrado para o ranking.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Access Logs (5 cols) */}
        <div className="lg:col-span-5 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md flex flex-col h-[650px]">
          <div className="pb-5 border-b border-brand-border/60 mb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <History className="text-purple-400" size={20} />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider font-playful">
                Últimos Acessos e Logins
              </h3>
            </div>

            {/* Search filter for logs */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text"
                placeholder="Buscar logs por email ou nome..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full bg-brand-bg/80 border border-brand-border/80 rounded-xl py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-primary transition-colors text-white font-medium"
              />
            </div>
          </div>

          {/* Logs timeline */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center gap-2">
                <div className="w-8 h-8 rounded-full border-4 border-brand-primary border-t-transparent animate-spin" />
                <span className="text-xs text-gray-500 font-bold">Carregando logs de auditoria...</span>
              </div>
            ) : filteredLogs.map((log) => {
              const { relative, absolute } = formatLogTime(log.timestamp);
              return (
                <div key={log.id} className="group flex gap-3.5 p-3 rounded-xl bg-brand-bg/30 border border-brand-border/40 hover:bg-brand-bg/60 transition-colors">
                  {/* Initials badge */}
                  <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                    {log.name.substring(0, 2)}
                  </div>

                  {/* details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs font-bold text-white truncate">{log.name}</span>
                      <span className="text-[9px] font-black uppercase text-brand-primary tracking-wider bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded shrink-0">
                        Acesso OK
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{log.email}</p>
                    
                    <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-brand-border/20 text-[10px] text-gray-500 font-semibold">
                      <Clock size={11} className="text-purple-400" />
                      <span className="text-purple-300" title={absolute}>{relative}</span>
                      <span className="text-gray-600">•</span>
                      <span className="truncate max-w-[140px]" title={absolute}>{format(parseISO(log.timestamp), 'dd/MM/yy HH:mm')}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loadingLogs && filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-2">
                <AlertCircle className="text-gray-500" size={24} />
                <p className="text-xs text-gray-500 font-bold">Nenhum log de acesso encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
