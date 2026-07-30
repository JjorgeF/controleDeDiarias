import React from 'react';
import { Edit2, Calendar, Sparkles, Award } from 'lucide-react';
import { Employee } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';

const COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#F87171', '#FF2E93', '#22D3EE'];

const ConfettiCelebration: React.FC<{ triggerKey: number }> = ({ triggerKey }) => {
  const particles = Array.from({ length: 18 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10" key={triggerKey}>
      {particles.map((_, i) => {
        const angle = (i / 18) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
        const velocity = 35 + Math.random() * 45;
        const xTarget = Math.cos(angle) * velocity;
        const yTarget = Math.sin(angle) * velocity - 25; // Bias upward
        const color = COLORS[i % COLORS.length];
        const size = 4 + Math.random() * 5;
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
              duration: 0.9 + Math.random() * 0.5,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
};

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onManageDays: (employee: Employee) => void;
  onViewStory?: (employee: Employee) => void;
  currentMonth: Date;
  isReadOnly?: boolean;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ 
  employee, 
  onEdit, 
  onManageDays, 
  onViewStory,
  currentMonth,
  isReadOnly = false
}) => {
  const [burstKey, setBurstKey] = React.useState(0);

  const triggerCelebration = () => {
    setBurstKey(prev => prev + 1);
  };

  const monthWorkDays = (employee.workDays || []).filter(day => {
    if (day.isCancelled) return false;
    const date = parseISO(day.date);
    return isSameMonth(date, currentMonth);
  });

  const totalEarnings = monthWorkDays.reduce((acc, day) => {
    let dayBase = 0;
    if (day.type === 'common') {
      dayBase = day.dailyRateAtTime !== undefined ? day.dailyRateAtTime : employee.dailyRate;
    } else if (day.type === 'party') {
      dayBase = day.partyRateAtTime !== undefined ? day.partyRateAtTime : employee.partyRate;
    }
    
    const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : employee.extraHourRate;
    const extra = (day.extraHours || 0) * extraRate;
    return acc + dayBase + extra;
  }, 0);

  const monthPromotion = (employee.promotions || []).find(promo => {
    const promoDate = parseISO(promo.date);
    return isSameMonth(promoDate, currentMonth);
  });

  return (
    <div className="relative group rounded-xl p-[1px] overflow-hidden transition-all duration-300 h-full">
      {/* Animated Glowing Light Beam Border */}
      <div 
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] animate-card-beam opacity-30 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, #fbbf24 310deg, #f59e0b 340deg, transparent 360deg)',
        }}
      />
      {/* Soft Ambient Background Aura Glow */}
      <div 
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] animate-card-beam opacity-20 blur-lg group-hover:opacity-40 transition-opacity duration-500 pointer-events-none z-0"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, #fbbf24 310deg, #f59e0b 340deg, transparent 360deg)',
        }}
      />

      {/* Main Card Container */}
      <div className="relative z-10 bg-brand-card border border-brand-border/80 rounded-[11px] overflow-hidden flex flex-col h-full transition-colors group-hover:border-brand-primary/30">
        <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-primary to-emerald-400 p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full bg-brand-card rounded-[10px] flex items-center justify-center font-extrabold text-sm text-brand-primary uppercase overflow-hidden">
                {employee.photoUrl ? (
                  <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover rounded-[10px]" />
                ) : (
                  <span>{employee.artisticName?.substring(0, 2) || employee.name?.substring(0, 2)}</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-0.5 block">
                {employee.artisticName || 'SEM NOME ARTÍSTICO'}
              </span>
              <h3 className="text-lg font-bold text-brand-text group-hover:text-brand-primary transition-colors leading-tight">
                {employee.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-brand-muted">{employee.level}</p>
                {monthPromotion && (
                  <div className="relative inline-block">
                    <span 
                      onMouseEnter={triggerCelebration}
                      onClick={triggerCelebration}
                      className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-wider flex items-center gap-0.5 cursor-pointer select-none transition-all duration-200"
                    >
                      Promovido(a) ✨
                    </span>
                    <ConfettiCelebration triggerKey={burstKey} />
                  </div>
                )}
              </div>
            </div>
          </div>
          {!isReadOnly && (
            <button 
              onClick={() => onEdit(employee)}
              className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-border/40 rounded-lg transition-all"
              title="Editar funcionário"
            >
              <Edit2 size={18} />
            </button>
          )}
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Diária CCSP:</span>
            <span className="font-bold text-brand-text">{formatCurrency(employee.dailyRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Diária Festa:</span>
            <span className="font-bold text-brand-text">{formatCurrency(employee.partyRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Hora Extra:</span>
            <span className="font-bold text-brand-text">{formatCurrency(employee.extraHourRate)}</span>
          </div>
        </div>

        {monthPromotion && (
          <div className="bg-yellow-500/[0.03] border border-yellow-500/20 rounded-xl p-3.5 mb-6 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-yellow-500 mb-2 select-none">
              <Sparkles size={13} className="animate-pulse" />
              <span>Nível & Taxas Atualizadas!</span>
            </div>
            <div className="text-brand-muted space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span>Promovido(a) em:</span>
                <span className="text-brand-text font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/10">
                  {format(parseISO(monthPromotion.date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Nível anterior:</span>
                <span className="line-through text-brand-muted/70 font-normal">{monthPromotion.previousLevel}</span>
              </div>
              <div className="flex justify-between">
                <span>Novo nível:</span>
                <span className="text-brand-text font-semibold">{monthPromotion.newLevel}</span>
              </div>
              <div className="border-t border-brand-border/40 pt-2 mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Diária CCSP anterior:</span>
                  <span className="text-brand-muted/70 line-through">{formatCurrency(monthPromotion.previousDailyRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diária Festa anterior:</span>
                  <span className="text-brand-muted/70 line-through">{formatCurrency(monthPromotion.previousPartyRate)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-brand-border pt-4 mt-auto">
          <div className="flex items-center justify-center mb-3">
            <span className="text-xs font-bold text-brand-muted capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] text-brand-muted uppercase font-bold mb-1">
              {monthWorkDays.length} dias trabalhados
            </p>
            <p className="text-2xl font-black text-brand-primary">
              {formatCurrency(totalEarnings)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-brand-bg/30 border-t border-brand-border flex gap-2">
        {onViewStory && (
          <button 
            onClick={() => onViewStory(employee)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg border border-brand-primary/30 hover:border-transparent text-xs font-extrabold py-2 px-3 rounded-lg transition-colors"
            title="Ver história e conquistas"
          >
            <Award size={14} />
            História
          </button>
        )}
        {!isReadOnly && (
          <button 
            onClick={() => onManageDays(employee)}
            className={`${onViewStory ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg text-xs font-bold py-2 px-3 rounded-lg transition-colors`}
          >
            <Calendar size={14} />
            Adicionar Dia
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

export default EmployeeCard;
