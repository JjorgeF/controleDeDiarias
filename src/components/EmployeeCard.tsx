import React from 'react';
import { Edit2, Calendar } from 'lucide-react';
import { Employee } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onManageDays: (employee: Employee) => void;
  currentMonth: Date;
  isReadOnly?: boolean;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ 
  employee, 
  onEdit, 
  onManageDays, 
  currentMonth,
  isReadOnly = false
}) => {

  const monthWorkDays = employee.workDays.filter(day => {
    const date = parseISO(day.date);
    return isSameMonth(date, currentMonth);
  });

  const totalEarnings = monthWorkDays.reduce((acc, day) => {
    let dayBase = 0;
    if (day.type === 'common') dayBase = employee.dailyRate;
    else if (day.type === 'party') dayBase = employee.partyRate;
    
    const extra = (day.extraHours || 0) * employee.extraHourRate;
    return acc + dayBase + extra;
  }, 0);

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden flex flex-col h-full transition-all hover:border-brand-primary/30 group">
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-1 block">
              {employee.artisticName || 'SEM NOME ARTÍSTICO'}
            </span>
            <h3 className="text-xl font-bold text-white group-hover:text-brand-primary transition-colors">
              {employee.name}
            </h3>
            <p className="text-xs text-gray-400 mt-1">{employee.level}</p>
          </div>
          {!isReadOnly && (
            <div className="flex gap-2">
              <button 
                onClick={() => onEdit(employee)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <Edit2 size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Diária Comum:</span>
            <span className="font-bold">{formatCurrency(employee.dailyRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Diária Festa:</span>
            <span className="font-bold">{formatCurrency(employee.partyRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Hora Extra:</span>
            <span className="font-bold">{formatCurrency(employee.extraHourRate)}</span>
          </div>
        </div>

        <div className="border-t border-brand-border pt-4 mt-auto">
          <div className="flex items-center justify-center mb-3">
            <span className="text-xs font-bold text-gray-300 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              {monthWorkDays.length} dias trabalhados
            </p>
            <p className="text-2xl font-black text-brand-primary">
              {formatCurrency(totalEarnings)}
            </p>
          </div>
        </div>
      </div>

      {!isReadOnly && (
        <div className="p-3 bg-brand-bg/30 border-t border-brand-border flex gap-2">
          <button 
            onClick={() => onManageDays(employee)}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg text-xs font-bold py-2.5 rounded-lg transition-colors"
          >
            <Calendar size={14} />
            Adicionar Dia
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeCard;
