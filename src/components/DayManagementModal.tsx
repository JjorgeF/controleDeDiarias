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
}

export default function DayManagementModal({
  isOpen,
  onClose,
  selectedDay,
  employees,
  onUpdateDays,
  copiedTeam,
  onCopyTeam,
  onPasteTeam
}: DayManagementModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);

  if (!isOpen || !selectedDay) return null;

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  
  const employeesWorking = employees.filter(emp => 
    emp.workDays.some(d => d.date === selectedDayStr)
  );

  const employeesAvailable = employees.filter(emp => 
    !emp.workDays.some(d => d.date === selectedDayStr) &&
    (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleWorkDay = (employee: Employee) => {
    const isWorking = employee.workDays.some(d => d.date === selectedDayStr);
    let newDays: WorkDay[];
    
    if (isWorking) {
      newDays = employee.workDays.filter(d => d.date !== selectedDayStr);
    } else {
      newDays = [...employee.workDays, { date: selectedDayStr, type: 'common' as DayType, extraHours: 0 }];
    }
    
    onUpdateDays(employee.id, newDays);
  };

  const updateExtraHours = (employee: Employee, hours: number) => {
    const newDays = employee.workDays.map(d => 
      d.date === selectedDayStr ? { ...d, extraHours: hours } : d
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
                const dayData = emp.workDays.find(d => d.date === selectedDayStr);
                const isExpanded = expandedEmployeeId === emp.id;
                
                return (
                  <div key={emp.id} className="bg-brand-primary/5 border border-brand-primary/20 p-4 rounded-xl space-y-4 transition-all hover:border-brand-primary/40 group">
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer flex-1" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                        <p className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                        <p className="text-[10px] text-brand-primary font-black uppercase">{emp.level}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10"
                          )}
                        >
                          <Clock size={18} />
                        </button>
                        <button 
                          onClick={() => toggleWorkDay(emp)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <UserMinus size={20} />
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="flex items-center gap-4 pt-4 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">Horas Extras:</label>
                        <input 
                          type="number"
                          min="0"
                          step="0.5"
                          autoFocus
                          value={dayData?.extraHours || ''}
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
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Disponíveis</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {employeesAvailable.map(emp => (
                  <div 
                    key={emp.id} 
                    onClick={() => toggleWorkDay(emp)}
                    className="flex items-center justify-between bg-brand-bg/40 border border-brand-border p-3 rounded-xl hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">{emp.level}</p>
                    </div>
                    <div className="p-2 text-gray-600 group-hover:text-brand-primary transition-colors">
                      <UserPlus size={20} />
                    </div>
                  </div>
                ))}
                {employeesAvailable.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4 col-span-full">Nenhum recreador encontrado.</p>
                )}
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