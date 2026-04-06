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
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Users, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, AlertTriangle, Maximize2 } from 'lucide-react';
import { Employee, WorkDay, DayType } from '../types';
import { cn } from '../lib/utils';
import DayManagementModal from './DayManagementModal';

interface CalendarViewProps {
  employees: Employee[];
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void;
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  isReadOnly?: boolean;
}

export default function CalendarView({ 
  employees, 
  onUpdateDays, 
  currentMonth, 
  setCurrentMonth,
  isReadOnly = false
}: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);
  const [copiedTeam, setCopiedTeam] = React.useState<string[] | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = React.useState(false);
  
  // Drag and Drop State
  const [draggedDay, setDraggedDay] = React.useState<Date | null>(null);
  const [replicationTarget, setReplicationTarget] = React.useState<Date | null>(null);
  const [isReplicationModalOpen, setIsReplicationModalOpen] = React.useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
  
  const employeesWorking = employees.filter(emp => 
    emp.workDays.some(d => d.date === selectedDayStr)
  );

  const employeesAvailable = employees.filter(emp => 
    !emp.workDays.some(d => d.date === selectedDayStr) &&
    (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleWorkDay = (employee: Employee, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isWorking = employee.workDays.some(d => d.date === dateStr);
    let newDays: WorkDay[];
    
    if (isWorking) {
      newDays = employee.workDays.filter(d => d.date !== dateStr);
    } else {
      newDays = [...employee.workDays, { date: dateStr, type: 'common' as DayType, extraHours: 0 }];
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
        const newDays = [...employee.workDays, { date: selectedDayStr, type: 'common' as DayType, extraHours: 0 }];
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

  const handleDayClick = (day: Date) => {
    if (isReadOnly) return;
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar Grid */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-2xl">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-3 md:p-6 border-b border-brand-border bg-brand-bg/30">
          <div className="flex items-center gap-3 md:gap-4">
            <h2 className="text-base md:text-xl font-black text-white capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center bg-brand-bg border border-brand-border rounded-lg p-0.5 md:p-1">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 md:p-1.5 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white"
              >
                <ChevronLeft size={18} className="md:w-5 md:h-5" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 md:p-1.5 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white"
              >
                <ChevronRight size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-brand-primary rounded-full"></span>
              <span>Escalado</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto sm:overflow-x-visible">
          <div className="grid grid-cols-7 border-b border-brand-border bg-brand-bg/50 min-w-[320px] md:min-w-[700px]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="p-1 md:p-3 text-center text-[8px] md:text-xs font-black text-gray-500 uppercase tracking-tighter md:tracking-widest">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 auto-rows-fr min-w-[320px] md:min-w-[700px]">
            {calendarDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const workersCount = employees.filter(emp => 
                emp.workDays.some(d => d.date === dayStr)
              ).length;
              
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toString()}
                  draggable={!isReadOnly && isCurrentMonth}
                  onDragStart={(e) => handleDragStart(e, day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  onClick={() => handleDayClick(day)}
                    className={cn(
                      "min-h-[50px] md:min-h-[100px] p-1 md:p-4 border-b border-r border-brand-border transition-all relative group",
                      !isReadOnly && isCurrentMonth && "hover:bg-brand-primary/5 cursor-pointer",
                      !isCurrentMonth && "bg-brand-bg/20 opacity-30",
                      isSelected && !isReadOnly && "bg-brand-primary/10 ring-1 ring-brand-primary ring-inset z-10",
                      idx % 7 === 6 && "border-r-0"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center h-full gap-1 md:gap-2">
                      <span className={cn(
                        "text-xs md:text-base font-black w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors",
                        isTodayDate ? "bg-brand-primary text-brand-bg" : "text-gray-400 group-hover:text-white",
                        isSelected && !isTodayDate && !isReadOnly && "text-brand-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {workersCount > 0 && (
                        <div className="bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full text-[8px] md:text-xs font-black">
                          {workersCount}
                        </div>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Management Panel (Below Calendar) */}
      {!isReadOnly && selectedDay && (
        <div className="bg-brand-card border border-brand-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
          <div className="p-4 md:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-bg/30">
            <div>
              <h3 className="text-base md:text-xl font-bold text-white capitalize">
                {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-xs md:text-sm text-gray-400">Gerenciar equipe para este dia</p>
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-[10px] md:text-xs font-bold py-2 px-2 md:px-3 rounded-lg transition-colors"
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
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar recreador para adicionar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Working List */}
            <div>
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                Escalados ({employeesWorking.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employeesWorking.map(emp => {
                  const dayData = emp.workDays.find(d => d.date === selectedDayStr);
                  const isExpanded = expandedEmployeeId === emp.id;
                  
                  return (
                    <div key={emp.id} className="bg-brand-primary/5 border border-brand-primary/20 p-4 rounded-xl space-y-4 transition-all hover:border-brand-primary/40">
                      <div className="flex items-center justify-between">
                        <div className="cursor-pointer flex-1" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                          <p className="text-sm font-bold text-white">{emp.artisticName || emp.name}</p>
                          <p className="text-[10px] text-brand-primary font-bold uppercase">{emp.level}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10"
                            )}
                          >
                            <Clock size={18} />
                          </button>
                          <button 
                            onClick={() => toggleWorkDay(emp, selectedDay)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <UserMinus size={20} />
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="flex items-center gap-4 pt-4 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                          <label className="text-xs font-bold text-gray-400 uppercase">Horas Extras:</label>
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
                  <div className="col-span-full text-center py-8 border-2 border-dashed border-brand-border rounded-xl">
                    <p className="text-sm text-gray-500 italic">Ninguém escalado para este dia.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Available List */}
            {searchQuery && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Disponíveis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {employeesAvailable.map(emp => (
                    <div 
                      key={emp.id} 
                      onClick={() => toggleWorkDay(emp, selectedDay)}
                      className="flex items-center justify-between bg-brand-bg/40 border border-brand-border p-3 rounded-xl hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all cursor-pointer group"
                    >
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{emp.artisticName || emp.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{emp.level}</p>
                      </div>
                      <div className="p-2 text-brand-primary group-hover:scale-110 transition-transform">
                        <UserPlus size={20} />
                      </div>
                    </div>
                  ))}
                  {employeesAvailable.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2 col-span-full">Nenhum recreador encontrado.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Replication Confirmation Modal */}
      {isReplicationModalOpen && draggedDay && replicationTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-brand-primary/20 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">Replicar Escala?</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Tem certeza que deseja replicar a escala do dia <span className="text-brand-primary font-bold">{format(draggedDay, "dd/MM")}</span> para o dia <span className="text-brand-primary font-bold">{format(replicationTarget, "dd/MM")}</span>?
                <br />
                <span className="text-xs text-red-400 mt-2 block">Isso substituirá qualquer escala existente no dia de destino.</span>
              </p>
            </div>
            <div className="p-4 bg-brand-bg/50 border-t border-brand-border flex gap-3">
              <button 
                onClick={() => {
                  setIsReplicationModalOpen(false);
                  setDraggedDay(null);
                  setReplicationTarget(null);
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmReplication}
                className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold py-3 rounded-xl transition-colors"
              >
                Sim, Replicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Management Modal (Focus View) */}
      {!isReadOnly && (
        <DayManagementModal 
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          selectedDay={selectedDay}
          employees={employees}
          onUpdateDays={onUpdateDays}
          copiedTeam={copiedTeam}
          onCopyTeam={handleCopyTeam}
          onPasteTeam={handlePasteTeam}
        />
      )}
    </div>
  );
}