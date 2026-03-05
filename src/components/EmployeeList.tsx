import React from 'react';
import { Edit2, Calendar, FileDown } from 'lucide-react';
import { Employee } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onManageDays: (employee: Employee) => void;
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
}

export default function EmployeeList({ 
  employees, 
  onEdit, 
  onManageDays,
  currentMonth,
  setCurrentMonth
}: EmployeeListProps) {

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-brand-border bg-brand-bg/30">
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Funcionário</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nível</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Valores</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-4">
                  <span>Mês</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] capitalize w-24 text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {employees.map((emp) => {
              const monthWorkDays = emp.workDays.filter(day => {
                const date = parseISO(day.date);
                return isSameMonth(date, currentMonth);
              });

              const totalEarnings = monthWorkDays.reduce((acc, day) => {
                let dayBase = 0;
                if (day.type === 'common') dayBase = emp.dailyRate;
                else if (day.type === 'party') dayBase = emp.partyRate;
                
                const extra = (day.extraHours || 0) * emp.extraHourRate;
                return acc + dayBase + extra;
              }, 0);

              return (
                <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{emp.name}</span>
                      <span className="text-[10px] text-brand-primary font-medium">{emp.artisticName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs bg-brand-bg border border-brand-border px-2 py-1 rounded text-gray-400">
                      {emp.level}
                    </span>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-col gap-1 text-[10px] text-gray-500">
                      <div className="flex justify-between w-32">
                        <span>Comum:</span>
                        <span className="text-white font-bold">{formatCurrency(emp.dailyRate)}</span>
                      </div>
                      <div className="flex justify-between w-32">
                        <span>Festa:</span>
                        <span className="text-white font-bold">{formatCurrency(emp.partyRate)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-brand-primary">{formatCurrency(totalEarnings)}</span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">{monthWorkDays.length} dias</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => onManageDays(emp)}
                        className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg text-[10px] font-bold py-1.5 px-3 rounded transition-colors"
                      >
                        <Calendar size={12} />
                        <span className="hidden sm:inline">Adicionar Dia</span>
                      </button>
                      <button 
                        onClick={() => onEdit(emp)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all">
                        <FileDown size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
