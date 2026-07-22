import React from 'react';
import { Edit2, Calendar, FileDown } from 'lucide-react';
import { Employee } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';

const COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#F87171', '#FF2E93', '#22D3EE'];

const ListConfettiCelebration: React.FC<{ triggerKey: number }> = ({ triggerKey }) => {
  const particles = Array.from({ length: 12 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10" key={triggerKey}>
      {particles.map((_, i) => {
        const angle = (i / 12) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
        const velocity = 25 + Math.random() * 30;
        const xTarget = Math.cos(angle) * velocity;
        const yTarget = Math.sin(angle) * velocity - 15; // Bias upward
        const color = COLORS[i % COLORS.length];
        const size = 3 + Math.random() * 4;
        const isCircle = Math.random() > 0.4;

        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: isCircle ? '50%' : '2px',
              x: '-50%',
              y: '-50%',
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: xTarget,
              y: yTarget,
              scale: [0, 1.4, 0.8, 0],
              opacity: [1, 1, 0.5, 0],
              rotate: Math.random() * 360 * 3,
            }}
            transition={{
              duration: 0.8 + Math.random() * 0.4,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
};

const PromoBadge: React.FC = () => {
  const [triggerKey, setTriggerKey] = React.useState(0);
  return (
    <div className="relative inline-block">
      <span 
        onMouseEnter={() => setTriggerKey(k => k + 1)}
        onClick={() => setTriggerKey(k => k + 1)}
        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-wider cursor-pointer select-none transition-all duration-200"
        title="Promovido(a) este mês! Passe o mouse para estourar mais confetes ✨"
      >
        ✨ PROMO
      </span>
      <ListConfettiCelebration triggerKey={triggerKey} />
    </div>
  );
};

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
              <th className="p-4 text-xs font-bold text-brand-muted uppercase tracking-wider">Funcionário</th>
              <th className="p-4 text-xs font-bold text-brand-muted uppercase tracking-wider">Nível</th>
              <th className="p-4 text-xs font-bold text-brand-muted uppercase tracking-wider hidden md:table-cell">Valores</th>
              <th className="p-4 text-xs font-bold text-brand-muted uppercase tracking-wider">
                <div className="flex items-center gap-4">
                  <span>Mês</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] capitalize w-24 text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </th>
              <th className="p-4 text-xs font-bold text-brand-muted uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {employees.map((emp) => {
              const monthWorkDays = (emp.workDays || []).filter(day => {
                if (day.isCancelled) return false;
                const date = parseISO(day.date);
                return isSameMonth(date, currentMonth);
              });

              const totalEarnings = monthWorkDays.reduce((acc, day) => {
                let dayBase = 0;
                if (day.type === 'common') {
                  dayBase = day.dailyRateAtTime !== undefined ? day.dailyRateAtTime : emp.dailyRate;
                } else if (day.type === 'party') {
                  dayBase = day.partyRateAtTime !== undefined ? day.partyRateAtTime : emp.partyRate;
                }
                
                const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : emp.extraHourRate;
                const extra = (day.extraHours || 0) * extraRate;
                return acc + dayBase + extra;
              }, 0);

              const monthPromotion = (emp.promotions || []).find(promo => {
                const promoDate = parseISO(promo.date);
                return isSameMonth(promoDate, currentMonth);
              });

              return (
                <tr key={emp.id} className="hover:bg-brand-bg/60 transition-colors group">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-brand-text group-hover:text-brand-primary transition-colors">{emp.name}</span>
                      <span className="text-[10px] text-brand-primary font-medium">{emp.artisticName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-brand-bg border border-brand-border px-2 py-1 rounded text-brand-muted">
                        {emp.level}
                      </span>
                      {monthPromotion && <PromoBadge />}
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-col gap-1 text-[10px] text-brand-muted">
                      <div className="flex justify-between w-32">
                        <span>CCSP:</span>
                        <span className="text-brand-text font-bold">{formatCurrency(emp.dailyRate)}</span>
                      </div>
                      <div className="flex justify-between w-32">
                        <span>Festa:</span>
                        <span className="text-brand-text font-bold">{formatCurrency(emp.partyRate)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-brand-primary">{formatCurrency(totalEarnings)}</span>
                      <span className="text-[10px] text-brand-muted font-bold uppercase">{monthWorkDays.length} dias</span>
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
                        className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-border/40 rounded transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-border/40 rounded transition-all">
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
