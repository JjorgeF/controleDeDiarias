import React from 'react';
import { X, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, Users, Plus, Trash2, PartyPopper, ChevronDown, ChevronUp } from 'lucide-react';
import { Employee, WorkDay, DayType, DayConfig, PartyConfig } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
      const newDays: WorkDay[] = [...filtered, {
        date: selectedDayStr,
        type: 'common',
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

  const updateExtraHours = (employee: Employee, hours: number) => {
    const newDays = employee.workDays.map(d => 
      d.date === selectedDayStr && d.type === 'common' && !d.isCancelled ? { ...d, extraHours: hours } : d
    );
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
            className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-brand-border flex items-center justify-between bg-brand-bg/30">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
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

            {/* Day Configuration Section */}
            <div className="bg-brand-bg/40 border-b border-brand-border p-3 md:px-6 space-y-3 transition-all">
              <div className="flex items-center justify-between gap-2">
                <div 
                  onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                  className="flex items-center gap-2 cursor-pointer group flex-1 select-none"
                >
                  <div className="p-1.5 rounded-lg bg-brand-bg border border-brand-border text-gray-400 group-hover:text-white group-hover:border-brand-primary transition-all">
                    {isEventsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-200 uppercase tracking-wider group-hover:text-brand-primary transition-colors">
                      Eventos do Dia
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
                      {isEventsExpanded ? "Clique para recolher e focar nos recreadores" : "Clique para expandir e editar os eventos do dia"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white select-none group bg-brand-bg px-2.5 py-1.5 rounded-xl border border-brand-border hover:border-brand-primary transition-all">
                    <input 
                      type="checkbox"
                      checked={!!dayConfig.isCommon}
                      onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, isCommon: e.target.checked })}
                      className="rounded border-brand-border text-brand-primary bg-brand-bg focus:ring-brand-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-bold group-hover:text-brand-primary transition-colors">CCSP</span>
                  </label>

                  <button
                    onClick={handleAddParty}
                    className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Nova Festa</span>
                    <span className="sm:hidden">Festa</span>
                  </button>
                </div>
              </div>

              {/* Collapsed View Summary Chips */}
              {!isEventsExpanded && normalizedParties.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {normalizedParties.map((p) => (
                    <span key={p.id} className="text-[10px] font-bold text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                      <span>🎉</span>
                      <span>{p.name}</span>
                      {p.time && <span className="text-purple-400/80">({p.time})</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* List of Custom Parties / Events */}
              <AnimatePresence>
                {isEventsExpanded && normalizedParties.length > 0 && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 pt-1 overflow-hidden"
                  >
                    {normalizedParties.map((party, idx) => {
                      const { start, end } = parsePartyTime(party.time);

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
                        <div key={party.id || idx} className="flex flex-wrap items-center gap-2 bg-purple-950/25 border border-purple-500/30 rounded-xl p-2.5 animate-in fade-in">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                            <span className="text-sm select-none">🎉</span>
                            <input 
                              type="text"
                              placeholder="Nome do Evento (ex: Festa do Antonio)"
                              value={party.name}
                              onChange={(e) => handleUpdateParty(party.id, 'name', e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-white font-bold placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          {/* Fixed structured time format: | xx:xxh até xx:xxh | */}
                          <div className="flex items-center gap-1 bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus-within:border-purple-500">
                            <span className="text-[10px] text-purple-400 font-bold uppercase shrink-0 mr-1">Horário:</span>
                            <input 
                              type="text"
                              placeholder="12:00"
                              value={start}
                              onChange={(e) => handleTimeUpdate(e.target.value, end)}
                              className="w-14 bg-transparent text-center font-bold text-white focus:outline-none placeholder-gray-600 text-xs"
                            />
                            <span className="text-gray-400 font-bold text-[11px] select-none">h até</span>
                            <input 
                              type="text"
                              placeholder="17:00"
                              value={end}
                              onChange={(e) => handleTimeUpdate(start, e.target.value)}
                              className="w-14 bg-transparent text-center font-bold text-white focus:outline-none placeholder-gray-600 text-xs"
                            />
                            <span className="text-gray-400 font-bold text-[11px] select-none">h</span>
                          </div>

                          <button 
                            onClick={() => handleRemoveParty(party.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                            title="Excluir este evento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search Bar */}
            <div className="p-3 md:p-4 border-b border-brand-border bg-brand-bg/10">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar recreador por nome ou nome artístico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 md:py-3 pl-10 md:pl-12 pr-4 text-sm md:text-base focus:outline-none focus:border-brand-primary transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 md:space-y-8">
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
                    const isExpanded = expandedEmployeeId === emp.id;
                    
                    return (
                      <div key={emp.id} className="bg-brand-primary/5 border border-brand-primary/20 px-3 py-2.5 rounded-xl transition-all hover:border-brand-primary/40 group">
                        <div className="flex flex-wrap items-center justify-between gap-2">
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

                                  return (
                                    <button
                                      key={party.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignEmployee(emp, 'party', party);
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex items-center gap-1 max-w-[200px] truncate",
                                        isAssignedToThisParty 
                                          ? "bg-purple-600 text-white shadow-md ring-1 ring-purple-400" 
                                          : "bg-brand-bg border border-brand-border text-gray-400 hover:border-purple-500/50 hover:text-purple-300"
                                      )}
                                      title={`Escalar para ${party.name}${party.time ? ` (${party.time})` : ''}`}
                                    >
                                      <span>🎉</span>
                                      <span className="truncate">{party.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isCommon && (
                              <button 
                                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10"
                                )}
                                title="Horas Extras (CCSP)"
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
                        
                        {isExpanded && isCommon && (
                          <div className="flex items-center gap-3 pt-2.5 mt-2 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase">Horas Extras (CCSP):</label>
                            <input 
                              type="number"
                              min="0"
                              step="0.5"
                              autoFocus
                              value={emp.workDays.find(d => d.date === selectedDayStr && d.type === 'common')?.extraHours || ''}
                              onChange={(e) => updateExtraHours(emp, Number(e.target.value))}
                              placeholder="0"
                              className="w-20 bg-brand-bg border border-brand-primary/20 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-brand-primary"
                            />
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
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      Disponíveis para este dia ({availableMarked.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableMarked.map(emp => (
                        <div 
                          key={emp.id} 
                          className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/30 p-2.5 rounded-xl gap-2 transition-all hover:border-emerald-500/50"
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
                              <p className="text-xs font-bold text-white truncate">{emp.artisticName || emp.name}</p>
                              <p className="text-[10px] text-emerald-400 font-bold uppercase truncate">{emp.level}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            {dayConfig.isCommon !== false && (
                              <button 
                                onClick={() => assignEmployee(emp, 'common')}
                                className="text-[10px] font-black bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg px-2 py-1 rounded-lg border border-brand-primary/30 transition-all flex items-center gap-1 uppercase"
                              >
                                <UserPlus size={12} />
                                CCSP
                              </button>
                            )}

                            {normalizedParties.map(party => (
                              <button 
                                key={party.id}
                                onClick={() => assignEmployee(emp, 'party', party)}
                                className="text-[10px] font-black bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white px-2 py-1 rounded-lg border border-purple-500/30 transition-all flex items-center gap-1 uppercase max-w-[130px] truncate"
                                title={`Escalar para ${party.name}`}
                              >
                                <UserPlus size={12} />
                                <span className="truncate">{party.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

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

                            {normalizedParties.map(party => (
                              <button 
                                key={party.id}
                                onClick={() => assignEmployee(emp, 'party', party)}
                                className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-purple-500/10 hover:border-purple-500 hover:text-purple-400 text-gray-400 px-2 py-1 rounded-lg transition-all flex items-center gap-1 uppercase max-w-[130px] truncate"
                                title={`Escalar para ${party.name}`}
                              >
                                <UserPlus size={12} />
                                <span className="truncate">{party.name}</span>
                              </button>
                            ))}
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
