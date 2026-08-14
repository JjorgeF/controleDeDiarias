import React from 'react';
import { X, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, Users, Plus, Trash2, PartyPopper, ChevronDown, ChevronUp, Zap, Lock, ShieldCheck, Target } from 'lucide-react';
import { Employee, WorkDay, DayType, DayConfig, PartyConfig } from '../types';
import { format, isSunday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ShiftSelector from './ShiftSelector';

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
  onUpdateDayConfig
}: DayManagementModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);
  const [isEventsExpanded, setIsEventsExpanded] = React.useState(true);

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

  // Main assignment function ensuring strict 1 assignment per person per day
  const assignEmployee = (employee: Employee, targetType: 'common' | 'party', party?: PartyConfig) => {
    const currentWork = employee.workDays.find(d => d.date === selectedDayStr && !d.isCancelled);

    if (targetType === 'common') {
      if (currentWork && currentWork.type === 'common') {
        const newDays = employee.workDays.filter(d => d.date !== selectedDayStr);
        onUpdateDays(employee.id, newDays);
        return;
      }
      const filtered = employee.workDays.filter(d => d.date !== selectedDayStr);
      const defaultShift = 'Definir Horário';
      const newDays: WorkDay[] = [...filtered, {
        date: selectedDayStr,
        type: 'common',
        shift: defaultShift,
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }];
      onUpdateDays(employee.id, newDays);
    } else if (targetType === 'party' && party) {
      const isThisParty = currentWork && currentWork.type === 'party' && 
        (currentWork.partyId === party.id || (!currentWork.partyId && party.id === 'default_party') || currentWork.partyName === party.name);

      if (isThisParty) {
        const newDays = employee.workDays.filter(d => d.date !== selectedDayStr);
        onUpdateDays(employee.id, newDays);
        return;
      }

      const filtered = employee.workDays.filter(d => d.date !== selectedDayStr);
      const newDays: WorkDay[] = [...filtered, {
        date: selectedDayStr,
        type: 'party',
        partyId: party.id,
        partyName: party.name,
        shift: party.time || dayConfig?.partyTime || '',
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }];
      onUpdateDays(employee.id, newDays);
    }
  };

  const removeAllWork = (employee: Employee) => {
    const newDays = employee.workDays.filter(d => d.date !== selectedDayStr);
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
    const newDays = employee.workDays.map(d => 
      d.date === selectedDayStr && !d.isCancelled ? { ...d, extraHours: hours } : d
    );
    onUpdateDays(employee.id, newDays);
  };

  const updateReducedHoursConfig = (employee: Employee, isReduced: boolean, customHours?: string, customPay?: number) => {
    const newDays = employee.workDays.map(d => {
      if (d.date === selectedDayStr && !d.isCancelled) {
        return {
          ...d,
          isReducedHours: isReduced,
          customHoursText: isReduced ? (customHours !== undefined ? customHours : (d.customHoursText || '01h30m')) : undefined,
          customTotalPay: isReduced ? (customPay !== undefined ? customPay : (d.customTotalPay !== undefined ? d.customTotalPay : 45.0)) : undefined
        };
      }
      return d;
    });
    onUpdateDays(employee.id, newDays);
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
                  {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena')).length > 0 && (
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>🎉</span>
                      <span>
                        {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena')).length}{' '}
                        {normalizedParties.filter(p => !(p.name || '').toLowerCase().includes('coordena')).length === 1 ? 'Festa' : 'Festas'}
                      </span>
                    </span>
                  )}
                  {normalizedParties.some(p => (p.name || '').toLowerCase().includes('coordena')) && (
                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck size={11} className="text-cyan-300" />
                      <span>Coordenação</span>
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
                    className="space-y-3 pt-3 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1.5 custom-scrollbar"
                  >
                    {/* Toggles & Add Party Button */}
                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white select-none bg-brand-bg px-3 py-1.5 rounded-xl border border-brand-border hover:border-brand-primary transition-all">
                        <input 
                          type="checkbox"
                          checked={!!dayConfig.isCommon}
                          onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, isCommon: e.target.checked })}
                          className="rounded border-brand-border text-brand-primary bg-brand-bg focus:ring-brand-primary w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-bold">CCSP</span>
                      </label>

                      {(() => {
                        const hasRegularParties = normalizedParties.some(p => !(p.name || '').toLowerCase().includes('coordena'));
                        const hasCoordination = normalizedParties.some(p => (p.name || '').toLowerCase().includes('coordena'));

                        return (
                          <>
                            <button
                              onClick={handleAddParty}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 border",
                                hasRegularParties
                                  ? "bg-purple-600/30 text-purple-200 border-purple-500/80 ring-1 ring-purple-500/30 shadow-sm shadow-purple-500/20"
                                  : "bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40"
                              )}
                            >
                              <Plus size={14} />
                              <span>Festa</span>
                            </button>

                            <button
                              onClick={handleAddCoordination}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 border",
                                hasCoordination
                                  ? "bg-cyan-600/30 text-cyan-200 border-cyan-500/80 ring-1 ring-cyan-500/30 shadow-sm shadow-cyan-500/20"
                                  : "bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/40"
                              )}
                            >
                              <Plus size={14} />
                              <span>Coordenação</span>
                            </button>
                          </>
                        );
                      })()}

                      <label 
                        className={cn(
                          "flex items-center gap-1.5 cursor-pointer text-xs select-none px-3 py-1.5 rounded-xl border transition-all",
                          dayConfig.isExtraordinaryOpen
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold shadow-sm shadow-amber-500/10"
                            : "bg-brand-bg text-gray-400 border-brand-border hover:border-amber-500/40 hover:text-amber-200"
                        )}
                        title="Abre este dia para novos envios de disponibilidade, porém trava remoções de quem já enviou."
                      >
                        <input 
                          type="checkbox"
                          checked={!!dayConfig.isExtraordinaryOpen}
                          onChange={(e) => {
                            const isOpening = e.target.checked;
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
                          className="rounded border-brand-border text-amber-500 bg-brand-bg focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <Zap size={13} className={dayConfig.isExtraordinaryOpen ? "text-amber-400 fill-amber-400" : "text-gray-400"} />
                        <span>Abertura Extra</span>
                      </label>
                    </div>

                    {/* Integrated Abertura Extra Details & Deadline */}
                    {dayConfig.isExtraordinaryOpen && (
                      <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-amber-400 shrink-0 fill-amber-400" />
                          <span className="font-bold text-amber-300">Abertura Extra Ativa</span>
                        </div>
                        <p className="text-[11px] text-amber-100/90 leading-relaxed">
                          Funcionários podem cadastrar ou alterar disponibilidades até o horário limite. Remoções anteriores foram travadas.
                        </p>
                        
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

                              {/* Lista de Festas */}
                              {normalizedParties.map(p => {
                                const allPartyIds = normalizedParties.map(item => item.id);
                                const isPartyActive = (
                                  !dayConfig.extraordinaryScope || 
                                  dayConfig.extraordinaryScope === 'all' ||
                                  (dayConfig.extraordinaryScope === 'parties' && (!dayConfig.extraordinaryPartyIds || dayConfig.extraordinaryPartyIds.length === 0)) ||
                                  (dayConfig.extraordinaryPartyIds && dayConfig.extraordinaryPartyIds.includes(p.id))
                                );

                                return (
                                  <label key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-purple-950/30 border border-purple-500/30 cursor-pointer hover:bg-purple-950/50 transition-all">
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
                                        className="rounded border-purple-400 text-purple-500 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-purple-200">
                                        🎉 {p.name || 'Festa'}
                                      </span>
                                    </div>
                                    {p.time && (
                                      <span className="text-[10px] text-purple-300/80 font-mono bg-purple-500/20 px-2 py-0.5 rounded-full">
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
                                  : "bg-purple-950/25 border-purple-500/30"
                              )}
                            >
                              <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
                                {isCoord ? (
                                  <ShieldCheck size={18} className="text-cyan-300 shrink-0" />
                                ) : (
                                  <span className="text-sm select-none">🎉</span>
                                )}
                                <input 
                                  type="text"
                                  placeholder={isCoord ? "Coordenação" : "Nome da Festa"}
                                  value={party.name}
                                  onChange={(e) => handleUpdateParty(party.id, 'name', e.target.value)}
                                  className={cn(
                                    "w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-white font-bold placeholder-gray-500 focus:outline-none",
                                    isCoord ? "focus:border-cyan-400 text-cyan-100" : "focus:border-purple-500 text-white"
                                  )}
                                />
                              </div>

                              <div className="flex items-center justify-between sm:justify-start gap-2">
                                <div className={cn(
                                  "flex items-center gap-1 bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-xs text-white font-semibold",
                                  isCoord ? "focus-within:border-cyan-400" : "focus-within:border-purple-500"
                                )}>
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase shrink-0 mr-0.5",
                                    isCoord ? "text-cyan-300" : "text-purple-400"
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
                    const workDay = emp.workDays.find(d => d.date === selectedDayStr && !d.isCancelled);
                    const isCommon = workDay?.type === 'common';
                    const isParty = workDay?.type === 'party';
                    const currentPartyId = workDay?.partyId;
                    const currentPartyName = workDay?.partyName;
                    const isCoordination = isParty && (currentPartyName || '').toLowerCase().includes('coordena');
                    const isExpanded = expandedEmployeeId === emp.id;
                    
                    return (
                      <div 
                        key={emp.id} 
                        className={cn(
                          "px-3 py-2.5 rounded-xl transition-all border group",
                          isCoordination
                            ? "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50"
                            : isParty
                              ? "bg-purple-950/20 border-purple-500/30 hover:border-purple-500/50"
                              : "bg-brand-primary/5 border-brand-primary/20 hover:border-brand-primary/40"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="cursor-pointer min-w-0 flex-1 flex items-center gap-2.5" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                            <div className={cn(
                              "w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold border shadow-sm",
                              isCoordination
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                : isParty
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                  : "bg-brand-primary/20 text-brand-primary border-brand-primary/30"
                            )}>
                              {emp.photoUrl ? (
                                <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(emp.artisticName || emp.name).substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-white truncate group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                                <span className="text-[10px] text-brand-primary font-black uppercase shrink-0">{emp.level}</span>
                              </div>
                              
                              {/* Switcher Pills: Clicking another event moves the employee to that event (1 event per day limit) */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {dayConfig.isCommon !== false && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignEmployee(emp, 'common');
                                    }}
                                    className={cn(
                                      "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex items-center gap-1",
                                      isCommon 
                                        ? "bg-brand-primary text-brand-bg shadow-md" 
                                        : "bg-brand-bg border border-brand-border text-gray-400 hover:border-brand-primary/50 hover:text-brand-primary"
                                    )}
                                  >
                                    CCSP
                                  </button>
                                )}

                                {normalizedParties.map((party) => {
                                  const isAssignedToThisParty = isParty && 
                                    (currentPartyId === party.id || (!currentPartyId && party.id === 'default_party') || currentPartyName === party.name);
                                  const isCoord = (party.name || '').toLowerCase().includes('coordena');

                                  return (
                                    <button
                                      key={party.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignEmployee(emp, 'party', party);
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 max-w-[200px] truncate border",
                                        isAssignedToThisParty 
                                          ? isCoord
                                            ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md ring-1 ring-cyan-300"
                                            : "bg-purple-600 text-white border-purple-500 shadow-md ring-1 ring-purple-400" 
                                          : isCoord
                                            ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60"
                                            : "bg-brand-bg border-brand-border text-gray-400 hover:border-purple-500/50 hover:text-purple-300"
                                      )}
                                      title={`Escalar para ${party.name}${party.time ? ` (${party.time})` : ''}`}
                                    >
                                      {isCoord ? <ShieldCheck size={11} className={cn("shrink-0", isAssignedToThisParty ? "text-slate-950" : "text-cyan-300")} /> : <span>🎉</span>}
                                      <span className="truncate">{party.name}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Shift Selector for CCSP */}
                              {isCommon && (
                                <div className="mt-2 pt-2 border-t border-brand-primary/10" onClick={(e) => e.stopPropagation()}>
                                  <ShiftSelector
                                    currentShift={workDay?.shift || 'Definir Horário'}
                                    dateStr={selectedDayStr}
                                    onChange={(newShift) => updateShift(emp, newShift)}
                                  />
                                </div>
                              )}
                              {!!workDay?.extraHours && (
                                <div className="mt-1.5">
                                  <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    +{workDay.extraHours}h extra ({formatCurrency(workDay.extraHours * (workDay.extraHourRateAtTime !== undefined ? workDay.extraHourRateAtTime : emp.extraHourRate))})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {(isCommon || isParty) && (
                              <button 
                                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10"
                                )}
                                title="Horas Extras"
                              >
                                <Clock size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => removeAllWork(emp)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remover escala"
                            >
                              <UserMinus size={18} />
                            </button>
                          </div>
                        </div>
                        
                        {isExpanded && (isCommon || isParty) && (
                          <div className="pt-2.5 mt-2 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2 space-y-3">
                            {/* Toggle Horário Reduzido (Acordo com a Administração) */}
                            {(() => {
                              const dayData = emp.workDays.find(d => d.date === selectedDayStr && !d.isCancelled);
                              return (
                                <>
                                  <div className="flex items-center justify-between bg-amber-500/10 p-2 rounded-lg border border-amber-500/30">
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-400 cursor-pointer">
                                      <Clock size={13} className="text-amber-400" />
                                      Horário Reduzido (Acordo de Horas e Valor)
                                    </label>
                                    <input 
                                      type="checkbox"
                                      checked={!!dayData?.isReducedHours}
                                      onChange={(e) => updateReducedHoursConfig(emp, e.target.checked)}
                                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                                    />
                                  </div>

                                  {dayData?.isReducedHours ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-brand-bg/60 p-3 rounded-lg border border-amber-500/20">
                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                                          Quantas Horas (Ex: 01h30m)
                                        </label>
                                        <input 
                                          type="text"
                                          value={dayData?.customHoursText || ''}
                                          onChange={(e) => updateReducedHoursConfig(emp, true, e.target.value, dayData?.customTotalPay)}
                                          placeholder="01h30m"
                                          className="w-full bg-brand-card border border-amber-500/40 rounded-md py-1 px-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-400"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                                          Valor Total de Horas (R$)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1 text-xs text-gray-400 font-bold">R$</span>
                                          <input 
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={dayData?.customTotalPay !== undefined ? dayData.customTotalPay : ''}
                                            onChange={(e) => updateReducedHoursConfig(emp, true, dayData?.customHoursText, Number(e.target.value))}
                                            placeholder="45.00"
                                            className="w-full bg-brand-card border border-amber-500/40 rounded-md py-1 pl-8 pr-2.5 text-xs font-bold text-emerald-400 focus:outline-none focus:border-amber-400"
                                          />
                                        </div>
                                      </div>

                                      <div className="col-span-full text-[10px] text-amber-300 font-medium bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                                        Valor total acordado para este dia: <strong>{formatCurrency(dayData?.customTotalPay || 0)}</strong> ({dayData?.customHoursText || 'Horário Reduzido'}).
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-3">
                                      <label className="text-[10px] font-black text-gray-500 uppercase">Horas Extras:</label>
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        autoFocus
                                        value={dayData?.extraHours || ''}
                                        onChange={(e) => updateExtraHours(emp, Number(e.target.value))}
                                        placeholder="0"
                                        className="w-20 bg-brand-bg border border-brand-primary/20 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-brand-primary"
                                      />
                                      {(() => {
                                        const extraH = dayData?.extraHours || 0;
                                        const rate = dayData?.extraHourRateAtTime !== undefined ? dayData.extraHourRateAtTime : emp.extraHourRate;
                                        if (extraH > 0) {
                                          return (
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                              = {formatCurrency(extraH * rate)} ({formatCurrency(rate)}/h)
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="text-[10px] text-gray-500 italic">
                                            (Taxa: {formatCurrency(rate)}/h)
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
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
                                          : "bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white border-purple-500/30"
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
                                    className="text-[10px] font-black bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white px-2 py-1 rounded-lg border border-purple-500/30 transition-all flex items-center gap-1 uppercase"
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
                              return (
                                <button 
                                  key={party.id}
                                  onClick={() => assignEmployee(emp, 'party', party)}
                                  className={cn(
                                    "text-[10px] font-black bg-brand-bg border rounded-lg px-2 py-1 transition-all flex items-center gap-1 uppercase max-w-[130px] truncate",
                                    isCoord
                                      ? "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-cyan-200"
                                      : "border-brand-border text-gray-400 hover:bg-purple-500/10 hover:border-purple-500 hover:text-purple-400"
                                  )}
                                  title={`Escalar para ${party.name}`}
                                >
                                  {isCoord ? <ShieldCheck size={12} className="shrink-0 text-cyan-300" /> : <UserPlus size={12} />}
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
