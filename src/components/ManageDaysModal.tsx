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
import { X, ChevronLeft, ChevronRight, Clock, DollarSign, Sparkles } from 'lucide-react';
import { Employee, WorkDay, DayType } from '../types';
import { cn } from '../lib/utils';

interface ManageDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void;
}

export default function ManageDaysModal({ isOpen, onClose, employee, onUpdateDays }: ManageDaysModalProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [tempDays, setTempDays] = React.useState<WorkDay[]>([]);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTempDays([...employee.workDays]);
      setSelectedDay(null);
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const existingDayIndex = tempDays.findIndex(d => d.date === dateStr);
    setSelectedDay(day);

    if (existingDayIndex === -1) {
      // First click: common day
      setTempDays([...tempDays, { 
        date: dateStr, 
        type: 'common', 
        extraHours: 0,
        dailyRateAtTime: employee.dailyRate,
        partyRateAtTime: employee.partyRate,
        extraHourRateAtTime: employee.extraHourRate,
        levelAtTime: employee.level
      }]);
    } else {
      const existingDay = tempDays[existingDayIndex];
      if (existingDay.isCancelled) {
        // If cancelled, uncancel it as a common day and ignore previous penalty
        const newDays = [...tempDays];
        newDays[existingDayIndex] = { 
          ...existingDay, 
          isCancelled: false, 
          cancellationIgnored: true,
          cancellationDismissed: true,
          revertedAt: new Date().toISOString(),
          reversionReason: 'Reativado pelo administrador',
          cancellationViewed: true, 
          type: 'common',
          dailyRateAtTime: existingDay.dailyRateAtTime !== undefined ? existingDay.dailyRateAtTime : employee.dailyRate,
          partyRateAtTime: existingDay.partyRateAtTime !== undefined ? existingDay.partyRateAtTime : employee.partyRate,
          extraHourRateAtTime: existingDay.extraHourRateAtTime !== undefined ? existingDay.extraHourRateAtTime : employee.extraHourRate,
          levelAtTime: existingDay.levelAtTime || employee.level
        };
        setTempDays(newDays);
      } else if (existingDay.type === 'common') {
        // Second click: party day
        const newDays = [...tempDays];
        newDays[existingDayIndex] = { 
          ...existingDay, 
          type: 'party',
          dailyRateAtTime: existingDay.dailyRateAtTime !== undefined ? existingDay.dailyRateAtTime : employee.dailyRate,
          partyRateAtTime: existingDay.partyRateAtTime !== undefined ? existingDay.partyRateAtTime : employee.partyRate,
          extraHourRateAtTime: existingDay.extraHourRateAtTime !== undefined ? existingDay.extraHourRateAtTime : employee.extraHourRate,
          levelAtTime: existingDay.levelAtTime || employee.level
        };
        setTempDays(newDays);
      } else {
        // Third click: remove day
        setTempDays(tempDays.filter(d => d.date !== dateStr));
        if (selectedDay && isSameDay(day, selectedDay)) {
          setSelectedDay(null);
        }
      }
    }
  };

  const handleExtraHoursChange = (hours: number) => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const existingDayIndex = tempDays.findIndex(d => d.date === dateStr);
    
    if (existingDayIndex !== -1) {
      const newDays = [...tempDays];
      newDays[existingDayIndex] = { ...newDays[existingDayIndex], extraHours: hours };
      setTempDays(newDays);
    }
  };

  const handleToggleReducedHours = (enabled: boolean) => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const existingDayIndex = tempDays.findIndex(d => d.date === dateStr);
    
    if (existingDayIndex !== -1) {
      const newDays = [...tempDays];
      const curr = newDays[existingDayIndex];
      newDays[existingDayIndex] = { 
        ...curr, 
        isReducedHours: enabled,
        customHoursText: enabled ? (curr.customHoursText || '01h30m') : undefined,
        customTotalPay: enabled ? (curr.customTotalPay !== undefined ? curr.customTotalPay : 45.0) : undefined
      };
      setTempDays(newDays);
    }
  };

  const handleCustomHoursTextChange = (text: string) => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const existingDayIndex = tempDays.findIndex(d => d.date === dateStr);
    
    if (existingDayIndex !== -1) {
      const newDays = [...tempDays];
      newDays[existingDayIndex] = { 
        ...newDays[existingDayIndex], 
        isReducedHours: true,
        customHoursText: text 
      };
      setTempDays(newDays);
    }
  };

  const handleCustomTotalPayChange = (amount: number) => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const existingDayIndex = tempDays.findIndex(d => d.date === dateStr);
    
    if (existingDayIndex !== -1) {
      const newDays = [...tempDays];
      newDays[existingDayIndex] = { 
        ...newDays[existingDayIndex], 
        isReducedHours: true,
        customTotalPay: amount 
      };
      setTempDays(newDays);
    }
  };

  const getDayData = (day: Date): WorkDay | undefined => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return tempDays.find(d => d.date === dateStr);
  };

  const handleSave = () => {
    onUpdateDays(employee.id, tempDays);
    onClose();
  };

  const selectedDayData = selectedDay ? getDayData(selectedDay) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-brand-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Gerenciar Dias de Trabalho</h2>
            <p className="text-sm text-gray-400">Para: <span className="text-white font-medium">{employee.artisticName || employee.name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-8 overflow-y-auto flex-1">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:text-brand-primary transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h3 className="text-lg font-bold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:text-brand-primary transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-xs font-bold text-gray-500 uppercase">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dayData = getDayData(day);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all relative",
                      !isCurrentMonth && "opacity-20",
                      (!dayData || dayData.isCancelled) && isCurrentMonth && "hover:bg-white/5",
                      dayData?.type === 'common' && !dayData.isCancelled && !dayData.isReducedHours && "bg-brand-primary text-brand-bg",
                      dayData?.type === 'party' && !dayData.isCancelled && !dayData.isReducedHours && "bg-brand-party text-white",
                      dayData?.isReducedHours && !dayData.isCancelled && "bg-amber-500 text-slate-950 font-bold",
                      isSelected && "ring-2 ring-white ring-offset-2 ring-offset-brand-card"
                    )}
                  >
                    {format(day, 'd')}
                    {dayData?.isReducedHours && !dayData.isCancelled ? (
                      <span className="absolute -top-1 -left-1 w-4 h-4 bg-amber-400 text-slate-950 text-[8px] font-black flex items-center justify-center rounded-full border border-brand-card shadow">
                        ⏱
                      </span>
                    ) : null}
                    {dayData?.extraHours && !dayData.isCancelled ? (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[8px] flex items-center justify-center rounded-full border border-brand-card shadow">
                        +{dayData.extraHours}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full md:w-64 space-y-4">
            {selectedDayData && !selectedDayData.isCancelled ? (
              <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-primary/30 animate-in fade-in slide-in-from-right-4 space-y-4">
                <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                  <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                    {format(selectedDay!, "dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded",
                    selectedDayData.isReducedHours
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : selectedDayData.type === 'party'
                        ? "bg-brand-party/20 text-brand-party"
                        : "bg-brand-primary/20 text-brand-primary"
                  )}>
                    {selectedDayData.isReducedHours ? 'Horário Reduzido' : selectedDayData.type === 'party' ? 'Festa' : 'Dia CCSP'}
                  </span>
                </div>

                {/* Option 1: Horário Reduzido & Acordo de Valor */}
                <div className="bg-brand-card/70 p-3 rounded-lg border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-400 cursor-pointer">
                      <Clock size={14} className="text-amber-400" />
                      Horário Reduzido
                    </label>
                    <input 
                      type="checkbox"
                      checked={!!selectedDayData.isReducedHours}
                      onChange={(e) => handleToggleReducedHours(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {selectedDayData.isReducedHours && (
                    <div className="space-y-3 pt-1 animate-in fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                          Quantas Horas (Ex: 01h30m)
                        </label>
                        <input 
                          type="text"
                          value={selectedDayData.customHoursText || ''}
                          onChange={(e) => handleCustomHoursTextChange(e.target.value)}
                          placeholder="01h30m"
                          className="w-full bg-brand-bg border border-amber-500/40 rounded-md py-1.5 px-3 text-xs font-medium text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                          Valor Total Acordado (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">R$</span>
                          <input 
                            type="number"
                            min="0"
                            step="1"
                            value={selectedDayData.customTotalPay !== undefined ? selectedDayData.customTotalPay : ''}
                            onChange={(e) => handleCustomTotalPayChange(Number(e.target.value))}
                            placeholder="45.00"
                            className="w-full bg-brand-bg border border-amber-500/40 rounded-md py-1.5 pl-8 pr-3 text-xs font-bold text-emerald-400 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div className="text-[10px] text-amber-300/80 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                        Neste dia, será pago o valor fixo acordado de <strong>R$ {selectedDayData.customTotalPay || 0}</strong> por <strong>{selectedDayData.customHoursText || 'horas acordadas'}</strong>.
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Horas Extras normais */}
                {!selectedDayData.isReducedHours && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Horas Extras Normais</label>
                      <input 
                        type="number"
                        min="0"
                        step="0.5"
                        value={selectedDayData.extraHours || ''}
                        onChange={(e) => handleExtraHoursChange(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-brand-card border border-brand-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 italic">
                      Calculadas a R$ {employee.extraHourRate}/h.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border min-h-[110px] flex items-center justify-center text-center">
                <p className="text-xs text-gray-500 italic">Selecione um dia marcado para configurar horário reduzido ou horas extras.</p>
              </div>
            )}

            <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border">
              <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Legenda</h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-brand-primary"></div>
                  <span>Dia CCSP Padrão</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-brand-party"></div>
                  <span>Dia de Festa</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-amber-500"></div>
                  <span>Horário Reduzido (Acordo)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-blue-500"></div>
                  <span>Com Hora Extra</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 italic">
              Dica: Clique no dia no calendário para alternar o tipo (CCSP/Festa) ou remover.
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-brand-border flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold py-3 rounded-lg transition-colors"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
