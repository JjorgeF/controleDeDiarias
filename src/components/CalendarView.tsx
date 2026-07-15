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
import { ChevronLeft, ChevronRight, Users, Search, UserPlus, UserMinus, Clock, Copy, ClipboardPaste, AlertTriangle, Maximize2, Lock, Unlock, Save, Calendar, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Employee, WorkDay, DayType } from '../types';
import { cn } from '../lib/utils';
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
  dayConfigs?: Record<string, { isCommon: boolean; isParty: boolean }>;
  onUpdateDayConfig?: (dateStr: string, config: { isCommon: boolean; isParty: boolean }) => void;
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
  onUpdateDayConfig
}: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = React.useState<string | null>(null);
  const [copiedTeam, setCopiedTeam] = React.useState<string[] | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = React.useState(false);

  // Employee Choice Modal State
  const [employeeChoiceDate, setEmployeeChoiceDate] = React.useState<Date | null>(null);
  const [isEmployeeChoiceModalOpen, setIsEmployeeChoiceModalOpen] = React.useState(false);

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

  const myEmployee = employees[0];

  const getDayConfig = (dateStr: string) => {
    const config = dayConfigs?.[dateStr];
    if (config) {
      return {
        isCommon: config.isCommon !== false,
        isParty: !!config.isParty,
      };
    }
    return { isCommon: true, isParty: false };
  };

  const handleDayClick = (day: Date) => {
    if (isAdmin) {
      if (isReadOnly) return;
      setSelectedDay(day);
      setIsDayModalOpen(true);
    } else {
      // Employee mode: toggle availability
      if (!myEmployee) return;
      
      const monthKey = format(day, 'yyyy-MM');
      const deadlineVal = deadlines?.[monthKey];
      const isExpired = deadlineVal ? new Date() > new Date(deadlineVal) : false;
      
      if (isExpired) {
        return; // Click disabled because deadline expired
      }
      
      const dayStr = format(day, 'yyyy-MM-dd');
      const config = getDayConfig(dayStr);
      
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
      const count = emp.availabilities?.filter(dateStr => dateStr.startsWith(currentMonthKey)).length || 0;
      return { ...emp, availabilitiesCount: count };
    }).sort((a, b) => b.availabilitiesCount - a.availabilitiesCount);
  }, [employees, currentMonthKey]);

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
          ? "bg-red-500/10 border-red-500/25 text-red-200" 
          : deadlineDate 
            ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-200" 
            : "bg-blue-500/10 border-blue-500/25 text-blue-200"
      )}>
        <div className="flex items-center gap-3">
          {isDeadlinePassed ? (
            <Lock className="text-red-400 shrink-0 animate-bounce" size={20} />
          ) : deadlineDate ? (
            <Unlock className="text-yellow-400 shrink-0" size={20} />
          ) : (
            <Calendar className="text-blue-400 shrink-0" size={20} />
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
              <p className="text-[10px] text-yellow-400/80 mt-0.5 font-bold">Toque nos dias do calendário para marcar/desmarcar os dias em que você pode trabalhar.</p>
            )}
            {!isAdmin && isDeadlinePassed && (
              <p className="text-[10px] text-red-400/80 mt-0.5 font-bold">As datas deste mês foram travadas. Caso precise alterar, entre em contato com um administrador.</p>
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
              <h3 className="text-sm font-bold text-white">Prazo de Disponibilidades ({format(currentMonth, 'MMMM', { locale: ptBR })})</h3>
              <p className="text-xs text-gray-400">Defina até quando a equipe pode registrar disponibilidade</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="date"
              value={deadlineInputDate}
              onChange={(e) => setDeadlineInputDate(e.target.value)}
              className="bg-brand-bg border border-brand-border text-xs rounded-lg py-1.5 px-3 focus:outline-none focus:border-brand-primary text-white"
            />
            <input 
              type="time"
              value={deadlineInputTime}
              onChange={(e) => setDeadlineInputTime(e.target.value)}
              className="bg-brand-bg border border-brand-border text-xs rounded-lg py-1.5 px-3 focus:outline-none focus:border-brand-primary text-white"
            />
            <button 
              onClick={handleSaveDeadline}
              className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg text-xs font-bold py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Save size={14} /> Salvar Prazo
            </button>
            {currentDeadline && (
              <button 
                onClick={handleClearDeadline}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors"
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

            <div className="overflow-x-auto lg:overflow-x-visible">
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
                  const config = getDayConfig(dayStr);
                  
                  // Counts for admin view
                  const workersCommonCount = employees.filter(emp => 
                    emp.workDays.some(d => d.date === dayStr && d.type === 'common')
                  ).length;
                  const workersPartyCount = employees.filter(emp => 
                    emp.workDays.some(d => d.date === dayStr && d.type === 'party')
                  ).length;
                  const availablesCommonCount = employees.filter(emp => 
                    emp.availabilities?.includes(dayStr) || emp.availabilities?.includes(`${dayStr}_common`)
                  ).length;
                  const availablesPartyCount = employees.filter(emp => 
                    emp.availabilities?.includes(`${dayStr}_party`)
                  ).length;
                  
                  // Status for employee view
                  const isMyAvailableCommon = myEmployee?.availabilities?.includes(dayStr) || myEmployee?.availabilities?.includes(`${dayStr}_common`);
                  const isMyAvailableParty = myEmployee?.availabilities?.includes(`${dayStr}_party`);
                  const isMyScheduledCommon = myEmployee?.workDays.some(d => d.date === dayStr && d.type === 'common');
                  const isMyScheduledParty = myEmployee?.workDays.some(d => d.date === dayStr && d.type === 'party');

                  const isMyAvailable = isMyAvailableCommon || isMyAvailableParty;
                  const isMyScheduled = isMyScheduledCommon || isMyScheduledParty;

                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={day.toString()}
                      draggable={isAdmin && !isReadOnly && isCurrentMonth}
                      onDragStart={(e) => handleDragStart(e, day)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day)}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "min-h-[60px] md:min-h-[110px] p-1 md:p-3 border-b border-r border-brand-border transition-all relative group",
                        !isCurrentMonth && "bg-brand-bg/20 opacity-30 pointer-events-none",
                        isCurrentMonth && (isAdmin ? "hover:bg-brand-primary/5 cursor-pointer" : isDeadlinePassed ? "cursor-not-allowed opacity-80" : "hover:bg-emerald-500/5 cursor-pointer"),
                        isAdmin && isSelected && !isReadOnly && "bg-brand-primary/10 ring-1 ring-brand-primary ring-inset z-10",
                        !isAdmin && isMyAvailable && "bg-emerald-500/5",
                        !isAdmin && isMyScheduled && "bg-brand-primary/10 ring-1 ring-brand-primary/50 ring-inset z-10",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      {/* Party indicator badge */}
                      {config.isParty && (
                        <span className="absolute top-1 right-1 text-[7px] md:text-[9px] bg-purple-500/25 text-purple-300 px-1 py-0.5 rounded font-black uppercase tracking-wider scale-90 md:scale-100 z-10">
                          🎉 Festa
                        </span>
                      )}

                      <div className="flex flex-col items-center justify-between h-full gap-1">
                        <span className={cn(
                          "text-xs md:text-sm font-black w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors",
                          isTodayDate ? "bg-brand-primary text-brand-bg" : "text-gray-400 group-hover:text-white",
                          isAdmin && isSelected && !isTodayDate && !isReadOnly && "text-brand-primary",
                          !isAdmin && isMyScheduled && "bg-brand-primary text-brand-bg"
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
                                    title={`${workersCommonCount} escalados (Dia Comum)`}
                                    className="bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0"
                                  >
                                    {workersCommonCount} C
                                  </div>
                                )}
                                {availablesCommonCount > 0 && (
                                  <div 
                                    title={`${availablesCommonCount} disponíveis (Dia Comum)`}
                                    className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 flex items-center gap-0.5"
                                  >
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                    {availablesCommonCount}
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
                                    className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0"
                                  >
                                    {workersPartyCount} F 🥳
                                  </div>
                                )}
                                {availablesPartyCount > 0 && (
                                  <div 
                                    title={`${availablesPartyCount} disponíveis (Festa)`}
                                    className="bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 flex items-center gap-0.5"
                                  >
                                    <span className="w-1.5 h-1.5 bg-pink-400 rounded-full"></span>
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
                              <div className="bg-brand-primary/20 text-brand-primary px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 w-full max-w-[54px] lg:max-w-none truncate">
                                <span className="hidden lg:inline">Escalado</span>
                                <span className="lg:hidden">Esc.</span>
                              </div>
                            )}
                            {config.isCommon && isMyAvailableCommon && !isMyScheduledCommon && (
                              <div className="bg-emerald-500/20 text-emerald-400 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 flex items-center justify-center gap-0.5 w-full max-w-[54px] lg:max-w-none truncate">
                                <CheckCircle2 size={8} className="shrink-0" />
                                <span className="hidden lg:inline">Disponível</span>
                                <span className="lg:hidden">Disp.</span>
                              </div>
                            )}
                            
                            {/* Party scheduling */}
                            {config.isParty && isMyScheduledParty && (
                              <div className="bg-purple-500/25 text-purple-300 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 w-full max-w-[54px] lg:max-w-none truncate">
                                <span className="hidden lg:inline">Escalado Festa</span>
                                <span className="lg:hidden">Esc. F.</span>
                              </div>
                            )}
                            {config.isParty && isMyAvailableParty && !isMyScheduledParty && (
                              <div className="bg-pink-500/20 text-pink-300 px-1 md:px-2 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase tracking-wider text-center shrink-0 flex items-center justify-center gap-0.5 w-full max-w-[54px] lg:max-w-none truncate">
                                <CheckCircle2 size={8} className="shrink-0" />
                                <span className="hidden lg:inline">Disp. Festa</span>
                                <span className="lg:hidden">Disp. F.</span>
                              </div>
                            )}
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
          {isAdmin && !isReadOnly && selectedDay && (
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
        </div>

        {/* Sidebar Panel with Availabilities Ranking */}
        {isAdmin && (
          <div className="w-full lg:w-80 bg-brand-card border border-brand-border rounded-xl p-4 md:p-6 shadow-2xl h-fit space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={18} />
                Quadro de Disponibilidades
              </h3>
              <p className="text-xs text-gray-400 mt-1">Ranking de disponibilidades enviadas para este mês ({format(currentMonth, 'MMMM', { locale: ptBR })})</p>
            </div>
            <div className="divide-y divide-brand-border overflow-y-auto max-h-[400px] pr-1 space-y-3 pt-2">
              {employeesWithAvailabilitiesCount.map(emp => (
                <div key={emp.id} className="flex items-center justify-between pt-3 first:pt-0">
                  <div>
                    <p className="text-xs font-bold text-white">{emp.artisticName || emp.name}</p>
                    <p className="text-[10px] text-gray-500 font-medium uppercase">{emp.level}</p>
                  </div>
                  <div className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-black",
                    emp.availabilitiesCount > 0 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : "bg-gray-800 text-gray-500"
                  )}>
                    {emp.availabilitiesCount} {emp.availabilitiesCount === 1 ? 'dia' : 'dias'}
                  </div>
                </div>
              ))}
              {employeesWithAvailabilitiesCount.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4 italic">Nenhum funcionário cadastrado.</p>
              )}
            </div>
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

      {/* Employee Availability Choice Modal (for days with both Common and Party modes) */}
      {isEmployeeChoiceModalOpen && employeeChoiceDate && myEmployee && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-6 animate-in zoom-in-95 duration-200 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black capitalize">
                  {format(employeeChoiceDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs text-gray-400 font-medium">Selecione suas disponibilidades para esta data</p>
              </div>
              <button 
                onClick={() => {
                  setIsEmployeeChoiceModalOpen(false);
                  setEmployeeChoiceDate(null);
                }} 
                className="text-gray-400 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-all"
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
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" 
                      : "bg-brand-bg/40 border-brand-border text-gray-400 hover:border-brand-primary/30"
                  )}>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">Dia Comum</span>
                      <span className="text-xs text-gray-400">Trabalho padrão do dia a dia</span>
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

              {/* Party Option */}
              {(() => {
                const dateStr = format(employeeChoiceDate, 'yyyy-MM-dd');
                const currentAvailabilities = myEmployee.availabilities || [];
                const isPartyChecked = currentAvailabilities.includes(`${dateStr}_party`);
                
                return (
                  <label className={cn(
                    "flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-all",
                    isPartyChecked 
                      ? "bg-purple-500/10 border-purple-500/50 text-purple-400" 
                      : "bg-brand-bg/40 border-brand-border text-gray-400 hover:border-brand-primary/30"
                  )}>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">Dia de Festa 🥳</span>
                      <span className="text-xs text-gray-400">Trabalhar em eventos e festas extras</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={isPartyChecked}
                      onChange={(e) => {
                        let newAvail: string[];
                        if (e.target.checked) {
                          newAvail = [...currentAvailabilities, `${dateStr}_party`];
                        } else {
                          newAvail = currentAvailabilities.filter(d => d !== `${dateStr}_party`);
                        }
                        if (onUpdateAvailabilities) {
                          onUpdateAvailabilities(myEmployee.id, newAvail);
                        }
                      }}
                      className="rounded border-brand-border text-purple-500 bg-brand-bg focus:ring-purple-500 w-5 h-5 cursor-pointer"
                    />
                  </label>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => {
                  setIsEmployeeChoiceModalOpen(false);
                  setEmployeeChoiceDate(null);
                }}
                className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-black py-2.5 px-8 rounded-xl transition-all shadow-lg text-sm"
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
          dayConfig={selectedDay ? getDayConfig(format(selectedDay, 'yyyy-MM-dd')) : { isCommon: true, isParty: false }}
          onUpdateDayConfig={onUpdateDayConfig || (() => {})}
        />
      )}
    </div>
  );
}
