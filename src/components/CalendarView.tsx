import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Search, 
  UserPlus, 
  UserMinus, 
  Clock, 
  Copy, 
  ClipboardPaste, 
  AlertTriangle, 
  Maximize2, 
  Lock, 
  Unlock, 
  Save, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Trash2,
  Coins,
  Sparkles,
  TrendingUp,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, WorkDay, DayType, CancellationLog, DayConfig, PartyConfig } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import DayManagementModal from './DayManagementModal';

interface CalendarViewProps {
  employees: Employee[];
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void;
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  isReadOnly?: boolean;
  isAdmin?: boolean;
  deadlines?: Record<string, string>;
  onUpdateDeadline?: (monthKey: string, deadlineIso: string) => void;
  onUpdateAvailabilities?: (employeeId: string, availabilities: string[]) => void;
  dayConfigs?: Record<string, DayConfig>;
  onUpdateDayConfig?: (dateStr: string, config: DayConfig) => void;
  onCancelWorkDay?: (employeeId: string, dateStr: string, type: 'common' | 'party', employeeName: string) => Promise<void>;
  cancellations?: CancellationLog[];
  onDismissCancellation?: (cancellationId: string) => void;
  onMarkCancellationRead?: (cancellationId: string) => void;
  sidebarTab?: 'availabilities' | 'cancellations';
  onSidebarTabChange?: React.Dispatch<React.SetStateAction<'availabilities' | 'cancellations'>>;
}

export default function CalendarView({ 
  employees, 
  onUpdateDays, 
  currentMonth, 
  setCurrentMonth,
  isReadOnly = false,
  isAdmin = true,
  deadlines = {},
  onUpdateDeadline,
  onUpdateAvailabilities,
  dayConfigs = {},
  onUpdateDayConfig,
  onCancelWorkDay,
  cancellations = [],
  onDismissCancellation,
  onMarkCancellationRead,
  sidebarTab = 'availabilities',
  onSidebarTabChange
}: CalendarViewProps) {
  const getDayConfig = (dateStr: string): DayConfig & { parties: PartyConfig[] } => {
    const config = dayConfigs?.[dateStr];
    let parties: PartyConfig[] = config?.parties ? [...config.parties] : [];

    if (config) {
      if (config.isParty && parties.length === 0) {
        parties = [{ id: 'default_party', name: 'Festa', time: config.partyTime || '' }];
      }
      return {
        isCommon: !!config.isCommon,
        isParty: parties.length > 0 || !!config.isParty,
        partyTime: config.partyTime || (parties[0]?.time || ''),
        parties
      };
    }

    // Auto-infer based on existing escalations to avoid losing past data
    const hasCommonWorkers = employees.some(emp => 
      emp.workDays?.some(d => d.date === dateStr && d.type === 'common' && !d.isCancelled)
    );
    const partyWorkDays = employees.flatMap(emp => 
      (emp.workDays || []).filter(d => d.date === dateStr && d.type === 'party' && !d.isCancelled)
    );
    
    const hasPastAvailabilities = employees.some(emp => 
      emp.availabilities?.some(av => av === dateStr || av === `${dateStr}_common`)
    );
    const hasPastPartyAvailabilities = employees.some(emp => 
      emp.availabilities?.some(av => av.startsWith(`${dateStr}_party`))
    );

    if (partyWorkDays.length > 0) {
      const uniquePartyNames = Array.from(new Set(partyWorkDays.map(d => d.partyName || 'Festa')));
      parties = uniquePartyNames.map((name, i) => ({
        id: `inferred_p_${i}`,
        name,
        time: ''
      }));
    } else if (hasPastPartyAvailabilities) {
      parties = [{ id: 'default_party', name: 'Festa', time: '' }];
    }

    const isParty = parties.length > 0;
    const isCommon = hasCommonWorkers || hasPastAvailabilities || (!isParty && (hasCommonWorkers || hasPastAvailabilities));

    return {
      isCommon: !!isCommon,
      isParty,
      partyTime: parties[0]?.time || '',
      parties
    };
  };

  const [selectedDay, setSelectedDay] = React.useState<Date | null>(new Date());
  const [direction, setDirection] = React.useState<number>(0);

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const clickTimeoutRef = React.useRef<any>(null);
  const clickDayStrRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);
  const [copiedTeam, setCopiedTeam] = React.useState<string[] | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = React.useState(false);

  // Employee Choice Modal State
  const [employeeChoiceDate, setEmployeeChoiceDate] = React.useState<Date | null>(null);
  const [isEmployeeChoiceModalOpen, setIsEmployeeChoiceModalOpen] = React.useState(false);

  // Employee Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [cancelTargetDate, setCancelTargetDate] = React.useState<Date | null>(null);
  const [isCancellingLoading, setIsCancellingLoading] = React.useState(false);



  // Deadline Admin State
  const [deadlineInputDate, setDeadlineInputDate] = React.useState('');
  const [deadlineInputTime, setDeadlineInputTime] = React.useState('');

  const currentMonthKey = format(currentMonth, 'yyyy-MM');
  const deadlineStr = deadlines?.[currentMonthKey] || '';

  React.useEffect(() => {
    if (deadlineStr) {
      const [d, t] = deadlineStr.split('T');
      setDeadlineInputDate(d || '');
      setDeadlineInputTime(t || '');
    } else {
      setDeadlineInputDate('');
      setDeadlineInputTime('');
    }
  }, [currentMonth, deadlineStr]);
  
  // Drag and Drop State
  const [draggedDay, setDraggedDay] = React.useState<Date | null>(null);
  const [replicationTarget, setReplicationTarget] = React.useState<Date | null>(null);
  const [isReplicationModalOpen, setIsReplicationModalOpen] = React.useState(false);
  
  // Deactivation confirmation modal for Admins
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = React.useState(false);
  const [deactivateTargetDay, setDeactivateTargetDay] = React.useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
  
  const employeesWorking = React.useMemo(() => {
    return employees
      .filter(emp => emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled))
      .sort((a, b) => {
        const nameA = a.artisticName || a.name || '';
        const nameB = b.artisticName || b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [employees, selectedDayStr]);

  const { availablesMarked, availablesOthers } = React.useMemo(() => {
    const config = getDayConfig(selectedDayStr);
    const marked: Employee[] = [];
    const others: Employee[] = [];
    
    employees.forEach(emp => {
      const isWorking = emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled);
      if (isWorking) return;
      
      const matchesQuery = !searchQuery || 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (emp.artisticName && emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase()));
        
      if (!matchesQuery) return;
      
      const commonAvailable = !!config.isCommon && 
        (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));
      const partyAvailable = !!config.isParty && 
        emp.availabilities?.includes(`${selectedDayStr}_party`);
        
      if (commonAvailable || partyAvailable) {
        marked.push(emp);
      } else {
        others.push(emp);
      }
    });

    const sortByName = (a: Employee, b: Employee) => {
      const nameA = a.artisticName || a.name || '';
      const nameB = b.artisticName || b.name || '';
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    };
    
    return { 
      availablesMarked: marked.sort(sortByName), 
      availablesOthers: others.sort(sortByName) 
    };
  }, [employees, selectedDayStr, searchQuery, dayConfigs]);

  const toggleWorkDayType = (employee: Employee, date: Date, type: 'common' | 'party', party?: PartyConfig) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const currentWork = employee.workDays.find(d => d.date === dateStr && !d.isCancelled);

    if (type === 'common') {
      if (currentWork && currentWork.type === 'common') {
        const newDays = employee.workDays.filter(d => d.date !== dateStr);
        onUpdateDays(employee.id, newDays);
        return;
      }
      const filtered = employee.workDays.filter(d => d.date !== dateStr);
      const newDays: WorkDay[] = [...filtered, { 
        date: dateStr, 
        type: 'common', 
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }];
      onUpdateDays(employee.id, newDays);
    } else if (type === 'party') {
      const selectedParty = party || (getDayConfig(dateStr).parties?.[0] || { id: 'default_party', name: 'Festa' });
      const isThisParty = currentWork && currentWork.type === 'party' && 
        (currentWork.partyId === selectedParty.id || (!currentWork.partyId && selectedParty.id === 'default_party') || currentWork.partyName === selectedParty.name);

      if (isThisParty) {
        const newDays = employee.workDays.filter(d => d.date !== dateStr);
        onUpdateDays(employee.id, newDays);
        return;
      }

      const filtered = employee.workDays.filter(d => d.date !== dateStr);
      const newDays: WorkDay[] = [...filtered, { 
        date: dateStr, 
        type: 'party', 
        partyId: selectedParty.id,
        partyName: selectedParty.name,
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }];
      onUpdateDays(employee.id, newDays);
    }
  };

  const toggleWorkDay = (employee: Employee, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isWorking = employee.workDays.some(d => d.date === dateStr && !d.isCancelled);
    let newDays: WorkDay[];
    
    if (isWorking) {
      newDays = employee.workDays.filter(d => d.date !== dateStr);
    } else {
      const filtered = employee.workDays.filter(d => d.date !== dateStr);
      newDays = [...filtered, { 
        date: dateStr, 
        type: 'common' as DayType, 
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }];
    }
    
    onUpdateDays(employee.id, newDays);
  };

  const updateExtraHours = (employee: Employee, hours: number) => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const newDays = employee.workDays.map(d => 
      d.date === dateStr ? { ...d, extraHours: hours } : d
    );
    onUpdateDays(employee.id, newDays);
  };

  const handleCopyTeam = () => {
    const teamIds = employeesWorking.map(emp => emp.id);
    setCopiedTeam(teamIds);
  };

  const handlePasteTeam = () => {
    if (!copiedTeam || !selectedDay) return;
    
    copiedTeam.forEach(empId => {
      const employee = employees.find(e => e.id === empId);
      if (employee && !employee.workDays.some(d => d.date === selectedDayStr)) {
        const newDays = [...employee.workDays, { 
          date: selectedDayStr, 
          type: 'common' as DayType, 
          extraHours: 0,
          dailyRateAtTime: employee.dailyRate,
          partyRateAtTime: employee.partyRate,
          extraHourRateAtTime: employee.extraHourRate,
          levelAtTime: employee.level
        }];
        onUpdateDays(empId, newDays);
      }
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, day: Date) => {
    if (isReadOnly) return;
    setDraggedDay(day);
    e.dataTransfer.setData('text/plain', format(day, 'yyyy-MM-dd'));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    if (isReadOnly || !draggedDay || isSameDay(draggedDay, targetDay)) return;
    
    setReplicationTarget(targetDay);
    setIsReplicationModalOpen(true);
  };

  const confirmReplication = () => {
    if (draggedDay && replicationTarget) {
      const sourceDayStr = format(draggedDay, 'yyyy-MM-dd');
      const targetDayStr = format(replicationTarget, 'yyyy-MM-dd');
      
      employees.forEach(emp => {
        const sourceDayData = emp.workDays.find(d => d.date === sourceDayStr);
        const isInTarget = emp.workDays.some(d => d.date === targetDayStr);
        
        if (sourceDayData && !isInTarget) {
          // Add to target
          const newDays = [...emp.workDays, { ...sourceDayData, date: targetDayStr }];
          onUpdateDays(emp.id, newDays);
        } else if (!sourceDayData && isInTarget) {
          // Remove from target
          const newDays = emp.workDays.filter(d => d.date !== targetDayStr);
          onUpdateDays(emp.id, newDays);
        } else if (sourceDayData && isInTarget) {
          // Update target with source data (like extra hours)
          const newDays = emp.workDays.map(d => 
            d.date === targetDayStr ? { ...sourceDayData, date: targetDayStr } : d
          );
          onUpdateDays(emp.id, newDays);
        }
      });
    }
    setIsReplicationModalOpen(false);
    setDraggedDay(null);
    setReplicationTarget(null);
  };

  const myEmployee = employees[0];

  const handleConfirmCancellation = async () => {
    if (!cancelTargetDate || !myEmployee || !onCancelWorkDay) return;
    setIsCancellingLoading(true);
    try {
      const dateStr = format(cancelTargetDate, 'yyyy-MM-dd');
      const isScheduledParty = myEmployee.workDays?.some(d => d.date === dateStr && d.type === 'party');
      const type = isScheduledParty ? 'party' : 'common';
      const employeeName = myEmployee.artisticName || myEmployee.name;
      
      await onCancelWorkDay(myEmployee.id, dateStr, type, employeeName);
      setIsCancelModalOpen(false);
      setCancelTargetDate(null);
    } catch (error) {
      console.error("Error during cancellation confirm:", error);
    } finally {
      setIsCancellingLoading(false);
    }
  };

  const confirmDeactivation = () => {
    if (deactivateTargetDay && onUpdateDayConfig) {
      const dayStr = format(deactivateTargetDay, 'yyyy-MM-dd');
      const currentConfig = getDayConfig(dayStr);
      onUpdateDayConfig(dayStr, {
        ...currentConfig,
        isCommon: false
      });
    }
    setIsDeactivateModalOpen(false);
    setDeactivateTargetDay(null);
  };

  const handleDayClick = (day: Date) => {
    if (isAdmin) {
      if (isReadOnly) return;
      
      const dayStr = format(day, 'yyyy-MM-dd');
      
      if (clickTimeoutRef.current && clickDayStrRef.current === dayStr) {
        // Double click detected!
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        clickDayStrRef.current = null;
        
        // Double click action: open modal
        setSelectedDay(day);
        setIsDayModalOpen(true);
      } else {
        // If a timeout was active for a different day, trigger it first
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
          const prevDayStr = clickDayStrRef.current;
          if (prevDayStr) {
            const currentConfig = getDayConfig(prevDayStr);
            if (currentConfig.isCommon) {
              const prevDay = parseISO(prevDayStr);
              setDeactivateTargetDay(prevDay);
              setIsDeactivateModalOpen(true);
            } else {
              if (onUpdateDayConfig) {
                onUpdateDayConfig(prevDayStr, { ...currentConfig, isCommon: true });
              }
            }
          }
        }
        
        clickDayStrRef.current = dayStr;
        clickTimeoutRef.current = setTimeout(() => {
          clickTimeoutRef.current = null;
          clickDayStrRef.current = null;
          
          // Single click action: Toggle isCommon config
          const currentConfig = getDayConfig(dayStr);
          if (currentConfig.isCommon) {
            // Deactivating this day requires confirmation!
            setDeactivateTargetDay(day);
            setIsDeactivateModalOpen(true);
          } else {
            // Activating is immediate and safe
            const newConfig = {
              ...currentConfig,
              isCommon: true
            };
            if (onUpdateDayConfig) {
              onUpdateDayConfig(dayStr, newConfig);
            }
          }
        }, 280); // 280ms double click delay is standard and comfortable
      }
    } else {
      // Employee mode: toggle availability
      if (!myEmployee) return;
      
      const dayStr = format(day, 'yyyy-MM-dd');
      
      // Check if scheduled
      const isScheduledCommon = myEmployee.workDays?.some(d => d.date === dayStr && d.type === 'common');
      const isScheduledParty = myEmployee.workDays?.some(d => d.date === dayStr && d.type === 'party');
      const isScheduled = isScheduledCommon || isScheduledParty;
      
      if (isScheduled) {
        setCancelTargetDate(day);
        setIsCancelModalOpen(true);
        return;
      }
      
      const monthKey = format(day, 'yyyy-MM');
      const deadlineVal = deadlines?.[monthKey];
      const isExpired = deadlineVal ? new Date() > new Date(deadlineVal) : false;
      
      if (isExpired) {
        return; // Click disabled because deadline expired
      }
      
      const config = getDayConfig(dayStr);
      
      // Se não houver atividade comum nem de festa marcada pelo admin, o funcionário não pode selecionar disponibilidade
      if (!config.isCommon && !config.isParty) {
        return;
      }
      
      if (config.isCommon && config.isParty) {
        setEmployeeChoiceDate(day);
        setIsEmployeeChoiceModalOpen(true);
      } else {
        const currentAvailabilities = myEmployee.availabilities || [];
        let newAvailabilities: string[];
        
        if (config.isParty) {
          const hasParty = currentAvailabilities.includes(`${dayStr}_party`);
          if (hasParty) {
            newAvailabilities = currentAvailabilities.filter(d => d !== `${dayStr}_party`);
          } else {
            newAvailabilities = [...currentAvailabilities, `${dayStr}_party`];
          }
        } else {
          // Common day (default)
          const hasCommon = currentAvailabilities.includes(dayStr) || currentAvailabilities.includes(`${dayStr}_common`);
          if (hasCommon) {
            newAvailabilities = currentAvailabilities.filter(d => d !== dayStr && d !== `${dayStr}_common`);
          } else {
            newAvailabilities = [...currentAvailabilities, `${dayStr}_common`];
          }
        }
        
        if (onUpdateAvailabilities) {
          onUpdateAvailabilities(myEmployee.id, newAvailabilities);
        }
      }
    }
  };

  const employeesWithAvailabilitiesCount = React.useMemo(() => {
    return employees.map(emp => {
      const count = emp.availabilities?.filter(dateStr => {
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
      }).length || 0;
      return { ...emp, availabilitiesCount: count };
    }).sort((a, b) => b.availabilitiesCount - a.availabilitiesCount);
  }, [employees, currentMonthKey, dayConfigs]);

  const scheduledDaysThisMonth = React.useMemo(() => {
    if (!myEmployee || !myEmployee.workDays) return [];
    return myEmployee.workDays
      .filter(d => {
        if (d.isCancelled) return false;
        const date = parseISO(d.date);
        return isSameMonth(date, currentMonth);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [myEmployee, currentMonth]);

  const totalEarningsThisMonth = React.useMemo(() => {
    if (!myEmployee) return 0;
    return scheduledDaysThisMonth.reduce((acc, d) => {
      const isParty = d.type === 'party';
      const dayBase = isParty 
        ? (d.partyRateAtTime !== undefined ? d.partyRateAtTime : myEmployee.partyRate) 
        : (d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : myEmployee.dailyRate);
      const extraRate = d.extraHourRateAtTime !== undefined ? d.extraHourRateAtTime : myEmployee.extraHourRate;
      const extra = (d.extraHours || 0) * extraRate;
      return acc + dayBase + extra;
    }, 0);
  }, [myEmployee, scheduledDaysThisMonth]);



  const handleSaveDeadline = () => {
    if (onUpdateDeadline && deadlineInputDate && deadlineInputTime) {
      onUpdateDeadline(currentMonthKey, `${deadlineInputDate}T${deadlineInputTime}`);
    }
  };

  const handleClearDeadline = () => {
    if (onUpdateDeadline) {
      onUpdateDeadline(currentMonthKey, '');
    }
  };

  const currentDeadline = deadlines?.[currentMonthKey];
  const deadlineDate = currentDeadline ? new Date(currentDeadline) : null;
  const isDeadlinePassed = deadlineDate ? new Date() > deadlineDate : false;

  return (
    <div className="flex flex-col gap-6">
      {/* Deadline Notification Banner */}
      <div className={cn(
        "border rounded-xl p-4 flex items-center justify-between shadow-md transition-all duration-200 animate-in fade-in slide-in-from-top-2",
        isDeadlinePassed 
          ? "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200" 
          : deadlineDate 
            ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200" 
            : "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200"
      )}>
        <div className="flex items-center gap-3">
          {isDeadlinePassed ? (
            <Lock className="text-red-600 dark:text-red-400 shrink-0 animate-bounce" size={20} />
          ) : deadlineDate ? (
            <Unlock className="text-amber-600 dark:text-yellow-400 shrink-0" size={20} />
          ) : (
            <Calendar className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
          )}
          <div>
            <p className="text-xs md:text-sm font-black">
              {isDeadlinePassed ? (
                `Prazo Encerrado! O envio de disponibilidades para ${format(currentMonth, 'MMMM', { locale: ptBR })} expirou em ${format(deadlineDate!, "dd/MM/yyyy 'às' HH:mm")}.`
              ) : deadlineDate ? (
                `Prazo Limite: Defina suas disponibilidades de ${format(currentMonth, 'MMMM', { locale: ptBR })} até ${format(deadlineDate, "dd/MM/yyyy 'às' HH:mm")}.`
              ) : (
                `Disponibilidades de ${format(currentMonth, 'MMMM', { locale: ptBR })}: Sem prazo limite definido.`
              )}
            </p>
            {!isAdmin && !isDeadlinePassed && (
              <p className="text-[10px] text-amber-900 dark:text-yellow-400/80 mt-0.5 font-bold">Toque nos dias do calendário para marcar/desmarcar os dias em que você pode trabalhar.</p>
            )}
            {isAdmin && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-0.5 font-bold">⚡ Clique simples para ativar/desativar o dia de atividades CCSP. Clique duplo para gerenciar a equipe ou definir festa.</p>
            )}
            {!isAdmin && isDeadlinePassed && (
              <p className="text-[10px] text-red-700 dark:text-red-400/80 mt-0.5 font-bold">As datas deste mês foram travadas. Caso precise alterar, entre em contato com um administrador.</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Deadline Setup Panel */}
      {isAdmin && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 md:p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Clock className="text-brand-primary" size={24} />
            <div>
              <h3 className="text-sm font-bold text-brand-text">Prazo de Disponibilidades ({format(currentMonth, 'MMMM', { locale: ptBR })})</h3>
              <p className="text-xs text-brand-muted">Defina até quando a equipe pode registrar disponibilidade</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="date"
              value={deadlineInputDate}
              onChange={(e) => setDeadlineInputDate(e.target.value)}
              className="bg-brand-bg border border-brand-border text-xs rounded-lg py-1.5 px-3 focus:outline-none focus:border-brand-primary text-brand-text"
            />
            <input 
              type="time"
              value={deadlineInputTime}
              onChange={(e) => setDeadlineInputTime(e.target.value)}
              className="bg-brand-bg border border-brand-border text-xs rounded-lg py-1.5 px-3 focus:outline-none focus:border-brand-primary text-brand-text"
            />
            <button 
              onClick={handleSaveDeadline}
              className="bg-brand-primary hover:bg-brand-primary-hover text-slate-900 text-xs font-bold py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Save size={14} /> Salvar Prazo
            </button>
            {currentDeadline && (
              <button 
                onClick={handleClearDeadline}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flex container for main calendar + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Calendar Section */}
        <div className="flex-1 space-y-6">
          <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-2xl">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-3 md:p-6 border-b border-brand-border bg-brand-bg/30">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="overflow-hidden py-0.5 min-w-[140px] md:min-w-[180px]">
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.h2
                      key={format(currentMonth, 'yyyy-MM')}
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 25 : -25 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -25 : 25 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="text-base md:text-xl font-black text-brand-text capitalize"
                    >
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </motion.h2>
                  </AnimatePresence>
                </div>
                <div className="flex items-center bg-brand-bg border border-brand-border rounded-lg p-0.5 md:p-1">
                  <button 
                    onClick={handlePrevMonth}
                    className="p-1 md:p-1.5 hover:bg-brand-primary/10 rounded-md transition-all text-brand-muted hover:text-brand-text active:scale-90"
                    title="Mês anterior"
                  >
                    <ChevronLeft size={18} className="md:w-5 md:h-5" />
                  </button>
                  <button 
                    onClick={handleNextMonth}
                    className="p-1 md:p-1.5 hover:bg-brand-primary/10 rounded-md transition-all text-brand-muted hover:text-brand-text active:scale-90"
                    title="Próximo mês"
                  >
                    <ChevronRight size={18} className="md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-4 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-brand-primary rounded-full"></span>
                  <span>Escalado</span>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                    <span>Disponível</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                    <span>Sua Disponibilidade</span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-brand-border bg-brand-bg/50 min-w-[320px] md:min-w-[700px]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className="p-1 md:p-3 text-center text-[8px] md:text-xs font-black text-gray-500 uppercase tracking-tighter md:tracking-widest">
                    {day}
                  </div>
                ))}
              </div>
              
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={format(currentMonth, 'yyyy-MM')}
                  custom={direction}
                  initial={{ 
                    opacity: 0, 
                    x: direction > 0 ? 50 : -50,
                    scale: 0.98
                  }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    scale: 1
                  }}
                  exit={{ 
                    opacity: 0, 
                    x: direction > 0 ? -50 : 50,
                    scale: 0.98
                  }}
                  transition={{ 
                    duration: 0.22,
                    ease: [0.25, 0.1, 0.25, 1.0]
                  }}
                  className="grid grid-cols-7 auto-rows-fr min-w-[320px] md:min-w-[700px]"
                >
                  {calendarDays.map((day, idx) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const config = getDayConfig(dayStr);
                  
                  // Counts for admin view
                  const workersCommonCount = employees.filter(emp => 
                    emp.workDays.some(d => d.date === dayStr && d.type === 'common' && !d.isCancelled)
                  ).length;
                  const workersPartyCount = employees.filter(emp => 
                    emp.workDays.some(d => d.date === dayStr && d.type === 'party' && !d.isCancelled)
                  ).length;
                  const availablesCommonCount = employees.filter(emp => 
                    emp.availabilities?.includes(dayStr) || emp.availabilities?.includes(`${dayStr}_common`)
                  ).length;
                  const availablesPartyCount = employees.filter(emp => 
                    emp.availabilities?.includes(`${dayStr}_party`)
                  ).length;
                  
                  // Status for employee view
                  const isMyCancelledCommon = myEmployee?.workDays?.some(d => d.date === dayStr && d.type === 'common' && d.isCancelled);
                  const isMyCancelledParty = myEmployee?.workDays?.some(d => d.date === dayStr && d.type === 'party' && d.isCancelled);
                  const isMyAvailableCommon = config.isCommon && !isMyCancelledCommon && (myEmployee?.availabilities?.includes(dayStr) || myEmployee?.availabilities?.includes(`${dayStr}_common`));
                  const isMyAvailableParty = config.isParty && !isMyCancelledParty && myEmployee?.availabilities?.includes(`${dayStr}_party`);
                  const isMyScheduledCommon = myEmployee?.workDays?.some(d => d.date === dayStr && d.type === 'common' && !d.isCancelled);
                  const isMyScheduledParty = myEmployee?.workDays?.some(d => d.date === dayStr && d.type === 'party' && !d.isCancelled);

                  const isMyAvailable = isMyAvailableCommon || isMyAvailableParty;
                  const isMyScheduled = isMyScheduledCommon || isMyScheduledParty;

                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isTodayDate = isToday(day);
                  const isOpenForAvailability = isCurrentMonth && (config.isCommon || config.isParty);
                  const showBeam = isCurrentMonth && !isMyScheduled && (isOpenForAvailability || (!isAdmin && isMyAvailable));
                  const isGreenBeam = !isAdmin && isMyAvailable;
                  const beamGradient = isGreenBeam
                    ? 'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #34d399 300deg, #10b981 340deg, transparent 360deg)'
                    : 'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #61C4F2 300deg, #38bdf8 340deg, transparent 360deg)';

                  return (
                    <motion.div
                      key={day.toString()}
                      whileHover={isCurrentMonth ? { scale: 1.018, zIndex: 10, transition: { duration: 0.15 } } : undefined}
                      whileTap={isCurrentMonth ? { scale: 0.98 } : undefined}
                      draggable={isAdmin && !isReadOnly && isCurrentMonth}
                      onDragStart={(e) => handleDragStart(e, day)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day)}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "min-h-[60px] md:min-h-[110px] p-1 md:p-3 border-b border-r border-brand-border transition-colors relative group overflow-hidden",
                        !isCurrentMonth && "bg-brand-bg/20 opacity-30 pointer-events-none",
                        isCurrentMonth && (
                          isAdmin 
                            ? "hover:bg-brand-primary/5 cursor-pointer" 
                            : isDeadlinePassed 
                              ? "cursor-not-allowed opacity-80" 
                              : (config.isCommon || config.isParty)
                                ? "hover:opacity-90 cursor-pointer"
                                : "cursor-not-allowed opacity-30"
                        ),
                        // Status styling for admin
                        isAdmin && isSelected && !isReadOnly && "bg-brand-primary/10 ring-2 ring-brand-primary border-brand-primary z-10",
                        isAdmin && !isSelected && config.isCommon && "bg-emerald-500/[0.03] border-emerald-500/20",
                        isAdmin && !isSelected && config.isParty && "bg-purple-500/[0.03] border-purple-500/20",
                        // Status styling for recreador when scheduled (fixed border and background, no animation)
                        !isAdmin && isMyScheduled && "bg-amber-100/90 dark:bg-[#f2d861]/15 border-2 border-[#f2d861] shadow-sm z-10",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      {/* Animated Moving Border with Solid Opaque Inner Mask */}
                      {showBeam && (
                        <>
                          {/* Rotating Conic Gradient Beam behind the mask */}
                          <div 
                            className="absolute -top-[100%] -left-[100%] w-[300%] h-[300%] animate-card-beam opacity-90 pointer-events-none z-0"
                            style={{
                              background: beamGradient,
                            }}
                          />
                          {/* Solid Opaque Inner Mask covering cell interior, leaving 1.5px border */}
                          <div 
                            className={cn(
                              "absolute inset-[1.5px] pointer-events-none z-0 transition-colors",
                              !isAdmin && isMyAvailable 
                                ? "bg-emerald-100/80 dark:bg-emerald-950" 
                                : "bg-brand-card"
                            )} 
                          />
                        </>
                      )}

                      {/* Party indicator badges */}
                      {config.isParty && (
                        <div className="absolute top-1 right-1 flex flex-col items-end gap-0.5 z-10 max-w-[85%] pointer-events-none">
                          {(config.parties && config.parties.length > 0 ? config.parties : [{ id: 'def', name: 'Festa', time: config.partyTime }]).map((p, pIdx) => (
                            <span 
                              key={p.id || pIdx}
                              className="text-[7px] md:text-[9px] bg-purple-600/10 dark:bg-purple-500/25 text-purple-900 dark:text-purple-300 px-1 py-0.5 rounded font-black uppercase tracking-wider scale-90 md:scale-100 truncate max-w-full"
                              title={p.time ? `${p.name}: ${p.time}` : p.name}
                            >
                              🎉 {p.name}{p.time ? ` (${p.time})` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="relative z-10 flex flex-col items-center justify-between h-full gap-1">
                        <span className={cn(
                          "text-xs md:text-sm font-black w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors",
                          isTodayDate 
                            ? "bg-brand-primary text-slate-900 font-extrabold shadow-sm" 
                            : !isAdmin && isMyScheduled 
                              ? "bg-brand-primary text-slate-900 font-extrabold shadow-sm" 
                              : !isAdmin && isMyAvailable 
                                ? "text-emerald-950 dark:text-emerald-200 font-black" 
                                : "text-brand-muted group-hover:text-brand-text",
                          isAdmin && isSelected && !isTodayDate && !isReadOnly && "text-brand-primary",
                          !isAdmin && !isMyScheduled && !config.isCommon && !config.isParty && "text-brand-muted/50"
                        )}>
                          {format(day, 'd')}
                        </span>
                        
                        {/* Status indicators */}
                        {isAdmin ? (
                          <div className="flex flex-wrap gap-1 justify-center items-center mt-1">
                            {/* Common counts */}
                            {config.isCommon && (
                              <>
                                {workersCommonCount > 0 && (
                                  <div 
                                    title={`${workersCommonCount} escalados (CCSP)`}
                                    className="bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0"
                                  >
                                    {workersCommonCount} C
                                  </div>
                                )}
                                {availablesCommonCount > 0 && (
                                  <div 
                                    title={`${availablesCommonCount} disponíveis (CCSP)`}
                                    className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 flex items-center gap-0.5"
                                  >
                                    <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full"></span>
                                    {availablesCommonCount}
                                  </div>
                                )}
                                {workersCommonCount === 0 && availablesCommonCount === 0 && (
                                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 flex items-center gap-1 select-none">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                                    Ativo
                                  </div>
                                )}
                              </>
                            )}
                            
                            {/* Party counts */}
                            {config.isParty && (
                              <>
                                {workersPartyCount > 0 && (
                                  <div 
                                    title={`${workersPartyCount} escalados (Festa)`}
                                    className="bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0"
                                  >
                                    {workersPartyCount} F 🥳
                                  </div>
                                )}
                                {availablesPartyCount > 0 && (
                                  <div 
                                    title={`${availablesPartyCount} disponíveis (Festa)`}
                                    className="bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 flex items-center gap-0.5"
                                  >
                                    <span className="w-1.5 h-1.5 bg-pink-500 dark:bg-pink-400 rounded-full"></span>
                                    {availablesPartyCount}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-center w-full mt-1">
                            {/* Common scheduling */}
                            {config.isCommon && isMyScheduledCommon && (
                              <div className="bg-brand-primary text-slate-900 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 w-full max-w-[54px] lg:max-w-none truncate shadow-xs">
                                <span className="hidden lg:inline">Escalado</span>
                                <span className="lg:hidden">Esc.</span>
                              </div>
                            )}
                            {config.isCommon && isMyAvailableCommon && !isMyScheduledCommon && (
                              <div className="bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 flex items-center justify-center gap-0.5 w-full max-w-[54px] lg:max-w-none truncate shadow-xs">
                                <CheckCircle2 size={8} className="shrink-0" />
                                <span className="hidden lg:inline">Disponível</span>
                                <span className="lg:hidden">Disp.</span>
                              </div>
                            )}
                            
                            {/* Party scheduling */}
                            {config.isParty && isMyScheduledParty && (
                              <div className="bg-purple-600 text-white dark:bg-purple-500/30 dark:text-purple-300 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 w-full max-w-[54px] lg:max-w-none truncate shadow-xs">
                                <span className="hidden lg:inline">Escalado Festa</span>
                                <span className="lg:hidden">Esc. F.</span>
                              </div>
                            )}
                            {config.isParty && isMyAvailableParty && !isMyScheduledParty && (
                              <div className="bg-pink-600 text-white dark:bg-pink-500/20 dark:text-pink-300 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 flex items-center justify-center gap-0.5 w-full max-w-[54px] lg:max-w-none truncate shadow-xs">
                                <CheckCircle2 size={8} className="shrink-0" />
                                <span className="hidden lg:inline">Disp. Festa</span>
                                <span className="lg:hidden">Disp. F.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Employee Scheduled Days List (Below Calendar) */}
          {!isAdmin && myEmployee && (
            <div className="bg-brand-card border border-brand-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="p-4 md:p-6 border-b border-brand-border bg-brand-bg/30 flex items-center justify-between">
                <div>
                  <h3 className="text-sm md:text-base font-black text-brand-text flex items-center gap-2">
                    <Calendar className="text-brand-primary" size={18} />
                    Suas Escalas Confirmadas — {format(currentMonth, 'MMMM', { locale: ptBR })}
                  </h3>
                  <p className="text-[10px] md:text-xs text-brand-muted font-semibold mt-0.5">
                    Estes são os dias que você está escalado para trabalhar neste mês
                  </p>
                </div>
                <span className="bg-brand-primary/10 text-brand-primary text-xs font-black px-3 py-1 rounded-full border border-brand-primary/20">
                  {scheduledDaysThisMonth.length} {scheduledDaysThisMonth.length === 1 ? 'dia' : 'dias'}
                </span>
              </div>

              <div className="p-4 md:p-6">
                {scheduledDaysThisMonth.length > 0 ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {scheduledDaysThisMonth.map((d) => {
                        const dateObj = parseISO(d.date);
                        const isParty = d.type === 'party';
                        const config = getDayConfig(d.date);
                        const partyTime = config.partyTime;

                        const dayBase = isParty 
                          ? (d.partyRateAtTime !== undefined ? d.partyRateAtTime : myEmployee.partyRate) 
                          : (d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : myEmployee.dailyRate);
                        const extraRate = d.extraHourRateAtTime !== undefined ? d.extraHourRateAtTime : myEmployee.extraHourRate;
                        const extra = (d.extraHours || 0) * extraRate;
                        const dayTotal = dayBase + extra;

                        return (
                          <div 
                            key={d.date}
                            onClick={() => {
                              setCancelTargetDate(dateObj);
                              setIsCancelModalOpen(true);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none hover:scale-[1.01] duration-150 group",
                              isParty 
                                ? "bg-purple-500/5 border-purple-500/20 hover:border-purple-500/45 hover:bg-purple-500/10" 
                                : "bg-brand-primary/5 border-brand-primary/20 hover:border-brand-primary/45 hover:bg-brand-primary/10"
                            )}
                          >
                            <div className="flex items-center gap-3 animate-in fade-in duration-200">
                              {/* Date circle badge */}
                              <div className={cn(
                                "w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-md transition-all",
                                isParty 
                                  ? "bg-purple-600 text-white group-hover:bg-purple-500" 
                                  : "bg-brand-primary text-slate-900 group-hover:bg-brand-primary-hover"
                              )}>
                                <span className="text-sm leading-none">{format(dateObj, 'dd')}</span>
                                <span className="text-[8px] uppercase tracking-wider leading-none mt-0.5 font-bold">
                                  {format(dateObj, 'EEE', { locale: ptBR }).substring(0, 3)}
                                </span>
                              </div>

                              {/* Details */}
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-brand-text capitalize">
                                  {format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {isParty ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                      Festa 🥳
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-brand-primary/10 dark:bg-brand-primary/20 text-amber-700 dark:text-brand-primary px-1.5 py-0.5 rounded">
                                      Dia CCSP 🏢
                                    </span>
                                  )}

                                  {d.extraHours ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                                      +{d.extraHours}h extras
                                    </span>
                                  ) : null}

                                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {formatCurrency(dayTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Party Time or Action badge */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                              {isParty && partyTime ? (
                                <div className="text-right">
                                  <span className="block text-[8px] text-brand-muted font-bold uppercase tracking-wider">Horário</span>
                                  <span className="inline-block bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm">
                                    {partyTime}
                                  </span>
                                </div>
                              ) : !isParty ? (
                                <div className="text-right">
                                  <span className="block text-[8px] text-brand-muted font-bold uppercase tracking-wider">Período</span>
                                  <span className="inline-block bg-brand-primary/10 border border-brand-primary/20 text-amber-700 dark:text-brand-primary font-black text-[10px] px-2 py-0.5 rounded-lg">
                                    Dia Inteiro
                                  </span>
                                </div>
                              ) : null}
                              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 group-hover:opacity-100 opacity-0 transition-opacity uppercase tracking-wider">
                                Desistir ✕
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Final Earnings Summary Demonstrative Card */}
                    <div className="pt-5 border-t border-brand-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-primary/[0.02] p-5 rounded-2xl border border-brand-primary/10">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-brand-text uppercase tracking-wider font-playful">Demonstrativo de Ganhos Estimados</h4>
                        <p className="text-[11px] text-brand-muted font-semibold">Valores baseados em suas diárias e horas extras acordadas</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 md:gap-8 text-xs font-bold text-brand-muted">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-brand-muted font-extrabold tracking-wider">Dias CCSP ({scheduledDaysThisMonth.filter(d => d.type === 'common').length}x)</span>
                          <span className="text-sm text-amber-700 dark:text-brand-primary font-black mt-0.5">
                            {formatCurrency(scheduledDaysThisMonth.filter(d => d.type === 'common').reduce((acc, d) => {
                              const rate = d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : myEmployee.dailyRate;
                              return acc + rate;
                            }, 0))}
                          </span>
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-brand-muted font-extrabold tracking-wider">Dias Festa ({scheduledDaysThisMonth.filter(d => d.type === 'party').length}x)</span>
                          <span className="text-sm text-purple-600 dark:text-purple-300 font-black mt-0.5">
                            {formatCurrency(scheduledDaysThisMonth.filter(d => d.type === 'party').reduce((acc, d) => {
                              const rate = d.partyRateAtTime !== undefined ? d.partyRateAtTime : myEmployee.partyRate;
                              return acc + rate;
                            }, 0))}
                          </span>
                        </div>

                        {scheduledDaysThisMonth.reduce((acc, d) => acc + (d.extraHours || 0), 0) > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-brand-muted font-extrabold tracking-wider">Horas Extras ({scheduledDaysThisMonth.reduce((acc, d) => acc + (d.extraHours || 0), 0)}h)</span>
                            <span className="text-sm text-yellow-600 dark:text-yellow-400 font-black mt-0.5">
                              {formatCurrency(scheduledDaysThisMonth.reduce((acc, d) => {
                                const rate = d.extraHourRateAtTime !== undefined ? d.extraHourRateAtTime : myEmployee.extraHourRate;
                                return acc + (d.extraHours || 0) * rate;
                              }, 0))}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-col bg-brand-primary/10 border border-brand-primary/20 px-4 py-2 rounded-xl">
                          <span className="text-[9px] uppercase text-amber-700 dark:text-brand-primary tracking-wider font-black">Total Estimado</span>
                          <span className="text-xl text-amber-700 dark:text-brand-primary font-black leading-none mt-1">
                            {formatCurrency(totalEarningsThisMonth)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-brand-border rounded-xl text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-500 mb-3">
                      <Calendar size={24} />
                    </div>
                    <p className="text-sm text-gray-400 font-semibold">Nenhuma escala confirmada para este mês.</p>
                    <p className="text-xs text-gray-500 mt-1">Marque suas disponibilidades no calendário acima para ser escalado.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Management Panel (Below Calendar) */}
          {isAdmin && !isReadOnly && selectedDay && (
            <div className="bg-brand-card border border-brand-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="p-4 md:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-bg/30">
                <div>
                  <h3 className="text-base md:text-xl font-bold text-brand-text capitalize">
                    {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <p className="text-xs md:text-sm text-brand-muted">Gerenciar equipe para este dia</p>
                </div>
                <div className="flex gap-1.5 md:gap-2">
                  <button 
                    onClick={() => setIsDayModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary text-[10px] md:text-xs font-bold py-2 px-2 md:px-3 rounded-lg transition-colors"
                    title="Visualizar dia em foco"
                  >
                    <Maximize2 size={14} />
                    <span className="inline">Focar Dia</span>
                  </button>
                  <button 
                    onClick={handleCopyTeam}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-[10px] md:text-xs font-bold py-2 px-2 md:px-3 rounded-lg transition-colors"
                    title="Copiar time deste dia"
                  >
                    <Copy size={14} />
                    <span className="inline">Copiar</span>
                  </button>
                  <button 
                    onClick={handlePasteTeam}
                    disabled={!copiedTeam}
                    className={cn(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold py-2 px-2 md:px-3 rounded-lg transition-colors",
                      copiedTeam 
                        ? "bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30" 
                        : "bg-slate-800 text-brand-muted/40 cursor-not-allowed"
                    )}
                    title="Colar time copiado"
                  >
                    <ClipboardPaste size={14} />
                    <span className="inline">Colar</span>
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-brand-border bg-brand-bg/10">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar recreador para adicionar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-brand-primary text-brand-text transition-colors"
                  />
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Working List */}
                <div>
                  <h4 className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                    Escalados ({employeesWorking.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {employeesWorking.map(emp => {
                      const dayData = emp.workDays.find(d => d.date === selectedDayStr);
                      const hasCommon = emp.workDays.some(d => d.date === selectedDayStr && d.type === 'common' && !d.isCancelled);
                      const hasParty = emp.workDays.some(d => d.date === selectedDayStr && d.type === 'party' && !d.isCancelled);
                      const isExpanded = expandedEmployeeId === emp.id;
                      const config = getDayConfig(selectedDayStr);
                      
                      return (
                        <motion.div 
                          key={emp.id} 
                          layout
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="bg-brand-primary/5 border border-brand-primary/20 px-3 py-2.5 rounded-xl transition-colors hover:border-brand-primary/40 group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="cursor-pointer min-w-0 flex-1 flex items-center gap-2.5" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                              <div className="w-8 h-8 rounded-full bg-brand-primary/20 shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-brand-primary border border-brand-primary/30 shadow-sm">
                                {emp.photoUrl ? (
                                  <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-brand-text truncate group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                                  <span className="text-[10px] text-brand-primary font-black uppercase shrink-0">{emp.level}</span>
                                </div>
                                
                                <div className="flex items-center gap-1 mt-1">
                                  {config.isCommon !== false && (
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWorkDayType(emp, selectedDay!, 'common');
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2 py-0.5 rounded transition-all uppercase flex items-center gap-1",
                                        hasCommon 
                                          ? "bg-brand-primary text-brand-bg shadow-sm" 
                                          : "bg-brand-bg text-gray-400 border border-brand-border hover:border-brand-primary/40"
                                      )}
                                    >
                                      CCSP
                                    </motion.button>
                                  )}
                                  {!!config.isParty && (
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWorkDayType(emp, selectedDay!, 'party');
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2 py-0.5 rounded transition-all uppercase flex items-center gap-1",
                                        hasParty 
                                          ? "bg-purple-500 text-white shadow-sm" 
                                          : "bg-brand-bg text-gray-400 border border-brand-border hover:border-purple-500/40"
                                      )}
                                    >
                                      Festa
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {hasCommon && (
                                <motion.button 
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-colors",
                                    isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10"
                                  )}
                                  title="Horas Extras"
                                >
                                  <Clock size={16} />
                                </motion.button>
                              )}
                              <motion.button 
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => toggleWorkDay(emp, selectedDay!)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Remover escala completa"
                              >
                                <UserMinus size={18} />
                              </motion.button>
                            </div>
                          </div>
                          
                          {isExpanded && hasCommon && (
                            <div className="flex items-center gap-3 pt-2.5 mt-2 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                              <label className="text-[10px] font-black text-brand-muted uppercase">Horas Extras (CCSP):</label>
                              <input 
                                type="number"
                                min="0"
                                step="0.5"
                                autoFocus
                                value={dayData?.extraHours || ''}
                                onChange={(e) => updateExtraHours(emp, Number(e.target.value))}
                                placeholder="0"
                                className="w-20 bg-brand-bg border border-brand-primary/20 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-brand-primary text-brand-text"
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {employeesWorking.length === 0 && (
                      <div className="col-span-full text-center py-6 border-2 border-dashed border-brand-border rounded-xl">
                        <p className="text-sm text-brand-muted italic">Ninguém escalado para este dia.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Available List */}
                <div className="space-y-6">
                  {/* Recreadores Disponíveis Sinalizados */}
                  <div>
                    <h4 className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                      Disponibilidades Sinalizadas ({availablesMarked.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {availablesMarked.map(emp => {
                        const config = getDayConfig(selectedDayStr);
                        const isDispCommon = config.isCommon !== false && 
                          (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));
                        const isDispParty = !!config.isParty && 
                          (emp.availabilities?.includes(`${selectedDayStr}_party`) || emp.availabilities?.some(a => a.startsWith(`${selectedDayStr}_party`)));

                        const showCcspBtn = isDispCommon;
                        const showPartyBtn = isDispParty;

                        return (
                          <motion.div 
                            key={emp.id} 
                            layout
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                            className="flex items-center justify-between bg-emerald-500/[0.02] border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/[0.05] px-3 py-2 rounded-xl transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-emerald-500/20 shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-emerald-400 border border-emerald-500/30 shadow-sm">
                                {emp.photoUrl ? (
                                  <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-brand-text truncate">{emp.artisticName || emp.name}</p>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase truncate">{emp.level}</span>
                                  {isDispCommon && (
                                    <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                      ✓ CCSP
                                    </span>
                                  )}
                                  {isDispParty && (
                                    <span className="text-[9px] font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                      ✓ Festa
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              {showCcspBtn && (
                                <motion.button 
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => toggleWorkDayType(emp, selectedDay!, 'common')}
                                  className="text-[10px] font-black bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg px-2.5 py-1 rounded-lg border border-brand-primary/30 hover:border-transparent transition-colors flex items-center gap-1 uppercase"
                                  title="Escalar para CCSP (Optado pelo recreador)"
                                >
                                  <UserPlus size={12} />
                                  CCSP
                                </motion.button>
                              )}
                              {showPartyBtn && (
                                <motion.button 
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => toggleWorkDayType(emp, selectedDay!, 'party')}
                                  className="text-[10px] font-black bg-purple-500/10 hover:bg-purple-500 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-1 rounded-lg border border-purple-500/30 hover:border-transparent transition-colors flex items-center gap-1 uppercase"
                                  title="Escalar para Festa (Optado pelo recreador)"
                                >
                                  <UserPlus size={12} />
                                  Festa
                                </motion.button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                      {availablesMarked.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2 col-span-full">Nenhuma sinalização de disponibilidade para este dia.</p>
                      )}
                    </div>
                  </div>

                  {/* Outros Recreadores (Shown only when searching) */}
                  {searchQuery && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <h4 className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-3">
                        Outros Recreadores ({availablesOthers.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {availablesOthers.map(emp => {
                          const config = getDayConfig(selectedDayStr);
                          const showCcspBtn = config.isCommon !== false;
                          const showPartyBtn = !!config.isParty;

                          return (
                            <motion.div 
                              key={emp.id} 
                              layout
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              transition={{ duration: 0.18, ease: "easeInOut" }}
                              className="flex items-center justify-between bg-brand-bg/40 border border-brand-border px-3 py-2 rounded-xl hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-colors gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-full bg-brand-bg shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-400 border border-brand-border shadow-sm">
                                  {emp.photoUrl ? (
                                    <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-brand-text truncate">{emp.artisticName || emp.name}</p>
                                  <p className="text-[10px] text-brand-muted font-bold uppercase truncate">{emp.level}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0">
                                {showCcspBtn && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleWorkDayType(emp, selectedDay!, 'common')}
                                    className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary hover:text-brand-primary text-gray-400 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 uppercase"
                                  >
                                    <UserPlus size={12} />
                                    CCSP
                                  </motion.button>
                                )}
                                {showPartyBtn && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleWorkDayType(emp, selectedDay!, 'party')}
                                    className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-purple-500/10 hover:border-purple-500 hover:text-purple-400 text-gray-400 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 uppercase"
                                  >
                                    <UserPlus size={12} />
                                    Festa
                                  </motion.button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                        {availablesOthers.length === 0 && (
                          <p className="text-xs text-brand-muted italic py-2 col-span-full">Nenhum outro recreador encontrado.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Panel with Availabilities Ranking and Cancellations */}
        {isAdmin && (
          <div id="sidebar-panel" className="w-full lg:w-80 bg-brand-card border border-brand-border rounded-xl p-4 md:p-6 shadow-2xl h-fit space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-2 border-b border-brand-border/50 pb-3">
              <div>
                <h3 className="text-sm font-black text-brand-text flex items-center gap-2">
                  {sidebarTab === 'availabilities' ? (
                    <>
                      <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={18} />
                      Disponibilidades
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 animate-pulse" size={18} />
                      Cancelamentos
                    </>
                  )}
                </h3>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  {sidebarTab === 'availabilities' 
                    ? `Ranking (${format(currentMonth, 'MMMM', { locale: ptBR })})` 
                    : 'Avisos da equipe'
                  }
                </p>
              </div>

              {onSidebarTabChange && (
                <button 
                  onClick={() => onSidebarTabChange(sidebarTab === 'availabilities' ? 'cancellations' : 'availabilities')}
                  title={sidebarTab === 'availabilities' ? 'Ver Cancelamentos' : 'Ver Disponibilidades'}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 transition-all px-2.5 py-1.5 rounded-lg border border-brand-primary/20 shrink-0"
                >
                  <span>{sidebarTab === 'availabilities' ? 'Cancelamentos' : 'Disponibilidades'}</span>
                  <ChevronRight size={14} className={cn("transition-transform duration-200", sidebarTab === 'cancellations' && "rotate-180")} />
                </button>
              )}
            </div>

            {sidebarTab === 'availabilities' ? (
              <div className="divide-y divide-brand-border overflow-y-auto max-h-[400px] pr-1 space-y-3 pt-2">
                {employeesWithAvailabilitiesCount.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between pt-3 first:pt-0">
                    <div>
                      <p className="text-xs font-bold text-brand-text">{emp.artisticName || emp.name}</p>
                      <p className="text-[10px] text-brand-muted font-medium uppercase">{emp.level}</p>
                    </div>
                    <div className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-black",
                      emp.availabilitiesCount > 0 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-brand-bg text-brand-muted"
                    )}>
                      {emp.availabilitiesCount} {emp.availabilitiesCount === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                ))}
                {employeesWithAvailabilitiesCount.length === 0 && (
                  <p className="text-xs text-brand-muted text-center py-4 italic">Nenhum funcionário cadastrado.</p>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[400px] pr-1 space-y-3 pt-2">
                {cancellations.map(c => {
                  const isUnread = !c.viewedByAdmins;
                  return (
                    <div 
                      key={c.id} 
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200",
                        isUnread 
                          ? "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20" 
                          : "bg-brand-bg/40 border-brand-border"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                            {isUnread && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0 animate-pulse"></span>}
                            {c.employeeName}
                          </p>
                          <p className="text-[10px] text-brand-muted font-medium mt-0.5">
                            Cancelou dia <span className="text-red-600 dark:text-red-400 font-bold">{format(parseISO(c.date), 'dd/MM')}</span> ({c.type === 'party' ? 'Festa 🥳' : 'Comum'})
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {isUnread && onMarkCancellationRead && (
                            <button 
                              onClick={() => onMarkCancellationRead(c.id)}
                              title="Marcar como visto"
                              className="p-1 hover:bg-brand-primary/10 text-brand-muted hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          {onDismissCancellation && (
                            <button 
                              onClick={() => onDismissCancellation(c.id)}
                              title="Excluir aviso"
                              className="p-1 hover:bg-brand-primary/10 text-brand-muted hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-brand-muted border-t border-brand-border/30 pt-1.5">
                        <span>Horário:</span>
                        <span>{format(parseISO(c.cancelledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  );
                })}
                {cancellations.length === 0 && (
                  <p className="text-xs text-brand-muted text-center py-6 italic">Nenhum cancelamento registrado.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Replication Confirmation Modal */}
      {isReplicationModalOpen && draggedDay && replicationTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-brand-primary/20 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-brand-text">Replicar Escala?</h3>
              <p className="text-brand-muted text-sm leading-relaxed">
                Tem certeza que deseja replicar a escala do dia <span className="text-brand-primary font-bold">{format(draggedDay, "dd/MM")}</span> para o dia <span className="text-brand-primary font-bold">{format(replicationTarget, "dd/MM")}</span>?
                <br />
                <span className="text-xs text-red-600 dark:text-red-400 mt-2 block">Isso substituirá qualquer escala existente no dia de destino.</span>
              </p>
            </div>
            <div className="p-4 bg-brand-bg/50 border-t border-brand-border flex gap-3">
              <button 
                onClick={() => {
                  setIsReplicationModalOpen(false);
                  setDraggedDay(null);
                  setReplicationTarget(null);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmReplication}
                className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-slate-900 font-extrabold py-3 rounded-xl transition-colors text-sm"
              >
                Sim, Replicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {isDeactivateModalOpen && deactivateTargetDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-brand-text">Desativar Dia CCSP?</h3>
              <p className="text-brand-muted text-sm leading-relaxed">
                Você tem certeza que deseja desativar o dia <span className="text-brand-primary font-bold">{format(deactivateTargetDay, "dd/MM")}</span> como disponível para atividades CCSP?
                <br />
                <span className="text-xs text-red-600 dark:text-red-400 mt-2 block font-medium">Os funcionários não poderão marcar disponibilidade para atividades CCSP nesta data.</span>
              </p>
            </div>
            <div className="p-4 bg-brand-bg/50 border-t border-brand-border flex gap-3">
              <button 
                onClick={() => {
                  setIsDeactivateModalOpen(false);
                  setDeactivateTargetDay(null);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                Voltar
              </button>
              <button 
                onClick={confirmDeactivation}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                Sim, Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Availability Choice Modal (for days with both Common and Party modes) */}
      {isEmployeeChoiceModalOpen && employeeChoiceDate && myEmployee && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-6 animate-in zoom-in-95 duration-200 text-brand-text">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black capitalize text-brand-text">
                  {format(employeeChoiceDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs text-brand-muted font-medium">Selecione suas disponibilidades para esta data</p>
              </div>
              <button 
                onClick={() => {
                  setIsEmployeeChoiceModalOpen(false);
                  setEmployeeChoiceDate(null);
                }} 
                className="text-brand-muted hover:text-brand-text hover:bg-brand-primary/10 p-1.5 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Common Option */}
              {(() => {
                const dateStr = format(employeeChoiceDate, 'yyyy-MM-dd');
                const currentAvailabilities = myEmployee.availabilities || [];
                const isCommonChecked = currentAvailabilities.includes(dateStr) || currentAvailabilities.includes(`${dateStr}_common`);
                
                return (
                  <label className={cn(
                    "flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-all",
                    isCommonChecked 
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400" 
                      : "bg-brand-bg/40 border-brand-border text-brand-muted hover:border-brand-primary/30"
                  )}>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-brand-text">Dia CCSP</span>
                      <span className="text-xs text-brand-muted">Trabalho padrão do dia a dia</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={isCommonChecked}
                      onChange={(e) => {
                        let newAvail: string[];
                        if (e.target.checked) {
                          newAvail = [...currentAvailabilities, `${dateStr}_common`];
                        } else {
                          newAvail = currentAvailabilities.filter(d => d !== dateStr && d !== `${dateStr}_common`);
                        }
                        if (onUpdateAvailabilities) {
                          onUpdateAvailabilities(myEmployee.id, newAvail);
                        }
                      }}
                      className="rounded border-brand-border text-emerald-500 bg-brand-bg focus:ring-emerald-500 w-5 h-5 cursor-pointer"
                    />
                  </label>
                );
              })()}

              {/* Party Option(s) */}
              {(() => {
                const dateStr = format(employeeChoiceDate, 'yyyy-MM-dd');
                const currentAvailabilities = myEmployee.availabilities || [];
                const config = getDayConfig(dateStr);
                const parties = config.parties && config.parties.length > 0 
                  ? config.parties 
                  : (config.isParty ? [{ id: 'default_party', name: 'Festa', time: config.partyTime }] : []);
                
                return (
                  <>
                    {parties.map((party) => {
                      const partyKey = `${dateStr}_party_${party.id}`;
                      const isPartyChecked = currentAvailabilities.includes(partyKey) || currentAvailabilities.includes(`${dateStr}_party`);

                      return (
                        <label key={party.id} className={cn(
                          "flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-all",
                          isPartyChecked 
                            ? "bg-purple-500/10 border-purple-500/50 text-purple-600 dark:text-purple-300" 
                            : "bg-brand-bg/40 border-brand-border text-brand-muted hover:border-brand-primary/30"
                        )}>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-brand-text flex items-center gap-1.5">
                              <span>🎉</span>
                              <span>{party.name}</span>
                            </span>
                            {party.time ? (
                              <span className="text-xs text-purple-600 dark:text-purple-300 font-bold mt-1">Horário: {party.time}</span>
                            ) : (
                              <span className="text-xs text-brand-muted">Trabalhar em eventos e festas extras</span>
                            )}
                          </div>
                          <input 
                            type="checkbox"
                            checked={isPartyChecked}
                            onChange={(e) => {
                              let newAvail: string[];
                              if (e.target.checked) {
                                newAvail = [...currentAvailabilities, partyKey, `${dateStr}_party`];
                              } else {
                                newAvail = currentAvailabilities.filter(d => d !== partyKey && d !== `${dateStr}_party`);
                              }
                              if (onUpdateAvailabilities) {
                                onUpdateAvailabilities(myEmployee.id, newAvail);
                              }
                            }}
                            className="rounded border-brand-border text-purple-500 bg-brand-bg focus:ring-purple-500 w-5 h-5 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => {
                  setIsEmployeeChoiceModalOpen(false);
                  setEmployeeChoiceDate(null);
                }}
                className="bg-brand-primary hover:bg-brand-primary-hover text-slate-900 font-extrabold py-2.5 px-8 rounded-xl transition-all shadow-lg text-sm"
              >
                SALVAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Management Modal (Focus View) */}
      {isAdmin && !isReadOnly && (
        <DayManagementModal 
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          selectedDay={selectedDay}
          employees={employees}
          onUpdateDays={onUpdateDays}
          copiedTeam={copiedTeam}
          onCopyTeam={handleCopyTeam}
          onPasteTeam={handlePasteTeam}
          dayConfig={selectedDay ? getDayConfig(format(selectedDay, 'yyyy-MM-dd')) : { isCommon: false, isParty: false, partyTime: '' }}
          onUpdateDayConfig={onUpdateDayConfig || (() => {})}
        />
      )}

      {/* Employee Cancellation Modal */}
      {!isAdmin && isCancelModalOpen && cancelTargetDate && myEmployee && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-brand-text">Cancelar Escala?</h3>
              <div className="text-brand-muted text-sm leading-relaxed space-y-2">
                <p>
                  Você está escalado para trabalhar no dia <span className="text-brand-primary font-bold">{format(cancelTargetDate, "dd/MM 'de' MMMM", { locale: ptBR })}</span>.
                </p>
                <p className="text-xs text-brand-muted">
                  Deseja realmente solicitar o cancelamento da sua escala para esta data? Os administradores serão notificados imediatamente.
                </p>
              </div>
            </div>
            <div className="p-4 bg-brand-bg/50 border-t border-brand-border flex gap-3">
              <button 
                type="button"
                disabled={isCancellingLoading}
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancelTargetDate(null);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                Voltar
              </button>
              <button 
                type="button"
                disabled={isCancellingLoading}
                onClick={handleConfirmCancellation}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCancellingLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
