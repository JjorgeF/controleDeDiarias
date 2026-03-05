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
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, UserPlus, UserMinus, Search, FileDown, Clock } from 'lucide-react';
import { Employee, WorkDay } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import * as XLSX from 'xlsx';

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
  
  const employeesWorkingOnSelectedDay = employees.filter(emp => 
    emp.workDays.some(d => d.date === selectedDayStr)
  );

  const employeesNotWorkingOnSelectedDay = employees.filter(emp => 
    !emp.workDays.some(d => d.date === selectedDayStr) &&
    (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     emp.artisticName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleEmployeeWorkDay = (employee: Employee) => {
    if (!selectedDay) return;
    
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const isWorking = employee.workDays.some(d => d.date === dateStr);
    
    let newDays: WorkDay[];
    if (isWorking) {
      newDays = employee.workDays.filter(d => d.date !== dateStr);
    } else {
      newDays = [...employee.workDays, { date: dateStr, type: 'common', extraHours: 0 }];
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

  const getDayData = (employee: Employee) => {
    if (!selectedDay) return null;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    return employee.workDays.find(d => d.date === dateStr);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6 h-auto lg:h-[calc(100vh-12rem)]">
      {/* Calendar Grid */}
      <div className={cn(
        "flex-1 bg-brand-card border border-brand-border rounded-xl p-3 md:p-6",
        isReadOnly && "lg:w-full"
      )}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0 md:gap-px bg-brand-border rounded-lg overflow-hidden border border-brand-border w-full">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="bg-brand-bg p-0.5 md:p-2 text-center text-[9px] md:text-xs font-bold text-gray-500 uppercase truncate border-b border-r border-brand-border md:border-none">
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const dayStr = format(day, 'yyyy-MM-dd');
            const workersCount = employees.filter(emp => emp.workDays.some(d => d.date === dayStr)).length;

            return (
              <div
                key={idx}
                className={cn(
                  "bg-brand-card min-h-[40px] md:min-h-[80px] p-0.5 md:p-2 text-left transition-all flex flex-col gap-0 md:gap-1 border-b border-r border-brand-border md:border-none",
                  !isReadOnly && "hover:bg-white/5 cursor-pointer",
                  !isCurrentMonth && "opacity-20",
                  isSelected && !isReadOnly && "ring-1 md:ring-2 ring-brand-primary ring-inset z-10 bg-brand-primary/5"
                )}
                onClick={() => !isReadOnly && setSelectedDay(day)}
              >
                <span className={cn(
                  "text-[10px] md:text-sm font-medium",
                  isSelected && !isReadOnly ? "text-brand-primary" : "text-gray-400"
                )}>
                  {format(day, 'd')}
                </span>
                {workersCount > 0 && (
                  <div className="mt-auto">
                    <span className="text-[9px] md:text-[10px] bg-brand-primary/20 text-brand-primary px-1 md:px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                      {workersCount} <span className="hidden md:inline">{workersCount === 1 ? 'Pessoa' : 'Pessoas'}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side Panel: Manage Day */}
      {!isReadOnly && (
        <div className="w-full lg:w-96 bg-brand-card border border-brand-border rounded-xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="text-lg font-bold text-white mb-1">
            {selectedDay ? format(selectedDay, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
          </h3>
          <p className="text-sm text-gray-400">Gerenciar equipe para este dia</p>
        </div>

        <div className="p-4 border-b border-brand-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Adicionar funcionário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Working List */}
          <div>
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Escalados ({employeesWorkingOnSelectedDay.length})</h4>
            <div className="space-y-2">
              {employeesWorkingOnSelectedDay.map(emp => {
                const dayData = getDayData(emp);
                const isExpanded = expandedEmployeeId === emp.id;
                
                return (
                  <div key={emp.id} className="bg-brand-primary/10 border border-brand-primary/20 p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer flex-1" onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}>
                        <p className="text-sm font-bold text-white">{emp.artisticName || emp.name}</p>
                        <p className="text-[10px] text-brand-primary font-medium">{emp.level}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isExpanded ? "text-brand-primary bg-brand-primary/20" : "text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10"
                          )}
                          title="Editar Horas Extras"
                        >
                          <Clock size={16} />
                        </button>
                        <button 
                          onClick={() => toggleEmployeeWorkDay(emp)}
                          className="p-1.5 text-brand-primary hover:bg-brand-primary/20 rounded-md transition-colors"
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="flex items-center gap-3 pt-2 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Horas Extras:</label>
                        <input 
                          type="number"
                          min="0"
                          step="0.5"
                          autoFocus
                          value={dayData?.extraHours || ''}
                          onChange={(e) => updateExtraHours(emp, Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-brand-bg border border-brand-primary/20 rounded py-1 px-2 text-xs focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {employeesWorkingOnSelectedDay.length === 0 && (
                <p className="text-xs text-gray-500 italic text-center py-4">Ninguém escalado para este dia.</p>
              )}
            </div>
          </div>

          {/* Available List */}
          {searchQuery && (
            <div>
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Disponíveis</h4>
              <div className="space-y-2">
                {employeesNotWorkingOnSelectedDay.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between bg-brand-bg/50 border border-brand-border p-3 rounded-lg hover:border-gray-600 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{emp.artisticName || emp.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{emp.level}</p>
                    </div>
                    <button 
                      onClick={() => toggleEmployeeWorkDay(emp)}
                      className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
