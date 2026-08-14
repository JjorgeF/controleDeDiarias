import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs,
  doc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, WorkDay, DayConfig } from '../types';
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
  ChevronRight,
  Crown,
  Trophy,
  Database,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  RotateCcw,
  Check
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface AdminDashboardProps {
  employees: Employee[];
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  dayConfigs?: Record<string, DayConfig>;
  onOpenRevertCancellation?: (employeeId?: string, date?: string) => void;
}

interface AccessLog {
  id: string;
  email: string;
  name: string;
  timestamp: string;
}

export default function AdminDashboard({ employees, currentMonth, setCurrentMonth, dayConfigs = {}, onOpenRevertCancellation }: AdminDashboardProps) {
  const [cancellationsLogs, setCancellationsLogs] = useState<AccessLog[]>([]);
  const [adminSettingsLogs, setAdminSettingsLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [rankMetric, setRankMetric] = useState<'confirmed' | 'availabilities' | 'cancellations'>('confirmed');
  const [rankPeriod, setRankPeriod] = useState<'monthly' | 'allTime'>('monthly');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportJSON = async () => {
    setIsExporting(true);
    setBackupMsg(null);
    try {
      if (!db) throw new Error("Firestore não inicializado.");
      
      const empSnap = await getDocs(collection(db, 'employees'));
      const employeesData = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const dayConfigSnap = await getDocs(collection(db, 'dayConfigs'));
      const dayConfigsData = dayConfigSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const cancelSnap = await getDocs(collection(db, 'cancellations'));
      const cancellationsData = cancelSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const backupPayload = {
        exportDate: new Date().toISOString(),
        appName: "Escala Bartenders CCSP",
        counts: {
          employees: employeesData.length,
          dayConfigs: dayConfigsData.length,
          cancellations: cancellationsData.length
        },
        data: {
          employees: employeesData,
          dayConfigs: dayConfigsData,
          cancellations: cancellationsData
        }
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_escala_bartenders_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupMsg({ type: 'success', text: `Backup JSON gerado com sucesso! (${employeesData.length} funcionários salvos)` });
    } catch (err: any) {
      console.error("Erro ao gerar backup JSON:", err);
      setBackupMsg({ type: 'error', text: `Falha ao exportar backup: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["ID", "Nome", "Nome Artistico", "Email", "Telefone", "Nivel", "Status", "Diaria CCSP", "Diaria Festa", "Hora Extra", "Data Inicio"];
      const rows = employees.map(emp => [
        `"${emp.id}"`,
        `"${emp.name || ''}"`,
        `"${emp.artisticName || ''}"`,
        `"${emp.email || ''}"`,
        `"${emp.phone || ''}"`,
        `"${emp.level || ''}"`,
        `"${emp.status || 'active'}"`,
        emp.dailyRate || 0,
        emp.partyRate || 0,
        emp.extraHourRate || 0,
        `"${emp.startDate || ''}"`
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `funcionarios_escala_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupMsg({ type: 'success', text: "Relatório CSV exportado com sucesso para Excel!" });
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: "Erro ao gerar CSV: " + err.message });
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar um arquivo de backup irá gravar os dados salvos de volta no banco de dados Firestore. Deseja prosseguir?")) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    setBackupMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.data || !Array.isArray(parsed.data.employees)) {
          throw new Error("Formato de arquivo de backup inválido. Certifique-se de usar um arquivo .json de backup gerado por este sistema.");
        }

        if (!db) throw new Error("Firestore não conectado.");

        let restoredEmpCount = 0;
        let restoredConfigCount = 0;

        for (const emp of parsed.data.employees) {
          if (emp.id) {
            const { id, ...dataToSave } = emp;
            await setDoc(doc(db, 'employees', id), dataToSave, { merge: true });
            restoredEmpCount++;
          }
        }

        if (Array.isArray(parsed.data.dayConfigs)) {
          for (const cfg of parsed.data.dayConfigs) {
            if (cfg.id) {
              const { id, ...cfgData } = cfg;
              await setDoc(doc(db, 'dayConfigs', id), cfgData, { merge: true });
              restoredConfigCount++;
            }
          }
        }

        setBackupMsg({ 
          type: 'success', 
          text: `Backup restaurado com sucesso! (${restoredEmpCount} funcionários e ${restoredConfigCount} configurações de dias atualizadas)` 
        });
      } catch (err: any) {
        console.error("Erro na restauração:", err);
        setBackupMsg({ type: 'error', text: `Erro ao importar backup: ${err.message}` });
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

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

      // Availabilities in this month (filtering for active configs only, deduplicated by date and type)
      const availStrings = emp.availabilities?.filter(str => str.startsWith(currentMonthKey) && !str.startsWith('login_')) || [];
      const uniqueDates = Array.from(new Set(availStrings.map(s => s.split('_')[0])));

      uniqueDates.forEach(dateStr => {
        const config = getDayConfig(dateStr);
        const hasCommon = availStrings.some(s => s === dateStr || s === `${dateStr}_common`);
        const hasParty = availStrings.some(s => s.startsWith(`${dateStr}_party`));

        if (hasCommon && config.isCommon) totalAvailabilitiesThisMonth++;
        if (hasParty && config.isParty) totalAvailabilitiesThisMonth++;
      });
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
        d.date.startsWith(currentMonthKey) && d.isCancelled && !d.cancellationIgnored
      ) || [];
      const cancellationsThisMonth = cancellationsThisMonthList.length;

      // Track exact dates with active/inactive state, deduplicated by date and type
      const activeAvails: { day: string; type: 'common' | 'party' }[] = [];
      const inactiveAvails: { day: string; type: 'common' | 'party' }[] = [];

      const monthAvailStrings = emp.availabilities?.filter(str => str.startsWith(currentMonthKey) && !str.startsWith('login_')) || [];
      const monthDates = Array.from(new Set(monthAvailStrings.map(s => s.split('_')[0])));

      monthDates.forEach(dateStr => {
        const config = getDayConfig(dateStr);
        const dayNum = dateStr.split('-')[2];
        const hasCommon = monthAvailStrings.some(s => s === dateStr || s === `${dateStr}_common`);
        const hasParty = monthAvailStrings.some(s => s.startsWith(`${dateStr}_party`));

        if (hasCommon) {
          if (config.isCommon) {
            activeAvails.push({ day: dayNum, type: 'common' });
          } else {
            inactiveAvails.push({ day: dayNum, type: 'common' });
          }
        }

        if (hasParty) {
          if (config.isParty) {
            activeAvails.push({ day: dayNum, type: 'party' });
          } else {
            inactiveAvails.push({ day: dayNum, type: 'party' });
          }
        }
      });

      const availabilitiesThisMonth = activeAvails.length;

      const totalConfirmedAllTime = emp.workDays?.filter(d => !d.isCancelled).length || 0;
      const totalCancellationsAllTime = emp.workDays?.filter(d => d.isCancelled && !d.cancellationIgnored).length || 0;
      
      // All time availabilities count, deduplicated by date and type
      let totalAvailabilitiesAllTime = 0;
      const allAvailStrings = emp.availabilities?.filter(str => !str.startsWith('login_')) || [];
      const allDates = Array.from(new Set(allAvailStrings.map(s => s.split('_')[0])));

      allDates.forEach(dateStr => {
        const config = getDayConfig(dateStr);
        const hasCommon = allAvailStrings.some(s => s === dateStr || s === `${dateStr}_common`);
        const hasParty = allAvailStrings.some(s => s.startsWith(`${dateStr}_party`));

        if (hasCommon && config.isCommon) totalAvailabilitiesAllTime++;
        if (hasParty && config.isParty) totalAvailabilitiesAllTime++;
      });

      const hasDeclaredNoAvailThisMonth = emp.availabilities?.includes(`no_avail_${currentMonthKey}`);

      return {
        id: emp.id,
        name: emp.name,
        artisticName: emp.artisticName || emp.name,
        photoUrl: emp.photoUrl,
        level: emp.level,
        confirmedThisMonth,
        availabilitiesThisMonth,
        hasDeclaredNoAvailThisMonth,
        cancellationsThisMonth,
        totalConfirmedAllTime,
        totalAvailabilitiesAllTime,
        totalCancellationsAllTime,
        activeAvails: activeAvails.sort((a, b) => a.day.localeCompare(b.day)),
        inactiveAvails: inactiveAvails.sort((a, b) => a.day.localeCompare(b.day)),
        monthCancellations: cancellationsThisMonthList.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    const compareAlpha = (a: any, b: any) => {
      const nameA = a.artisticName || a.name || '';
      const nameB = b.artisticName || b.name || '';
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    };

    // Sort based on the selected metric and period with alphabetical tie-breaking
    if (rankPeriod === 'monthly') {
      if (rankMetric === 'confirmed') {
        return [...data].sort((a, b) => b.confirmedThisMonth - a.confirmedThisMonth || b.totalConfirmedAllTime - a.totalConfirmedAllTime || compareAlpha(a, b));
      } else if (rankMetric === 'availabilities') {
        return [...data].sort((a, b) => b.availabilitiesThisMonth - a.availabilitiesThisMonth || b.totalAvailabilitiesAllTime - a.totalAvailabilitiesAllTime || compareAlpha(a, b));
      } else {
        return [...data].sort((a, b) => b.cancellationsThisMonth - a.cancellationsThisMonth || b.totalCancellationsAllTime - a.totalCancellationsAllTime || compareAlpha(a, b));
      }
    } else {
      if (rankMetric === 'confirmed') {
        return [...data].sort((a, b) => b.totalConfirmedAllTime - a.totalConfirmedAllTime || b.confirmedThisMonth - a.confirmedThisMonth || compareAlpha(a, b));
      } else if (rankMetric === 'availabilities') {
        return [...data].sort((a, b) => b.totalAvailabilitiesAllTime - a.totalAvailabilitiesAllTime || b.availabilitiesThisMonth - a.availabilitiesThisMonth || compareAlpha(a, b));
      } else {
        return [...data].sort((a, b) => b.totalCancellationsAllTime - a.totalCancellationsAllTime || b.cancellationsThisMonth - a.cancellationsThisMonth || compareAlpha(a, b));
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

  const podiumItems = useMemo(() => {
    const items = rankingData.slice(0, 3);
    return [
      { item: items[1] || null, position: 2 as const, originalIndex: 1 }, // Left: 2nd place
      { item: items[0] || null, position: 1 as const, originalIndex: 0 }, // Center: 1st place
      { item: items[2] || null, position: 3 as const, originalIndex: 2 }  // Right: 3rd place
    ];
  }, [rankingData]);

  const remainingItems = useMemo(() => {
    return rankingData.slice(3);
  }, [rankingData]);

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
      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Rankings (8 cols) */}
        <div className="lg:col-span-7 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md flex flex-col h-fit">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-brand-border/60 mb-6">
            <div className="flex items-center gap-2.5">
              <Award className="text-brand-primary" size={20} />
              <div>
                <h3 className="text-lg font-bold text-brand-text uppercase tracking-wider font-playful">
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
                      ? "bg-brand-primary/20 dark:bg-white/10 text-brand-primary dark:text-white border border-brand-primary/10 dark:border-white/10 shadow-sm" 
                      : "text-brand-muted hover:text-brand-text"
                  )}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setRankPeriod('allTime')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all",
                    rankPeriod === 'allTime' 
                      ? "bg-brand-primary/20 dark:bg-white/10 text-brand-primary dark:text-white border border-brand-primary/10 dark:border-white/10 shadow-sm" 
                      : "text-brand-muted hover:text-brand-text"
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
                      : "text-brand-muted hover:text-brand-text"
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
                      : "text-brand-muted hover:text-brand-text"
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
                      : "text-brand-muted hover:text-brand-text"
                  )}
                >
                  Desistências
                </button>
              </div>

              {onOpenRevertCancellation && rankMetric === 'cancellations' && (
                <button
                  type="button"
                  onClick={() => onOpenRevertCancellation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 rounded-lg transition-all shadow-sm shrink-0"
                  title="Reverter cancelamento acidental de colaborador"
                >
                  <RotateCcw size={13} />
                  <span>Reverter Cancelamento</span>
                </button>
              )}
            </div>
          </div>

          {/* Ranking list */}
          <div className="space-y-6">
            {rankingData.length > 0 ? (
              <>
                {/* Pódio (Top 3) */}
                <div className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl p-4 sm:p-6 mb-6 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Subtle background glow effect */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-end justify-center gap-2.5 sm:gap-6 md:gap-8 w-full pt-4 pb-2">
                    {podiumItems.map(({ item, position }) => {
                      const isFirst = position === 1;
                      const isSecond = position === 2;
                      const isThird = position === 3;
                      
                      const config = {
                        1: {
                          text: 'text-yellow-400',
                          border: 'border-yellow-400/50',
                          glow: 'shadow-[0_0_20px_rgba(251,191,36,0.15)]',
                          bg: 'from-yellow-500/20 via-yellow-500/10 to-brand-bg/10',
                          badge: 'bg-yellow-400 text-brand-bg font-black',
                          height: 'h-[120px] sm:h-[150px]',
                          avatarRing: 'ring-4 ring-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.4)]',
                          avatarSize: 'w-14 h-14 sm:w-16 sm:h-16 text-sm sm:text-base'
                        },
                        2: {
                          text: 'text-slate-300',
                          border: 'border-slate-300/40',
                          glow: 'shadow-[0_0_12px_rgba(203,213,225,0.08)]',
                          bg: 'from-slate-400/15 via-slate-500/5 to-brand-bg/5',
                          badge: 'bg-slate-300 text-brand-bg font-black',
                          height: 'h-[90px] sm:h-[110px]',
                          avatarRing: 'ring-3 ring-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.25)]',
                          avatarSize: 'w-11 h-11 sm:w-13 sm:h-13 text-xs sm:text-sm'
                        },
                        3: {
                          text: 'text-amber-500',
                          border: 'border-amber-600/30',
                          glow: 'shadow-[0_0_10px_rgba(217,119,6,0.05)]',
                          bg: 'from-amber-700/15 via-amber-800/5 to-brand-bg/5',
                          badge: 'bg-amber-600 text-white font-black',
                          height: 'h-[65px] sm:h-[80px]',
                          avatarRing: 'ring-3 ring-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.2)]',
                          avatarSize: 'w-10 h-10 sm:w-12 sm:h-12 text-xs sm:text-sm'
                        }
                      }[position];

                      if (!item) {
                        return (
                          <div key={`empty-${position}`} className="flex flex-col items-center w-24 sm:w-32 opacity-25 select-none">
                            {/* Empty Avatar */}
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center mb-2">
                              <span className="text-gray-500 font-extrabold text-xs">?</span>
                            </div>
                            <div className="w-12 h-2 bg-gray-800 rounded mb-4" />
                            {/* Empty Pedestal */}
                            <div className={cn(
                              "w-full rounded-t-2xl border-t border-dashed border-gray-700 bg-gray-900/10 flex items-center justify-center",
                              config.height
                            )}>
                              <span className="text-xs font-black text-gray-600">{position}º</span>
                            </div>
                          </div>
                        );
                      }

                      // Fetch current values
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

                      return (
                        <motion.div
                          key={`pod-${item.id}`}
                          initial={{ opacity: 0, y: 40 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 100, 
                            damping: 14, 
                            delay: isFirst ? 0 : isSecond ? 0.1 : 0.2 
                          }}
                          whileHover={{ y: -5, transition: { duration: 0.15 } }}
                          className="flex flex-col items-center w-24 sm:w-32 group relative"
                        >
                          {/* Floating Crown for 1st Place */}
                          {isFirst && (
                            <motion.div
                              animate={{ y: [0, -3, 0] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="absolute -top-7 text-yellow-400 z-10"
                            >
                              <Crown className="fill-yellow-400/20 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" size={24} />
                            </motion.div>
                          )}

                          {/* Avatar Circle */}
                          <div className="relative mb-3">
                            <div className={cn(
                              "rounded-full bg-brand-bg/90 border border-brand-border/60 flex items-center justify-center font-extrabold uppercase select-none transition-all duration-300 overflow-hidden",
                              config.avatarSize,
                              config.avatarRing
                            )}>
                              {item.photoUrl ? (
                                <img src={item.photoUrl} alt={item.artisticName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{item.artisticName.substring(0, 2)}</span>
                              )}
                            </div>
                            
                            {/* Ranking Badge Overlay */}
                            <span className={cn(
                              "absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shadow border border-brand-bg",
                              config.badge
                            )}>
                              {position}
                            </span>
                          </div>

                          {/* Info above block */}
                          <div className="text-center w-full mb-3 px-1">
                            <span className="block text-xs sm:text-sm font-black text-brand-text truncate drop-shadow-sm group-hover:text-brand-primary transition-colors">
                              {item.artisticName}
                            </span>
                            <span className="block text-[8px] sm:text-[9px] font-extrabold text-gray-500 uppercase tracking-widest mt-0.5">
                              {item.level}
                            </span>
                          </div>

                          {/* Pedestal Block */}
                          <div className={cn(
                            "w-full rounded-t-2xl border-t-2 border-x border-b border-brand-border/30 bg-gradient-to-b flex flex-col justify-between items-center p-2 sm:p-3 shadow-lg",
                            config.bg,
                            config.border,
                            config.glow
                          )}>
                            <span className={cn("text-2xl sm:text-3xl font-black italic tracking-tighter mt-1", config.text)}>
                              {position}º
                            </span>

                            <div className="text-center w-full mt-2">
                              <span className={cn(
                                "block text-[10px] sm:text-xs font-black uppercase tracking-tight",
                                isFirst ? "text-yellow-400" : isSecond ? "text-slate-300" : "text-amber-500"
                              )}>
                                {activeValue} {
                                  rankMetric === 'confirmed' 
                                    ? 'dias' 
                                    : rankMetric === 'availabilities' 
                                      ? 'disps' 
                                      : (activeValue === 1 ? 'desist.' : 'desist.')
                                }
                              </span>
                              <span className="block text-[8px] font-bold text-gray-500 mt-0.5">
                                {rankPeriod === 'monthly' ? `Total: ${allTimeValue}` : `Mês: ${currentValue}`}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Remaining rankings title */}
                {remainingItems.length > 0 && (
                  <div className="pt-2 pb-1">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-brand-border/40 pb-2">
                      Demais Colocados ({remainingItems.length})
                    </h4>
                  </div>
                )}

                {/* Remaining list */}
                <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1.5">
                  {remainingItems.map((item, index) => {
                    const rankPosition = index + 4;
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

                    return (
                      <div key={item.id} className="group relative flex items-center gap-4 p-3.5 rounded-xl bg-brand-bg/40 border border-brand-border/40 hover:border-brand-primary/20 hover:bg-brand-bg/80 transition-all duration-200">
                        {/* Position number */}
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-black text-xs bg-brand-card text-gray-400 border border-brand-border/60">
                          {rankPosition}
                        </div>

                        {/* Avatar Image / Initials */}
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center font-extrabold text-sm text-brand-primary uppercase shrink-0 overflow-hidden shadow-sm">
                          {item.photoUrl ? (
                            <img src={item.photoUrl} alt={item.artisticName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.artisticName.substring(0, 2)}</span>
                          )}
                        </div>

                        {/* Name and Bar details */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex justify-between items-baseline gap-2">
                            <div className="truncate">
                              <span className="text-sm font-bold text-brand-text">{item.artisticName}</span>
                              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{item.level}</span>
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
                          <div className="w-full h-2 bg-brand-card rounded-full overflow-hidden border border-brand-border/40">
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
                          {rankMetric === 'availabilities' && item.hasDeclaredNoAvailThisMonth && item.availabilitiesThisMonth === 0 && (
                            <div className="pt-1.5">
                              <span className="text-red-400 font-bold text-[10px] bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                🚫 Declaro Indisponível neste Mês
                              </span>
                            </div>
                          )}
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
                                  <button
                                    key={`canc-${idx}`}
                                    type="button"
                                    onClick={() => onOpenRevertCancellation && onOpenRevertCancellation(item.id, c.date)}
                                    className="px-2 py-0.5 rounded font-black border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white text-[10px] flex items-center gap-1 transition-all cursor-pointer group shadow-sm"
                                    title={`Desistência de ${c.type === 'party' ? 'Festa' : 'CCSP'} para o dia ${dayNum}. Clique para reverter!`}
                                  >
                                    <span>Dia {dayNum} {c.type === 'party' ? '🎉' : '🏢'}</span>
                                    <RotateCcw size={10} className="text-amber-400 group-hover:rotate-180 transition-transform" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
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
              <h3 className="text-lg font-bold text-brand-text uppercase tracking-wider font-playful">
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
                className="w-full bg-brand-bg/80 border border-brand-border/80 rounded-xl py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-primary transition-colors text-brand-text font-medium"
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
                  <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                    {log.name.substring(0, 2)}
                  </div>

                  {/* details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs font-bold text-brand-text truncate">{log.name}</span>
                      <span className="text-[9px] font-black uppercase text-brand-primary tracking-wider bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded shrink-0">
                        Acesso OK
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{log.email}</p>
                    
                    <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-brand-border/20 text-[10px] text-brand-muted font-semibold">
                      <Clock size={11} className="text-purple-500 dark:text-purple-400" />
                      <span className="text-purple-600 dark:text-purple-300" title={absolute}>{relative}</span>
                      <span className="text-brand-muted">•</span>
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

      {/* Backup and Restore Section */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-brand-border/60">
          <div className="flex items-center gap-2.5">
            <Database className="text-emerald-400" size={22} />
            <div>
              <h3 className="text-lg font-bold text-brand-text uppercase tracking-wider font-playful">
                Backup & Restauração da Base de Dados
              </h3>
              <p className="text-xs text-brand-muted font-medium">
                Baixe cópias físicas/online dos seus dados ou restaure backups em formato JSON/CSV a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {backupMsg && (
          <div className={cn(
            "p-3 rounded-xl text-xs font-bold border flex items-center gap-2",
            backupMsg.type === 'success' 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          )}>
            {backupMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{backupMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Download JSON Backup */}
          <div className="bg-brand-bg/50 border border-brand-border/80 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <FileJson size={18} />
                <span>Backup Completo (JSON)</span>
              </div>
              <p className="text-[11px] text-brand-muted">
                Exporta todos os funcionários, configurações de dias e históricos de cancelamento em um arquivo .json seguro.
              </p>
            </div>

            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-brand-bg font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>{isExporting ? "Gerando Backup..." : "Exportar Backup JSON"}</span>
            </button>
          </div>

          {/* Download CSV Report */}
          <div className="bg-brand-bg/50 border border-brand-border/80 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <FileSpreadsheet size={18} />
                <span>Relatório para Excel (CSV)</span>
              </div>
              <p className="text-[11px] text-brand-muted">
                Gera uma planilha física para visualização em Excel ou Google Planilhas com a lista de funcionários e diárias.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="w-full bg-blue-500 hover:bg-blue-600 text-brand-bg font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>Exportar Planilha CSV</span>
            </button>
          </div>

          {/* Import/Restore Backup */}
          <div className="bg-brand-bg/50 border border-brand-border/80 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                <Upload size={18} />
                <span>Restaurar de Cópia (JSON)</span>
              </div>
              <p className="text-[11px] text-brand-muted">
                Selecione um arquivo de backup JSON salvo anteriormente para regravar os dados no Firestore em caso de emergência.
              </p>
            </div>

            <label className="w-full bg-purple-500 hover:bg-purple-600 text-brand-bg font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer">
              <Upload size={14} />
              <span>{isImporting ? "Restaurando Dados..." : "Selecionar e Restaurar JSON"}</span>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportJSON} 
                disabled={isImporting}
                className="hidden" 
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
