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
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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
      setTempDays([...tempDays, { date: dateStr, type: 'common', extraHours: 0 }]);
    } else {
      const existingDay = tempDays[existingDayIndex];
      if (existingDay.type === 'common') {
        // Second click: party day
        const newDays = [...tempDays];
        newDays[existingDayIndex] = { ...existingDay, type: 'party' };
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
      <div className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <div>
            <h2 className="text-xl font-bold text-white">Gerenciar Dias de Trabalho</h2>
            <p className="text-sm text-gray-400">Para: <span className="text-white font-medium">{employee.artisticName || employee.name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-8">
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
                      !dayData && isCurrentMonth && "hover:bg-white/5",
                      dayData?.type === 'common' && "bg-brand-primary text-brand-bg",
                      dayData?.type === 'party' && "bg-purple-600 text-white",
                      isSelected && "ring-2 ring-white ring-offset-2 ring-offset-brand-card"
                    )}
                  >
                    {format(day, 'd')}
                    {dayData?.extraHours ? (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-[8px] flex items-center justify-center rounded-full border border-brand-card">
                        +{dayData.extraHours}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full md:w-56 space-y-6">
            {selectedDayData ? (
              <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-primary/30 animate-in fade-in slide-in-from-right-4">
                <h4 className="text-xs font-bold text-brand-primary mb-3 uppercase tracking-wider">
                  {format(selectedDay!, "dd 'de' MMMM", { locale: ptBR })}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Horas Extras</label>
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
                    As horas extras serão calculadas com base no valor de R$ {employee.extraHourRate}/h.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border min-h-[110px] flex items-center justify-center text-center">
                <p className="text-xs text-gray-500 italic">Selecione um dia marcado para editar as horas extras.</p>
              </div>
            )}

            <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border">
              <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Legenda</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-brand-primary"></div>
                  <span>Dia Comum</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-purple-600"></div>
                  <span>Dia de Festa</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span>Com Hora Extra</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-400 italic">
              Dica: Clique repetidamente no dia para alternar entre os tipos ou remover.
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-brand-border flex gap-3">
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
