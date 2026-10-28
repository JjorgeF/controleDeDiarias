import React from 'react';
import { X, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, Users, Plus, Trash2, PartyPopper, ChevronDown, ChevronUp, Zap, Lock, ShieldCheck, Target, Check, Wrench, Briefcase, Moon } from 'lucide-react';
import { Employee, WorkDay, DayType, DayConfig, PartyConfig } from '../types';
import { format, isSunday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency, checkShiftsOverlap } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ShiftSelector from './ShiftSelector';
import DayWorkModeEditor from './DayWorkModeEditor';

interface DayManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: Date | null;
  employees: Employee[];
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void;
  copiedTeam: string[] | null;
  onCopyTeam: () => void;
  onPasteTeam: () => void;
  dayConfig: DayConfig;
  onUpdateDayConfig: (dateStr: string, config: DayConfig) => void;
  isAdmin?: boolean;
  isReadOnly?: boolean;
}

export default function DayManagementModal({
  isOpen,
  onClose,
  selectedDay,
  employees,
  onUpdateDays,
  copiedTeam,
  onCopyTeam,
  onPasteTeam,
  dayConfig,
  onUpdateDayConfig,
  isAdmin = true,
  isReadOnly = false
}: DayManagementModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);
  const [isEventsExpanded, setIsEventsExpanded] = React.useState(true);
  const [isApoioMenuOpen, setIsApoioMenuOpen] = React.useState(false);

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';

  // Normalize parties list
  const normalizedParties: PartyConfig[] = React.useMemo(() => {
    if (dayConfig?.parties && dayConfig.parties.length > 0) {
      return dayConfig.parties;
    }
    if (dayConfig?.isParty) {
      return [{
        id: 'default_party',
        name: 'Festa',
        time: dayConfig.partyTime || ''
      }];
    }
    return [];
  }, [dayConfig]);

  const parsePartyTime = (timeStr?: string) => {
    if (!timeStr) return { start: '', end: '' };
    const parts = timeStr.split(/\s*até\s*/i);
    if (parts.length === 2) {
      const start = parts[0].replace(/h$/i, '').trim();
      const end = parts[1].replace(/h$/i, '').trim();
      return { start, end };
    }
    const clean = timeStr.replace(/h$/i, '').trim();
    return { start: clean, end: '' };
  };

  const handleAddParty = () => {
    const newParty: PartyConfig = {
      id: 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
      name: `Festa ${normalizedParties.length + 1}`,
      time: ''
    };
    const updatedParties = [...normalizedParties, newParty];
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: true,
      parties: updatedParties
    });
    setIsEventsExpanded(true);
  };

  const handleAddCoordination = () => {
    const existing = normalizedParties.find(p => (p.name || '').toLowerCase().includes('coordena'));
    if (existing) {
      setIsEventsExpanded(true);
      setIsApoioMenuOpen(false);
      return;
    }
    const newCoord: PartyConfig = {
      id: 'p_coord_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
      name: 'Coordenação',
      time: ''
    };
    const updatedParties = [...normalizedParties, newCoord];
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: true,
      parties: updatedParties
    });
    setIsEventsExpanded(true);
    setIsApoioMenuOpen(false);
  };

  const handleAddOffice = () => {
    const existing = normalizedParties.find(p => (p.name || '').toLowerCase().includes('escritório') || (p.name || '').toLowerCase().includes('escritorio'));
    if (existing) {
      setIsEventsExpanded(true);
      setIsApoioMenuOpen(false);
      return;
    }
    const newOffice: PartyConfig = {
      id: 'p_office_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
      name: 'Escritório',
      time: ''
    };
    const updatedParties = [...normalizedParties, newOffice];
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: true,
      parties: updatedParties
    });
    setIsEventsExpanded(true);
    setIsApoioMenuOpen(false);
  };

  const handleAddJanitor = () => {
    const existing = normalizedParties.find(p => (p.name || '').toLowerCase().includes('zelador'));
    if (existing) {
      setIsEventsExpanded(true);
      setIsApoioMenuOpen(false);
      return;
    }
    const newJanitor: PartyConfig = {
      id: 'p_janitor_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
      name: 'Zeladoria',
      time: ''
    };
    const updatedParties = [...normalizedParties, newJanitor];
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: true,
      parties: updatedParties
    });
    setIsEventsExpanded(true);
    setIsApoioMenuOpen(false);
  };

  const handleUpdateParty = (partyId: string, field: 'name' | 'time', value: string) => {
    const updatedParties = normalizedParties.map(p => 
      p.id === partyId ? { ...p, [field]: value } : p
    );
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: updatedParties.length > 0,
      parties: updatedParties
    });
  };

  const handleRemoveParty = (partyId: string) => {
    const updatedParties = normalizedParties.filter(p => p.id !== partyId);
    onUpdateDayConfig(selectedDayStr, {
      ...dayConfig,
      isParty: updatedParties.length > 0,
      parties: updatedParties
    });

    // Clean up employees scheduled for this deleted party on selectedDayStr
    employees.forEach(emp => {
      const isAssigned = emp.workDays.some(d => 
        d.date === selectedDayStr && 
        d.type === 'party' && 
        (d.partyId === partyId || (!d.partyId && partyId === 'default_party'))
      );
      if (isAssigned) {
        const newDays = emp.workDays.filter(d => 
          !(d.date === selectedDayStr && d.type === 'party' && (d.partyId === partyId || (!d.partyId && partyId === 'default_party')))
        );
        onUpdateDays(emp.id, newDays);
      }
    });
  };

  const sortByName = (a: Employee, b: Employee) => {
    const nameA = a.artisticName || a.name || '';
    const nameB = b.artisticName || b.name || '';
    return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
  };

  const employeesWorking = React.useMemo(() => {
    if (!selectedDayStr) return [];
    return employees
      .filter(emp => emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled))
      .sort(sortByName);
  }, [employees, selectedDayStr]);

  const filteredAvailable = React.useMemo(() => {
    if (!selectedDayStr) return [];
    return employees.filter(emp => 
      emp.status !== 'inactive' &&
      !emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled) &&
      (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       (emp.artisticName && emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  }, [employees, selectedDayStr, searchQuery]);

  const availableMarked = React.useMemo(() => {
    return filteredAvailable
      .filter(emp => {
        const commonAvailable = !!dayConfig?.isCommon && 
          (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));
        const partyAvailable = (normalizedParties.length > 0 || !!dayConfig?.isParty) && 
          (emp.availabilities?.some(av => av.startsWith(`${selectedDayStr}_party`)));
        return commonAvailable || partyAvailable;
      })
      .sort(sortByName);
  }, [filteredAvailable, dayConfig, normalizedParties, selectedDayStr]);

  const availableOthers = React.useMemo(() => {
    return filteredAvailable
      .filter(emp => {
        const commonAvailable = !!dayConfig?.isCommon && 
          (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));
        const partyAvailable = (normalizedParties.length > 0 || !!dayConfig?.isParty) && 
          (emp.availabilities?.some(av => av.startsWith(`${selectedDayStr}_party`)));
        return !commonAvailable && !partyAvailable;
      })
      .sort(sortByName);
  }, [filteredAvailable, dayConfig, normalizedParties, selectedDayStr]);

  // Main assignment function supporting multiple assignments per person per day (CCSP + Parties)
  const assignEmployee = (employee: Employee, targetType: 'common' | 'party', party?: PartyConfig) => {
    const currentWorkDays = employee.workDays || [];

    if (targetType === 'common') {
      const existingCommon = currentWorkDays.find(d => d.date === selectedDayStr && d.type === 'common' && !d.isCancelled);
      if (existingCommon) {
        // Toggle OFF CCSP only (leaves any party workdays on this date intact!)
        const newDays = currentWorkDays.filter(d => !(d.date === selectedDayStr && d.type === 'common'));
        onUpdateDays(employee.id, newDays);
        return;
      }

      const defaultShift = (selectedDay && isSunday(selectedDay)) ? 'Brinquedoteca (9h - 18h)' : 'Brinquedoteca 1 (9h - 18h)';
      const newDays: WorkDay[] = [...currentWorkDays, {
        id: `${selectedDayStr}_common_${Date.now()}`,
        date: selectedDayStr,
        type: 'common',
        shift: defaultShift,
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: (employee.extraHourRate && employee.extraHourRate > 0) ? employee.extraHourRate : 30,
        levelAtTime: employee.level
      }];
      onUpdateDays(employee.id, newDays);
    } else if (targetType === 'party' && party) {
      const isThisParty = (d: WorkDay) => 
        d.date === selectedDayStr && 
        d.type === 'party' && 
        !d.isCancelled &&
        (d.partyId === party.id || (!d.partyId && party.id === 'default_party') || d.partyName === party.name);

      const existingParty = currentWorkDays.find(isThisParty);
      if (existingParty) {
        // Toggle OFF this specific party only (leaves CCSP or other parties intact!)
        const newDays = currentWorkDays.filter(d => !isThisParty(d));
        onUpdateDays(employee.id, newDays);
        return;
      }

      const isOffice = (party.name || '').toLowerCase().includes('escritório') || (party.name || '').toLowerCase().includes('escritorio');
      const isJanitor = (party.name || '').toLowerCase().includes('zelador');

      let customTotalPay: number | undefined = undefined;
      let isReducedHours = false;
      let customHoursText = '';

      if (isOffice) {
        const timeStr = party.time || dayConfig?.partyTime || '';
        const parts = timeStr.split(/\s*até\s*/i);
        let hours = 0;
        if (parts.length === 2) {
          const s = parts[0].replace(/h$/i, '').trim();
          const e = parts[1].replace(/h$/i, '').trim();
          const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return (h || 0) + (m || 0) / 60;
          };
          if (s.includes(':') && e.includes(':')) {
            const startH = parseTime(s);
            const endH = parseTime(e);
            hours = endH >= startH ? endH - startH : (endH + 24) - startH;
          }
        }
        isReducedHours = true;
        const formattedHours = hours > 0 ? hours.toString().replace('.', ',') + 'h' : 'Acordo';
        customHoursText = `${formattedHours} (Escritório)`;
        customTotalPay = hours > 0 ? hours * (employee.officeHourRate || 0) : 0;
      } else if (isJanitor) {
        isReducedHours = true;
        customHoursText = 'Zeladoria';
        customTotalPay = employee.janitorRate || 0;
      }

      const newDays: WorkDay[] = [...currentWorkDays, {
        id: `${selectedDayStr}_party_${party.id}_${Date.now()}`,
        date: selectedDayStr,
        type: 'party',
        partyId: party.id,
        partyName: party.name,
        shift: party.time || dayConfig?.partyTime || '',
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: (employee.extraHourRate && employee.extraHourRate > 0) ? employee.extraHourRate : 30,
        levelAtTime: employee.level,
        ...((isOffice || isJanitor) && {
          isReducedHours,
          customHoursText,
          customTotalPay
        })
      }];
      onUpdateDays(employee.id, newDays);
    }
  };

  const removeAllWork = (employee: Employee) => {
    const newDays = employee.workDays.filter(d => d.date !== selectedDayStr);
    onUpdateDays(employee.id, newDays);
  };

  const removeSingleWork = (employee: Employee, targetWorkDay: WorkDay) => {
    const newDays = employee.workDays.filter(d => d !== targetWorkDay);
    onUpdateDays(employee.id, newDays);
  };

  const updateShift = (employee: Employee, shiftStr: string) => {
    const newDays = employee.workDays.map(d => 
      d.date === selectedDayStr && d.type === 'common' && !d.isCancelled
        ? { ...d, shift: shiftStr }
        : d
    );
    onUpdateDays(employee.id, newDays);
  };

  const updateExtraHours = (employee: Employee, hours: number) => {
    const defaultRate = (employee.extraHourRate && employee.extraHourRate > 0) ? employee.extraHourRate : 30;
    const newDays = employee.workDays.map(d => 
      d.date === selectedDayStr && !d.isCancelled ? { 
        ...d, 
        extraHours: hours,
        extraHourRateAtTime: (d.extraHourRateAtTime && d.extraHourRateAtTime > 0)
          ? d.extraHourRateAtTime
          : defaultRate
      } : d
    );
    onUpdateDays(employee.id, newDays);
  };

  const setDayWorkMode = (
    employee: Employee, 
    mode: 'normal' | 'reduced' | 'overnight',
    options?: {
      customHours?: string;
      customPay?: number;
      overnightHours?: string;
      overnightPay?: number;
    }
  ) => {
    const newDays = employee.workDays.map(d => {
      if (d.date === selectedDayStr && !d.isCancelled) {
        const updated: WorkDay = { ...d };
        if (mode === 'normal') {
          updated.isReducedHours = false;
          updated.isOvernight = false;
          delete updated.customHoursText;
          delete updated.customTotalPay;
          delete updated.overnightHoursText;
          delete updated.overnightPay;
        } else if (mode === 'reduced') {
          updated.isReducedHours = true;
          updated.isOvernight = false;
          updated.customHoursText = options?.customHours !== undefined ? options.customHours : (d.customHoursText || '01h30m');
          updated.customTotalPay = options?.customPay !== undefined ? options.customPay : (d.customTotalPay !== undefined ? d.customTotalPay : 45.0);
          delete updated.overnightHoursText;
          delete updated.overnightPay;
        } else if (mode === 'overnight') {
          updated.isOvernight = true;
          updated.isReducedHours = false;
          updated.overnightHoursText = options?.overnightHours !== undefined ? options.overnightHours : (d.overnightHoursText || '22h às 08h');
          updated.overnightPay = options?.overnightPay !== undefined ? options.overnightPay : (d.overnightPay !== undefined ? d.overnightPay : 150.0);
          delete updated.customHoursText;
          delete updated.customTotalPay;
        }
        return updated;
      }
      return d;
    });
    onUpdateDays(employee.id, newDays);
  };

  const updateReducedHoursConfig = (employee: Employee, isReduced: boolean, customHours?: string, customPay?: number) => {
    if (isReduced) {
      setDayWorkMode(employee, 'reduced', { customHours, customPay });
    } else {
      setDayWorkMode(employee, 'normal');
    }
  };

  const updateOvernightConfig = (employee: Employee, isOvernight: boolean, overnightHours?: string, overnightPay?: number) => {
    if (isOvernight) {
      setDayWorkMode(employee, 'overnight', { overnightHours, overnightPay });
    } else {
      setDayWorkMode(employee, 'normal');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && selectedDay && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="bg-brand-card border border-brand-border w-full max-w-3xl md:max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-brand-border flex items-center justify-between bg-brand-bg/30">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                  <Users size={20} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-black text-white capitalize leading-tight">
                    {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-400 font-medium">{format(selectedDay, "EEEE", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button 
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isSearchOpen) setSearchQuery('');
                  }}
                  className={cn(
                    "p-1.5 md:p-2 rounded-lg transition-all flex items-center gap-1.5",
                    isSearchOpen || searchQuery
                      ? "text-brand-primary bg-brand-primary/10 border border-brand-primary/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                  title={isSearchOpen ? "Fechar busca" : "Buscar recreador"}
                >
                  <Search size={18} className="md:w-5 md:h-5" />
                </button>
                <button 
                  onClick={onCopyTeam}
                  className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  title="Copiar Time"
                >
                  <Copy size={18} className="md:w-5 md:h-5" />
                </button>
                <button 
                  onClick={onPasteTeam}
                  disabled={!copiedTeam}
                  className={cn(
                    "p-1.5 md:p-2 rounded-lg transition-all",
                    copiedTeam ? "text-brand-primary hover:bg-brand-primary/10" : "text-gray-600 cursor-not-allowed"
                  )}
                  title="Colar Time"
                >
                  <ClipboardPaste size={18} className="md:w-5 md:h-5" />
                </button>
                <div className="w-px h-5 md:h-6 bg-brand-border mx-1 md:mx-2" />
                <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/5 p-1.5 md:p-2 rounded-lg transition-all">
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Collapsible Search Input */}
            <AnimatePresence>
              {(isSearchOpen || searchQuery) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 md:px-6 md:py-3 border-b border-brand-border bg-brand-bg/80 backdrop-blur-md overflow-hidden"
                >
                  <div className="relative flex items-center">
                    <Search className="absolute left-3.5 text-brand-primary shrink-0" size={16} />
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Buscar recreador por nome ou nome artístico..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-brand-bg/90 border border-brand-primary/40 rounded-xl py-2 pl-10 pr-9 text-xs md:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all shadow-inner"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-gray-400 hover:text-white text-xs font-bold p-1"
                        title="Limpar busca"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Day Configuration Section - Unified "INFOS DO DIA" */}
            <div className="bg-brand-bg/40 border-b border-brand-border p-3 md:px-6 transition-all">
              {/* Header Bar */}
              <div 
                onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                className="flex items-center justify-between gap-2 cursor-pointer group select-none py-1"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-1.5 rounded-lg bg-brand-bg border border-brand-border text-gray-400 group-hover:text-white group-hover:border-brand-primary transition-all shrink-0">
                    {isEventsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-black text-gray-200 uppercase tracking-wider group-hover:text-brand-primary transition-colors flex items-center gap-2">
                      <span>INFOS DO DIA</span>
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
                      {isEventsExpanded ? "Clique para recolher e focar nos recreadores" : "Clique para gerenciar festas, CCSP e abertura extra"}
                    </p>
                  </div>
                </div>

                {/* Summary Badges when Collapsed or Always Visible */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-[60%] justify-end">
                  {dayConfig.isCommon && (
                    <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/30 px-2 py-0.5 rounded-md">
                      CCSP
                    </span>
                  )}
                  {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena') && !(p.name || '').toLowerCase().includes('escritório') && !(p.name || '').toLowerCase().includes('escritorio') && !(p.name || '').toLowerCase().includes('zelador')).length > 0 && (
                    <span className="text-[10px] font-bold text-brand-party bg-brand-party/40 border border-brand-party/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>🎉</span>
                      <span>
                        {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena') && !(p.name || '').toLowerCase().includes('escritório') && !(p.name || '').toLowerCase().includes('escritorio') && !(p.name || '').toLowerCase().includes('zelador')).length}{' '}
                        {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena') && !(p.name || '').toLowerCase().includes('escritório') && !(p.name || '').toLowerCase().includes('escritorio') && !(p.name || '').toLowerCase().includes('zelador')).length === 1 ? 'Festa' : 'Festas'}
                      </span>
                    </span>
                  )}
                  {normalizedParties.some(p => (p.name || '').toLowerCase().includes('coordena')) && (
                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck size={11} className="text-cyan-300" />
                      <span>Coordenação</span>
                    </span>
                  )}
                  {normalizedParties.some(p => (p.name || '').toLowerCase().includes('escritório') || (p.name || '').toLowerCase().includes('escritorio')) && (
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-950/40 border border-blue-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Briefcase size={11} className="text-blue-300" />
                      <span>Escritório</span>
                    </span>
                  )}
                  {normalizedParties.some(p => (p.name || '').toLowerCase().includes('zelador')) && (
                    <span className="text-[10px] font-bold text-zinc-300 bg-zinc-950/40 border border-zinc-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Wrench size={11} className="text-zinc-300" />
                      <span>Zeladoria</span>
                    </span>
                  )}
                  {dayConfig.isExtraordinaryOpen && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Zap size={11} className="fill-amber-400 text-amber-400" />
                      <span className="hidden xs:inline">Abertura Extra</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Content Area */}
              <AnimatePresence>
                {isEventsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 pt-3 pb-1 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1.5 custom-scrollbar"
                  >
                    {/* Toggles & Add Party Button */}
                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                      <button
                        onClick={() => onUpdateDayConfig(selectedDayStr, { ...dayConfig, isCommon: !dayConfig.isCommon })}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 border",
                          dayConfig.isCommon !== false
                            ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/80 ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-500/20"
                            : "bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500/70 border-emerald-500/30 hover:border-emerald-500/40"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-4 h-4 rounded-[4px] transition-all",
                          dayConfig.isCommon !== false 
                            ? "bg-emerald-500 text-slate-900 shadow-sm" 
                            : "bg-emerald-950/50 border border-emerald-500/40 text-transparent"
                        )}>
                          <Check size={12} strokeWidth={4} />
                        </div>
                        <span>CCSP</span>
                      </button>

                      {(() => {
                        const hasRegularParties = normalizedParties.some(p => !(p.name || '').toLowerCase().includes('coordena') && !(p.name || '').toLowerCase().includes('escritório') && !(p.name || '').toLowerCase().includes('escritorio') && !(p.name || '').toLowerCase().includes('zelador'));
                        const hasCoordination = normalizedParties.some(p => (p.name || '').toLowerCase().includes('coordena'));
                        const hasOffice = normalizedParties.some(p => (p.name || '').toLowerCase().includes('escritório') || (p.name || '').toLowerCase().includes('escritorio'));
                        const hasJanitor = normalizedParties.some(p => (p.name || '').toLowerCase().includes('zelador'));
                        
                        const hasAnyApoio = hasCoordination || hasOffice || hasJanitor;

                        return (
                          <>
                            <button
                              onClick={handleAddParty}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 border",
                                hasRegularParties
                                  ? "bg-brand-party/30 text-brand-party border-brand-party/80 ring-1 ring-brand-party/30 shadow-sm shadow-brand-party/20"
                                  : "bg-brand-party/20 hover:bg-brand-party/30 text-brand-party border-brand-party/40"
                              )}
                            >
                              <Plus size={14} />
                              <span>Festa</span>
                            </button>

                            <div className="relative">
                              <button
                                onClick={() => setIsApoioMenuOpen(p => !p)}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 border",
                                  hasAnyApoio
                                    ? "bg-slate-600/30 text-slate-200 border-slate-500/80 ring-1 ring-slate-500/30 shadow-sm shadow-slate-500/20"
                                    : "bg-slate-600/20 hover:bg-slate-600/30 text-slate-300 border-slate-500/40"
                                )}
                              >
                                <Plus size={14} />
                                <span>Atividades Extras</span>
                                <ChevronDown size={14} className={cn("transition-transform ml-0.5", isApoioMenuOpen && "rotate-180")} />
                              </button>

                              <AnimatePresence>
                                {isApoioMenuOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsApoioMenuOpen(false)} />
                                    <motion.div
                                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute top-full right-0 md:left-0 md:right-auto mt-2 min-w-[180px] bg-slate-900 border border-brand-border p-1.5 rounded-xl shadow-2xl z-50 flex flex-col gap-1 overflow-hidden"
                                    >
                                      <button
                                        onClick={handleAddCoordination}
                                        className={cn(
                                          "w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors",
                                          hasCoordination ? "bg-cyan-500/15 text-cyan-300" : "hover:bg-slate-800 text-slate-300"
                                        )}
                                      >
                                        <ShieldCheck size={15} className={hasCoordination ? "text-cyan-400" : "text-slate-400"} /> 
                                        Coordenação
                                      </button>
                                      
                                      <button
                                        onClick={handleAddOffice}
                                        className={cn(
                                          "w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors",
                                          hasOffice ? "bg-blue-500/15 text-blue-300" : "hover:bg-slate-800 text-slate-300"
                                        )}
                                      >
                                        <Briefcase size={15} className={hasOffice ? "text-blue-400" : "text-slate-400"} /> 
                                        Escritório
                                      </button>

                                      <button
                                        onClick={handleAddJanitor}
                                        className={cn(
                                          "w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors",
                                          hasJanitor ? "bg-zinc-500/20 text-zinc-300" : "hover:bg-slate-800 text-slate-300"
                                        )}
                                      >
                                        <Wrench size={15} className={hasJanitor ? "text-zinc-400" : "text-slate-400"} /> 
                                        Zeladoria
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </>
                        );
                      })()}

                      <div className="hidden sm:block w-px h-6 bg-brand-border/60 mx-1" />

                      <button
                        onClick={() => {
                          const isOpening = !dayConfig.isExtraordinaryOpen;
                          let lockedMap = dayConfig.extraordinaryLockedAvailabilities;
                          if (isOpening && !lockedMap) {
                            lockedMap = {};
                            employees.forEach(emp => {
                              const dateStr = selectedDayStr;
                              const empAvails = (emp.availabilities || []).filter(a => a === dateStr || a.startsWith(`${dateStr}_`));
                              if (empAvails.length > 0) {
                                lockedMap![emp.id] = empAvails;
                              }
                            });
                          }
                          onUpdateDayConfig(selectedDayStr, { 
                            ...dayConfig, 
                            isExtraordinaryOpen: isOpening,
                            extraordinaryLockedAvailabilities: lockedMap
                          });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 border",
                          dayConfig.isExtraordinaryOpen
                            ? "bg-amber-500/30 text-amber-300 border-amber-500/80 ring-1 ring-amber-500/30 shadow-sm shadow-amber-500/20"
                            : "bg-amber-600/10 hover:bg-amber-600/20 text-amber-500/70 border-amber-500/30 hover:border-amber-500/40"
                        )}
                        title="Abre este dia para novos envios de disponibilidade, porém trava remoções de quem já enviou."
                      >
                        <div className={cn(
                          "flex items-center justify-center w-4 h-4 rounded-[4px] transition-all",
                          dayConfig.isExtraordinaryOpen 
                            ? "bg-amber-500 text-amber-950 shadow-sm" 
                            : "bg-amber-950/50 border border-amber-500/40 text-transparent"
                        )}>
                          <Check size={12} strokeWidth={4} />
                        </div>
                        <span>Abertura Extra</span>
                      </button>
                    </div>

                    {/* Integrated Abertura Extra Details & Deadline */}
                    {dayConfig.isExtraordinaryOpen && (
                      <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-amber-400 shrink-0 fill-amber-400" />
                          <span className="font-bold text-amber-300">Abertura Extra Ativa</span>
                        </div>
                        
                        <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/20">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 shrink-0">
                            <Clock size={13} className="text-amber-400" />
                            <span>Prazo limite:</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 flex-1 w-full sm:w-auto">
                            <input 
                              type="datetime-local" 
                              value={dayConfig.extraordinaryDeadline || ''}
                              onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, extraordinaryDeadline: e.target.value })}
                              className="bg-brand-bg border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 w-full sm:w-auto font-mono"
                            />
                            {dayConfig.extraordinaryDeadline && (
                              <button
                                type="button"
                                onClick={() => onUpdateDayConfig(selectedDayStr, { ...dayConfig, extraordinaryDeadline: '' })}
                                className="text-[10px] text-amber-400/80 hover:text-amber-300 underline shrink-0"
                                title="Remover prazo e manter a abertura extra ativa indefinidamente"
                              >
                                Limpar prazo
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Escopo da Abertura Extra */}
                        <div className="pt-2 border-t border-amber-500/20 space-y-2">
                          {/* Seleção Granular por Evento/Opção no Dia */}
                          <div className="bg-brand-bg/80 border border-amber-500/30 p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                              <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                                <Target size={13} className="text-amber-400" />
                                <span>Opções Liberadas nesta Abertura Extra:</span>
                              </label>
                              <span className="text-[10px] text-amber-400/80 font-mono hidden xs:inline">
                                (Marque os itens abertos)
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {/* Opção CCSP */}
                              {dayConfig.isCommon && (
                                <label className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 cursor-pointer hover:bg-emerald-950/50 transition-all">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox"
                                      checked={
                                        !dayConfig.extraordinaryScope || 
                                        dayConfig.extraordinaryScope === 'all' || 
                                        dayConfig.extraordinaryScope === 'ccsp' ||
                                        !!dayConfig.extraordinaryCcspOpen
                                      }
                                      onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        const allPartyIds = normalizedParties.map(item => item.id);
                                        const activePartyIds = dayConfig.extraordinaryPartyIds || (dayConfig.extraordinaryScope === 'ccsp' ? [] : allPartyIds);

                                        let nextScope: DayConfig['extraordinaryScope'] = 'custom';
                                        if (isChecked && activePartyIds.length === allPartyIds.length) {
                                          nextScope = 'all';
                                        } else if (!isChecked && activePartyIds.length > 0) {
                                          nextScope = 'parties';
                                        } else if (isChecked && activePartyIds.length === 0) {
                                          nextScope = 'ccsp';
                                        }

                                        onUpdateDayConfig(selectedDayStr, {
                                          ...dayConfig,
                                          extraordinaryScope: nextScope,
                                          extraordinaryCcspOpen: isChecked,
                                          extraordinaryPartyIds: activePartyIds
                                        });
                                      }}
                                      className="rounded border-emerald-400 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-emerald-200">🏢 CCSP (Sede)</span>
                                  </div>
                                  <span className="text-[10px] text-emerald-300/80 font-medium bg-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Escala CCSP
                                  </span>
                                </label>
                              )}

                              {/* Lista de Festas e Apoios */}
                              {normalizedParties.map(p => {
                                const allPartyIds = normalizedParties.map(item => item.id);
                                const isPartyActive = (
                                  !dayConfig.extraordinaryScope || 
                                  dayConfig.extraordinaryScope === 'all' ||
                                  (dayConfig.extraordinaryScope === 'parties' && (!dayConfig.extraordinaryPartyIds || dayConfig.extraordinaryPartyIds.length === 0)) ||
                                  (dayConfig.extraordinaryPartyIds && dayConfig.extraordinaryPartyIds.includes(p.id))
                                );

                                const isCoord = (p.name || '').toLowerCase().includes('coordena');
                                const isOffice = (p.name || '').toLowerCase().includes('escritório') || (p.name || '').toLowerCase().includes('escritorio');
                                const isJanitor = (p.name || '').toLowerCase().includes('zelador');

                                return (
                                  <label 
                                    key={p.id} 
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all",
                                      isCoord
                                        ? "bg-cyan-950/40 border-cyan-500/40 hover:bg-cyan-950/60"
                                        : isOffice
                                          ? "bg-blue-950/40 border-blue-500/40 hover:bg-blue-950/60"
                                          : isJanitor
                                            ? "bg-zinc-950/40 border-zinc-500/40 hover:bg-zinc-900/60"
                                            : "bg-brand-party/30 border-brand-party/30 hover:bg-brand-party/50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox"
                                        checked={isPartyActive}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          let currentActiveIds = dayConfig.extraordinaryPartyIds 
                                            ? [...dayConfig.extraordinaryPartyIds]
                                            : (dayConfig.extraordinaryScope === 'ccsp' ? [] : allPartyIds);

                                          if (isChecked) {
                                            if (!currentActiveIds.includes(p.id)) {
                                              currentActiveIds.push(p.id);
                                            }
                                          } else {
                                            currentActiveIds = currentActiveIds.filter(id => id !== p.id);
                                          }

                                          const isCcspActive = (
                                            !dayConfig.extraordinaryScope || 
                                            dayConfig.extraordinaryScope === 'all' || 
                                            dayConfig.extraordinaryScope === 'ccsp' ||
                                            !!dayConfig.extraordinaryCcspOpen
                                          );

                                          let nextScope: DayConfig['extraordinaryScope'] = 'custom';
                                          if (currentActiveIds.length === allPartyIds.length && isCcspActive) {
                                            nextScope = 'all';
                                          } else if (currentActiveIds.length === allPartyIds.length && !isCcspActive) {
                                            nextScope = 'parties';
                                          } else if (currentActiveIds.length === 0 && isCcspActive) {
                                            nextScope = 'ccsp';
                                          }

                                          onUpdateDayConfig(selectedDayStr, {
                                            ...dayConfig,
                                            extraordinaryScope: nextScope,
                                            extraordinaryPartyIds: currentActiveIds,
                                            extraordinaryCcspOpen: isCcspActive
                                          });
                                        }}
                                        className={cn(
                                          "rounded w-4 h-4 cursor-pointer",
                                          isCoord 
                                            ? "border-cyan-400 text-cyan-500 focus:ring-cyan-500" 
                                            : isOffice 
                                              ? "border-blue-400 text-blue-500 focus:ring-blue-500" 
                                              : isJanitor 
                                                ? "border-zinc-400 text-zinc-400 focus:ring-zinc-400" 
                                                : "border-brand-party text-brand-party focus:ring-brand-party"
                                        )}
                                      />
                                      <div className="flex items-center gap-1.5">
                                        {isCoord ? (
                                          <ShieldCheck size={14} className="text-cyan-400 shrink-0" />
                                        ) : isOffice ? (
                                          <Briefcase size={14} className="text-blue-400 shrink-0" />
                                        ) : isJanitor ? (
                                          <Wrench size={14} className="text-zinc-400 shrink-0" />
                                        ) : (
                                          <span className="text-xs select-none">🎉</span>
                                        )}
                                        <span className={cn(
                                          "text-xs font-bold",
                                          isCoord ? "text-cyan-300" : isOffice ? "text-blue-300" : isJanitor ? "text-zinc-300" : "text-brand-party"
                                        )}>
                                          {p.name || 'Festa'}
                                        </span>
                                      </div>
                                    </div>
                                    {p.time && (
                                      <span className={cn(
                                        "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                                        isCoord 
                                          ? "text-cyan-300/90 bg-cyan-500/20 border-cyan-500/30" 
                                          : isOffice 
                                            ? "text-blue-300/90 bg-blue-500/20 border-blue-500/30" 
                                            : isJanitor 
                                              ? "text-zinc-300/90 bg-zinc-500/20 border-zinc-500/30" 
                                              : "text-brand-party/80 bg-brand-party/20 border-brand-party/30"
                                      )}>
                                        {p.time}
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Integrated Parties List */}
                    {normalizedParties.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {normalizedParties.map((party, idx) => {
                          const { start, end } = parsePartyTime(party.time);
                          const isCoord = (party.name || '').toLowerCase().includes('coordena');
                          const isOffice = (party.name || '').toLowerCase().includes('escritório') || (party.name || '').toLowerCase().includes('escritorio');
                          const isJanitor = (party.name || '').toLowerCase().includes('zelador');

                          const handleTimeUpdate = (newStart: string, newEnd: string) => {
                            let formatted = '';
                            const s = newStart.trim();
                            const e = newEnd.trim();
                            if (s && e) {
                              formatted = `${s}h até ${e}h`;
                            } else if (s) {
                              formatted = `${s}h`;
                            } else if (e) {
                              formatted = `até ${e}h`;
                            }
                            handleUpdateParty(party.id, 'time', formatted);
                          };

                          return (
                            <div 
                              key={party.id || idx} 
                              className={cn(
                                "flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl p-2.5 animate-in fade-in border",
                                isCoord
                                  ? "bg-cyan-950/40 border-cyan-500/40"
                                  : isOffice
                                    ? "bg-blue-950/40 border-blue-500/40"
                                    : isJanitor
                                      ? "bg-zinc-950/40 border-zinc-500/40"
                                      : "bg-brand-party/25 border-brand-party/30"
                              )}
                            >
                              <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
                                {isCoord ? (
                                  <ShieldCheck size={18} className="text-cyan-300 shrink-0" />
                                ) : isOffice ? (
                                  <Briefcase size={18} className="text-blue-400 shrink-0" />
                                ) : isJanitor ? (
                                  <Wrench size={18} className="text-zinc-400 shrink-0" />
                                ) : (
                                  <span className="text-sm select-none">🎉</span>
                                )}
                                <input 
                                  type="text"
                                  placeholder={isCoord ? "Coordenação" : isOffice ? "Escritório" : isJanitor ? "Zeladoria" : "Nome da Festa"}
                                  value={party.name}
                                  onChange={(e) => handleUpdateParty(party.id, 'name', e.target.value)}
                                  className={cn(
                                    "w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-white font-bold placeholder-gray-500 focus:outline-none",
                                    isCoord ? "focus:border-cyan-400 text-cyan-100" : isOffice ? "focus:border-blue-400 text-blue-100" : isJanitor ? "focus:border-zinc-400 text-zinc-100" : "focus:border-brand-party text-white"
                                  )}
                                />
                              </div>

                              <div className="flex items-center justify-between sm:justify-start gap-2">
                                <div className={cn(
                                  "flex items-center gap-1 bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-xs text-white font-semibold",
                                  isCoord ? "focus-within:border-cyan-400" : isOffice ? "focus-within:border-blue-400" : isJanitor ? "focus-within:border-zinc-400" : "focus-within:border-brand-party"
                                )}>
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase shrink-0 mr-0.5",
                                    isCoord ? "text-cyan-300" : isOffice ? "text-blue-400" : isJanitor ? "text-zinc-400" : "text-brand-party"
                                  )}>Horário:</span>
                                  <input 
                                    type="text"
                                    placeholder="12:00"
                                    value={start}
                                    onChange={(e) => handleTimeUpdate(e.target.value, end)}
                                    className="w-12 bg-transparent text-center font-bold text-white focus:outline-none placeholder-gray-600 text-xs"
                                  />
                                  <span className="text-gray-400 font-bold text-[10px] select-none">h até</span>
                                  <input 
                                    type="text"
                                    placeholder="17:00"
                                    value={end}
                                    onChange={(e) => handleTimeUpdate(start, e.target.value)}
                                    className="w-12 bg-transparent text-center font-bold text-white focus:outline-none placeholder-gray-600 text-xs"
                                  />
                                  <span className="text-gray-400 font-bold text-[10px] select-none">h</span>
                                </div>

                                <button 
                                  onClick={() => handleRemoveParty(party.id)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Excluir este evento"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Individual Deadline for Parties */}
                    {normalizedParties.length > 0 && (
                      <div className="pt-2 border-t border-brand-border/50">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault(); 
                            if (dayConfig.partyDeadline) {
                              onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: '' });
                            } else {
                              onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: `${selectedDayStr}T23:59` });
                            }
                          }}
                          className="flex items-center gap-2 text-xs select-none p-2 rounded-lg bg-brand-bg/50 border border-brand-border hover:border-brand-primary/50 transition-all w-full text-left"
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            dayConfig.partyDeadline ? "bg-brand-primary border-brand-primary text-brand-bg" : "bg-brand-bg border-brand-border"
                          )}>
                            {dayConfig.partyDeadline && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <span className="font-bold text-gray-300">Definir limite de envio para Festas/Eventos?</span>
                        </button>
                        
                        {dayConfig.partyDeadline && (
                          <div className="mt-2 ml-1 p-2.5 bg-brand-bg/80 border border-brand-primary/30 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <Clock size={14} className="text-brand-primary shrink-0" />
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <span className="text-[11px] font-bold text-brand-text">Prazo:</span>
                              <input 
                                type="datetime-local" 
                                value={dayConfig.partyDeadline}
                                onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: e.target.value })}
                                className="bg-brand-card border border-brand-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-primary font-mono flex-1 sm:flex-none"
                              />
                            </div>
                            <span className="text-[10px] text-brand-muted leading-tight max-w-[200px]">
                              Após este prazo, a opção de envio de disponibilidade para festas neste dia será bloqueada.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 pb-44">
              {/* Working List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></span>
                    Escalados para este dia ({employeesWorking.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {employeesWorking.map(emp => {
                    const dayWorkDays = emp.workDays.filter(d => d.date === selectedDayStr && !d.isCancelled);
                    const hasCommon = dayWorkDays.some(d => d.type === 'common');
                    const commonWorkDay = dayWorkDays.find(d => d.type === 'common');
                    const partyWorkDays = dayWorkDays.filter(d => d.type === 'party');
                    const isExpanded = expandedEmployeeId === emp.id;

                    const isAnyCoordination = partyWorkDays.some(d => (d.partyName || '').toLowerCase().includes('coordena'));
                    const isAnyParty = partyWorkDays.length > 0;

                    // Check for time overlap between active assignments for this employee
                    const timeOverlapAlerts: string[] = [];
                    if (dayWorkDays.length > 1) {
                      for (let i = 0; i < dayWorkDays.length; i++) {
                        for (let j = i + 1; j < dayWorkDays.length; j++) {
                          const a = dayWorkDays[i];
                          const b = dayWorkDays[j];
                          const shiftA = a.shift || (a.type === 'common' ? '11h - 21h' : '14h até 18h');
                          const shiftB = b.shift || (b.type === 'common' ? '11h - 21h' : '14h até 18h');
                          const nameA = a.type === 'common' ? 'CCSP' : (a.partyName || 'Festa');
                          const nameB = b.type === 'common' ? 'CCSP' : (b.partyName || 'Festa');
                          const overlap = checkShiftsOverlap(shiftA, shiftB);
                          if (overlap.hasOverlap) {
                            timeOverlapAlerts.push(`${nameA} (${shiftA}) e ${nameB} (${shiftB})`);
                          }
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={emp.id} 
                        className={cn(
                          "px-3 py-2.5 rounded-xl transition-all border group",
                          dayWorkDays.length > 1
                            ? "bg-purple-950/20 border-purple-500/40 hover:border-purple-500/60 shadow-sm"
                            : isAnyCoordination
                              ? "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50"
                              : isAnyParty
                                ? "bg-brand-party/20 border-brand-party/30 hover:border-brand-party/50"
                                : "bg-brand-primary/5 border-brand-primary/20 hover:border-brand-primary/40"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="cursor-pointer min-w-0 flex-1 flex items-center gap-2.5" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                            <div className={cn(
                              "w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold border shadow-sm",
                              dayWorkDays.length > 1
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                                : isAnyCoordination
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                  : isAnyParty
                                    ? "bg-brand-party/20 text-brand-party border-brand-party/40"
                                    : "bg-brand-primary/20 text-brand-primary border-brand-primary/30"
                            )}>
                              {emp.photoUrl ? (
                                <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-white truncate group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                                <span className="text-[10px] text-brand-primary font-black uppercase shrink-0">{emp.level}</span>
                                {dayWorkDays.length > 1 && (
                                  <span className="text-[9px] font-black bg-purple-500/25 text-purple-200 border border-purple-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                                    <span>✨</span>
                                    <span>{dayWorkDays.length} Escalas</span>
                                  </span>
                                )}
                              </div>
                              
                              {/* Multi-Select Activity Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {dayConfig.isCommon !== false && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignEmployee(emp, 'common');
                                    }}
                                    className={cn(
                                      "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 border",
                                      hasCommon 
                                        ? "bg-brand-primary text-slate-950 border-brand-primary shadow-md ring-1 ring-brand-primary" 
                                        : "bg-brand-bg border-brand-border text-gray-400 hover:border-brand-primary/50 hover:text-brand-primary"
                                    )}
                                    title={hasCommon ? "Clique para remover CCSP" : "Clique para escalar no CCSP"}
                                  >
                                    {hasCommon && <Check size={11} strokeWidth={3} className="shrink-0" />}
                                    <span>CCSP</span>
                                  </button>
                                )}

                                {normalizedParties.map((party) => {
                                  const isAssignedToThisParty = partyWorkDays.some(d => 
                                    (d.partyId === party.id || (!d.partyId && party.id === 'default_party') || d.partyName === party.name)
                                  );
                                  const isCoord = (party.name || '').toLowerCase().includes('coordena');
                                  const isOffice = (party.name || '').toLowerCase().includes('escritório') || (party.name || '').toLowerCase().includes('escritorio');
                                  const isJanitor = (party.name || '').toLowerCase().includes('zelador');

                                  return (
                                    <button
                                      key={party.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignEmployee(emp, 'party', party);
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 max-w-[200px] truncate border",
                                        isAssignedToThisParty 
                                          ? isOffice
                                            ? "bg-blue-500 text-white font-bold border-blue-400 shadow-md ring-1 ring-blue-300"
                                            : isJanitor
                                              ? "bg-zinc-500 text-white font-bold border-zinc-400 shadow-md ring-1 ring-zinc-300"
                                              : isCoord
                                                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md ring-1 ring-cyan-300"
                                                : "bg-brand-party text-white border-brand-party shadow-md ring-1 ring-brand-party" 
                                          : isOffice
                                            ? "bg-blue-950/40 border-blue-500/50 text-blue-300 hover:border-blue-400 hover:bg-blue-900/60"
                                            : isJanitor
                                              ? "bg-zinc-950/40 border-zinc-500/50 text-zinc-300 hover:border-zinc-400 hover:bg-zinc-900/60"
                                              : isCoord
                                                ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60"
                                                : "bg-brand-bg border-brand-border text-gray-400 hover:border-brand-party/50 hover:text-brand-party"
                                      )}
                                      title={isAssignedToThisParty ? `Clique para remover de ${party.name}` : `Escalar para ${party.name}${party.time ? ` (${party.time})` : ''}`}
                                    >
                                      {isAssignedToThisParty ? (
                                        <Check size={11} strokeWidth={3} className="shrink-0" />
                                      ) : isOffice ? (
                                        <Briefcase size={11} className="shrink-0 text-blue-300" />
                                      ) : isJanitor ? (
                                        <Wrench size={11} className="shrink-0 text-zinc-300" />
                                      ) : isCoord ? (
                                        <ShieldCheck size={11} className="shrink-0 text-cyan-300" />
                                      ) : (
                                        <span className="shrink-0">🎉</span>
                                      )}
                                      <span className="truncate">{party.name}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Shift Selector for CCSP */}
                              {hasCommon && (
                                <div className="mt-2 pt-2 border-t border-brand-primary/10" onClick={(e) => e.stopPropagation()}>
                                  <ShiftSelector
                                    currentShift={commonWorkDay?.shift || 'Definir Horário'}
                                    dateStr={selectedDayStr}
                                    onChange={(newShift) => updateShift(emp, newShift)}
                                  />
                                </div>
                              )}

                              {/* Badges for active modes / extra hours per assignment */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {dayWorkDays.map(wd => {
                                  const label = wd.type === 'common' ? 'CCSP' : (wd.partyName || 'Festa');
                                  const showName = dayWorkDays.length > 1;
                                  return (
                                    <React.Fragment key={wd.id || `${wd.type}_${wd.partyId}`}>
                                      {wd.isOvernight && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40 shadow-sm">
                                          <Moon size={10} className="text-indigo-300" /> {showName ? `${label}: ` : ''}Pernoite ({wd.overnightHoursText || '22h às 08h'}) +{formatCurrency(wd.overnightPay || 0)}
                                        </span>
                                      )}
                                      {wd.isReducedHours && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 shadow-sm">
                                          <Clock size={10} className="text-amber-300" /> {showName ? `${label}: ` : ''}Reduzido ({wd.customHoursText || 'Acordo'}): {formatCurrency(wd.customTotalPay || 0)}
                                        </span>
                                      )}
                                      {!!wd.extraHours && (
                                        <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                          {showName ? `${label}: ` : ''}+{wd.extraHours}h extra ({formatCurrency(wd.extraHours * ((wd.extraHourRateAtTime && wd.extraHourRateAtTime > 0) ? wd.extraHourRateAtTime : (emp.extraHourRate || 0)))})
                                        </span>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>

                              {/* Visual Alert for Time Overlap / Conflict */}
                              {timeOverlapAlerts.length > 0 && (
                                <div className="mt-2 p-2 bg-amber-500/15 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 flex items-start gap-2 shadow-sm animate-in fade-in">
                                  <span className="text-amber-400 text-sm leading-none shrink-0 mt-0.5">⚠️</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-extrabold text-amber-300">Atenção: Choque de Horários</p>
                                    <p className="text-[10px] text-amber-100 font-medium leading-tight mt-0.5">
                                      {timeOverlapAlerts.join(' coincide com ')}.
                                    </p>
                                    <p className="text-[9px] text-amber-300/80 font-bold mt-1">
                                      ✓ Conforme regra definida, ambas as escalas serão mantidas e remuneradas com valor integral.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {dayWorkDays.length > 0 && (
                              <button 
                                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isExpanded 
                                    ? "text-brand-primary bg-brand-primary/20" 
                                    : dayWorkDays.some(d => d.isOvernight)
                                      ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                                      : dayWorkDays.some(d => d.isReducedHours)
                                        ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                                        : "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10"
                                )}
                                title={dayWorkDays.some(d => d.isOvernight) ? "Configurar Pernoite" : dayWorkDays.some(d => d.isReducedHours) ? "Configurar Horário Reduzido" : "Horas Extras e Configurações"}
                              >
                                {dayWorkDays.some(d => d.isOvernight) ? <Moon size={16} /> : <Clock size={16} />}
                              </button>
                            )}
                            <button 
                              onClick={() => removeAllWork(emp)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remover todas as escalas deste dia"
                            >
                              <UserMinus size={18} />
                            </button>
                          </div>
                        </div>
                        
                        {isExpanded && dayWorkDays.length > 0 && (
                          <DayWorkModeEditor
                            employee={emp}
                            selectedDayStr={selectedDayStr}
                            onUpdateDays={onUpdateDays}
                            onClose={() => setExpandedEmployeeId(null)}
                            isAdmin={isAdmin}
                            isReadOnly={isReadOnly}
                          />
                        )}
                      </div>
                    );
                  })}

                  {employeesWorking.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-brand-border rounded-2xl bg-brand-bg/5">
                      <p className="text-sm text-gray-500 font-medium italic">Ninguém escalado para este dia.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Available List */}
              {(searchQuery || employeesWorking.length < 10) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  {/* Explicitly Available */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Disponíveis para este dia ({availableMarked.length})
                      </h4>
                      {(() => {
                        const extraCount = availableMarked.filter(emp => {
                          const lockedKeys = dayConfig.extraordinaryLockedAvailabilities?.[emp.id] || [];
                          const hasLockedMap = !!dayConfig.extraordinaryLockedAvailabilities;
                          const empAvails = (emp.availabilities || []).filter(a => a === selectedDayStr || a.startsWith(`${selectedDayStr}_`));
                          return empAvails.length > 0 && (hasLockedMap ? empAvails.some(a => !lockedKeys.includes(a)) : (!!dayConfig.isExtraordinaryOpen));
                        }).length;

                        if (extraCount === 0) return null;
                        return (
                          <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                            <Zap size={11} className="fill-amber-400 text-amber-400" />
                            {extraCount} na Abertura Extra
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableMarked.map(emp => {
                        const isDispCommon = (dayConfig.isCommon !== false) && 
                          (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));

                        const isDispPartyGeneral = emp.availabilities?.includes(`${selectedDayStr}_party`);

                        const hasSpecificPartyAvail = (partyId: string) => {
                          return isDispPartyGeneral || emp.availabilities?.includes(`${selectedDayStr}_party_${partyId}`);
                        };

                        const hasAnyPartyAvail = isDispPartyGeneral || emp.availabilities?.some(a => a.startsWith(`${selectedDayStr}_party`));

                        const activePartyButtons = normalizedParties.filter(party => hasSpecificPartyAvail(party.id));

                        const lockedKeys = dayConfig.extraordinaryLockedAvailabilities?.[emp.id] || [];
                        const hasLockedMap = !!dayConfig.extraordinaryLockedAvailabilities;
                        const empAvails = (emp.availabilities || []).filter(a => a === selectedDayStr || a.startsWith(`${selectedDayStr}_`));
                        const isExtraAvail = empAvails.length > 0 && (
                          hasLockedMap ? empAvails.some(a => !lockedKeys.includes(a)) : (!!dayConfig.isExtraordinaryOpen)
                        );

                        return (
                          <div 
                            key={emp.id} 
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl gap-2 transition-all",
                              isExtraAvail 
                                ? "bg-amber-950/40 border-2 border-amber-500/60 shadow-md" 
                                : "bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/50"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={cn(
                                "w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold border shadow-sm",
                                isExtraAvail 
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50" 
                                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              )}>
                                {emp.photoUrl ? (
                                  <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{emp.artisticName || emp.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-emerald-400 font-bold uppercase truncate">{emp.level}</span>
                                  {isExtraAvail && (
                                    <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap shadow-xs" title="Disponibilidade enviada durante Abertura Extra">
                                      <Zap size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                                      Extra
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1 shrink-0">
                              {isDispCommon && (
                                <button 
                                  onClick={() => assignEmployee(emp, 'common')}
                                  className="text-[10px] font-black bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg px-2 py-1 rounded-lg border border-brand-primary/30 transition-all flex items-center gap-1 uppercase"
                                  title="Escalar para CCSP (Optado pelo recreador)"
                                >
                                  <UserPlus size={12} />
                                  CCSP
                                </button>
                              )}

                              {normalizedParties.length > 0 ? (
                                activePartyButtons.map(party => {
                                  const isCoord = (party.name || '').toLowerCase().includes('coordena');
                                  return (
                                    <button 
                                      key={party.id}
                                      onClick={() => assignEmployee(emp, 'party', party)}
                                      className={cn(
                                        "text-[10px] font-black px-2 py-1 rounded-lg transition-all flex items-center gap-1 uppercase max-w-[130px] truncate border",
                                        isCoord
                                          ? "bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border-cyan-500/40"
                                          : "bg-brand-party/10 hover:bg-brand-party text-brand-party hover:text-white border-brand-party/30"
                                      )}
                                      title={`Escalar para ${party.name} (Optado pelo recreador)`}
                                    >
                                      {isCoord ? <ShieldCheck size={12} className="shrink-0" /> : <UserPlus size={12} className="shrink-0" />}
                                      <span className="truncate">{party.name}</span>
                                    </button>
                                  );
                                })
                              ) : (
                                hasAnyPartyAvail && dayConfig.isParty && (
                                  <button 
                                    onClick={() => assignEmployee(emp, 'party', { id: 'default_party', name: 'Festa' })}
                                    className="text-[10px] font-black bg-brand-party/10 hover:bg-brand-party text-brand-party hover:text-white px-2 py-1 rounded-lg border border-brand-party/30 transition-all flex items-center gap-1 uppercase"
                                    title="Escalar para Festa (Optado pelo recreador)"
                                  >
                                    <UserPlus size={12} />
                                    Festa
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {availableMarked.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2 col-span-full">Ninguém sinalizou disponibilidade para este dia.</p>
                      )}
                    </div>
                  </div>

                  {/* Other Recreadores */}
                  <div>
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-3">
                      Outros Recreadores ({availableOthers.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableOthers.map(emp => (
                        <div 
                          key={emp.id} 
                          className="flex items-center justify-between bg-brand-bg/40 border border-brand-border p-2.5 rounded-xl gap-2 transition-all hover:border-brand-primary/20"
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
                              <p className="text-xs font-bold text-white truncate">{emp.artisticName || emp.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{emp.level}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            {dayConfig.isCommon !== false && (
                              <button 
                                onClick={() => assignEmployee(emp, 'common')}
                                className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary hover:text-brand-primary text-gray-400 px-2 py-1 rounded-lg transition-all flex items-center gap-1 uppercase"
                              >
                                <UserPlus size={12} />
                                CCSP
                              </button>
                            )}

                            {normalizedParties.map(party => {
                              const isCoord = (party.name || '').toLowerCase().includes('coordena');
                              const isOffice = (party.name || '').toLowerCase().includes('escritório') || (party.name || '').toLowerCase().includes('escritorio');
                              const isJanitor = (party.name || '').toLowerCase().includes('zelador');
                              
                              return (
                                <button 
                                  key={party.id}
                                  onClick={() => assignEmployee(emp, 'party', party)}
                                  className={cn(
                                    "text-[10px] font-black bg-brand-bg border rounded-lg px-2 py-1 transition-all flex items-center gap-1 uppercase max-w-[130px] truncate",
                                    isOffice
                                      ? "border-blue-500/40 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 hover:text-blue-200"
                                      : isJanitor
                                        ? "border-zinc-500/40 text-zinc-300 hover:bg-zinc-500/20 hover:border-zinc-400 hover:text-zinc-200"
                                        : isCoord
                                          ? "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-cyan-200"
                                          : "border-brand-border text-gray-400 hover:bg-brand-party/10 hover:border-brand-party hover:text-brand-party"
                                  )}
                                  title={`Escalar para ${party.name}`}
                                >
                                  {isOffice ? <Briefcase size={12} className="shrink-0 text-blue-300" /> : isJanitor ? <Wrench size={12} className="shrink-0 text-zinc-300" /> : isCoord ? <ShieldCheck size={12} className="shrink-0 text-cyan-300" /> : <UserPlus size={12} />}
                                  <span className="truncate">{party.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {availableOthers.length === 0 && searchQuery && (
                        <p className="text-xs text-gray-500 italic py-2 col-span-full">Nenhum outro recreador encontrado.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-brand-bg/50 border-t border-brand-border flex justify-end">
              <button 
                onClick={onClose}
                className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-black py-3 px-10 rounded-xl transition-all shadow-lg hover:shadow-brand-primary/20 active:scale-95"
              >
                CONCLUÍDO
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
