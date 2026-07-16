import React from 'react';
import { X, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, Users } from 'lucide-react';
import { Employee, WorkDay, DayType } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface DayManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: Date | null;
  employees: Employee[];
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void;
  copiedTeam: string[] | null;
  onCopyTeam: () => void;
  onPasteTeam: () => void;
  dayConfig: { isCommon: boolean; isParty: boolean };
  onUpdateDayConfig: (dateStr: string, config: { isCommon: boolean; isParty: boolean }) => void;
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

  if (!isOpen || !selectedDay) return null;

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  
  const employeesWorking = employees.filter(emp => 
    emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled)
  );

  const filteredAvailable = employees.filter(emp => 
    !emp.workDays.some(d => d.date === selectedDayStr && !d.isCancelled) &&
    (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const availableMarked = filteredAvailable.filter(emp => {
    const commonAvailable = !!dayConfig.isCommon && 
      (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`));
    const partyAvailable = !!dayConfig.isParty && 
      emp.availabilities?.includes(`${selectedDayStr}_party`);
    return commonAvailable || partyAvailable;
  });

  const availableOthers = filteredAvailable.filter(emp => {
    const isMarked = (!!dayConfig.isCommon && (emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`))) ||
      (!!dayConfig.isParty && emp.availabilities?.includes(`${selectedDayStr}_party`));
    return !isMarked;
  });

  const toggleSchedule = (employee: Employee, type: 'common' | 'party') => {
    const hasThisWork = employee.workDays.some(d => d.date === selectedDayStr && d.type === type && !d.isCancelled);
    let newDays: WorkDay[];
    
    if (hasThisWork) {
      // Remove it
      newDays = employee.workDays.filter(d => !(d.date === selectedDayStr && d.type === type));
    } else {
      // Filter out any existing day for this date (whether cancelled or not) and add fresh
      const filtered = employee.workDays.filter(d => d.date !== selectedDayStr);
      newDays = [...filtered, { date: selectedDayStr, type: type as DayType, extraHours: 0 }];
    }
    
    onUpdateDays(employee.id, newDays);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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
        <div className="bg-brand-bg/40 border-b border-brand-border p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Configuração do Dia</h4>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Ative os ambientes disponíveis para esta data</p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm text-white select-none group">
              <input 
                type="checkbox"
                checked={!!dayConfig.isCommon}
                onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, isCommon: e.target.checked })}
                className="rounded border-brand-border text-brand-primary bg-brand-bg focus:ring-brand-primary w-4 h-4 cursor-pointer"
              />
              <span className="font-bold group-hover:text-brand-primary transition-colors">Dia Comum</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm text-white select-none group">
              <input 
                type="checkbox"
                checked={!!dayConfig.isParty}
                onChange={(e) => onUpdateDayConfig(selectedDayStr, { ...dayConfig, isParty: e.target.checked })}
                className="rounded border-brand-border text-purple-500 bg-brand-bg focus:ring-purple-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-purple-400 font-bold group-hover:text-purple-300 transition-colors">Festa 🥳</span>
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 md:p-4 border-b border-brand-border bg-brand-bg/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar recreador..."
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
                Escalados ({employeesWorking.length})
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {employeesWorking.map(emp => {
                const hasCommon = emp.workDays.some(d => d.date === selectedDayStr && d.type === 'common');
                const hasParty = emp.workDays.some(d => d.date === selectedDayStr && d.type === 'party');
                const isExpanded = expandedEmployeeId === emp.id;
                
                return (
                  <div key={emp.id} className="bg-brand-primary/5 border border-brand-primary/20 p-4 rounded-xl space-y-4 transition-all hover:border-brand-primary/40 group">
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer flex-1" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                        <p className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                        <p className="text-[10px] text-brand-primary font-black uppercase">{emp.level}</p>
                        
                        {/* Interactive Pill Toggles */}
                        <div className="flex items-center gap-1.5 mt-2">
                          {dayConfig.isCommon !== false && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSchedule(emp, 'common');
                              }}
                              className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded transition-all uppercase tracking-wider",
                                hasCommon 
                                  ? "bg-brand-primary text-brand-bg" 
                                  : "bg-transparent border border-brand-border text-gray-500 hover:border-brand-primary/40 hover:text-brand-primary"
                              )}
                            >
                              Comum
                            </button>
                          )}
                          {!!dayConfig.isParty && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSchedule(emp, 'party');
                              }}
                              className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded transition-all uppercase tracking-wider",
                                hasParty 
                                  ? "bg-purple-500 text-white" 
                                  : "bg-transparent border border-brand-border text-gray-500 hover:border-purple-500/40 hover:text-purple-400"
                              )}
                            >
                              Festa 🥳
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasCommon && (
                          <button 
                            onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10"
                            )}
                            title="Horas Extras"
                          >
                            <Clock size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => removeAllWork(emp)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remover escala completa"
                        >
                          <UserMinus size={20} />
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && hasCommon && (
                      <div className="flex items-center gap-4 pt-4 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">Horas Extras (Comum):</label>
                        <input 
                          type="number"
                          min="0"
                          step="0.5"
                          autoFocus
                          value={emp.workDays.find(d => d.date === selectedDayStr && d.type === 'common')?.extraHours || ''}
                          onChange={(e) => updateExtraHours(emp, Number(e.target.value))}
                          placeholder="0"
                          className="w-24 bg-brand-bg border border-brand-primary/20 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {employeesWorking.length === 0 && (
                <div className="col-span-full text-center py-12 border-2 border-dashed border-brand-border rounded-2xl bg-brand-bg/5">
                  <p className="text-sm text-gray-500 font-medium italic">Ninguém escalado para este dia.</p>
                </div>
              )}
            </div>
          </div>

          {/* Available List (Always show if searching or if list is short) */}
          {(searchQuery || employeesWorking.length < 5) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* Group 1: Explicitly Available */}
              <div>
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Disponíveis para este dia ({availableMarked.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableMarked.map(emp => {
                    const isDispCommon = emp.availabilities?.includes(selectedDayStr) || emp.availabilities?.includes(`${selectedDayStr}_common`);
                    const isDispParty = emp.availabilities?.includes(`${selectedDayStr}_party`);

                    return (
                      <div 
                        key={emp.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl gap-2 transition-all hover:border-emerald-500/50"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{emp.artisticName || emp.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-emerald-400 font-bold uppercase">{emp.level}</span>
                            {isDispCommon && (
                              <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1 rounded uppercase tracking-wider">Disp. Comum</span>
                            )}
                            {isDispParty && (
                              <span className="text-[8px] font-black bg-pink-500/20 text-pink-300 px-1 rounded uppercase tracking-wider">Disp. Festa 🎉</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Action Add Buttons */}
                        <div className="flex items-center gap-1.5">
                          {dayConfig.isCommon !== false && (
                            <button 
                              onClick={() => toggleSchedule(emp, 'common')}
                              className="text-[10px] font-black bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg px-2.5 py-1.5 rounded-lg border border-brand-primary/30 hover:border-transparent transition-all flex items-center gap-1 uppercase"
                            >
                              <UserPlus size={12} />
                              Comum
                            </button>
                          )}
                          {!!dayConfig.isParty && (
                            <button 
                              onClick={() => toggleSchedule(emp, 'party')}
                              className="text-[10px] font-black bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-purple-500/30 hover:border-transparent transition-all flex items-center gap-1 uppercase"
                            >
                              <UserPlus size={12} />
                              Festa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {availableMarked.length === 0 && (
                    <p className="text-xs text-gray-500 italic py-2">Ninguém sinalizou disponibilidade para este dia.</p>
                  )}
                </div>
              </div>

              {/* Group 2: Others */}
              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-3">
                  Outros Recreadores ({availableOthers.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableOthers.map(emp => (
                    <div 
                      key={emp.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-brand-bg/40 border border-brand-border p-3 rounded-xl gap-2 transition-all hover:border-brand-primary/20"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{emp.artisticName || emp.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{emp.level}</p>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {dayConfig.isCommon !== false && (
                          <button 
                            onClick={() => toggleSchedule(emp, 'common')}
                            className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary hover:text-brand-primary text-gray-400 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 uppercase"
                          >
                            <UserPlus size={12} />
                            Comum
                          </button>
                        )}
                        {!!dayConfig.isParty && (
                          <button 
                            onClick={() => toggleSchedule(emp, 'party')}
                            className="text-[10px] font-black bg-brand-bg border border-brand-border hover:bg-purple-500/10 hover:border-purple-500 hover:text-purple-400 text-gray-400 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 uppercase"
                          >
                            <UserPlus size={12} />
                            Festa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {availableOthers.length === 0 && searchQuery && (
                    <p className="text-xs text-gray-500 italic py-2">Nenhum outro recreador encontrado.</p>
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
      </div>
    </div>
  );
}
