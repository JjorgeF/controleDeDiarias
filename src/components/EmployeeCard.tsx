import React, { useState } from 'react';
import { Edit2, Pencil, User, UserRound, Calendar, Sparkles, Award, CreditCard, Copy, Check, Shirt, PhoneCall, Wind, CheckCircle2, DollarSign } from 'lucide-react';
import { Employee } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { AnimatedCurrency } from './AnimatedCurrency';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, lastDayOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import EditPersonalDetailsModal from './EditPersonalDetailsModal';

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
  onUpdateDetails?: (employeeId: string, updatedFields: Partial<Employee>) => Promise<void> | void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ 
  employee, 
  onEdit, 
  onManageDays, 
  onViewStory,
  currentMonth,
  isReadOnly = false,
  onUpdateDetails
}) => {
  const [burstKey, setBurstKey] = React.useState(0);
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const triggerCelebration = () => {
    setBurstKey(prev => prev + 1);
  };

  const handleCopyPix = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (employee.pixKey) {
      navigator.clipboard.writeText(employee.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatLigaStartDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const monthIndex = parseInt(parts[1]) - 1;
        const dateObj = new Date(year, monthIndex, 1);
        return format(dateObj, "MMMM 'de' yyyy", { locale: ptBR });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const monthWorkDays = (employee.workDays || []).filter(day => {
    if (day.isCancelled) return false;
    const date = parseISO(day.date);
    return isSameMonth(date, currentMonth);
  });

  const totalEarnings = monthWorkDays.reduce((acc, day) => {
    let dayBase = 0;
    if (day.isReducedHours && day.customTotalPay !== undefined && day.customTotalPay >= 0) {
      dayBase = day.customTotalPay;
    } else if (day.type === 'common') {
      dayBase = day.dailyRateAtTime !== undefined ? day.dailyRateAtTime : employee.dailyRate;
    } else if (day.type === 'party') {
      dayBase = day.partyRateAtTime !== undefined ? day.partyRateAtTime : employee.partyRate;
    }
    
    const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : employee.extraHourRate;
    const extra = (day.extraHours || 0) * extraRate;
    return acc + dayBase + extra;
  }, 0);

  const totalExtraHours = monthWorkDays.reduce((acc, day) => acc + (day.extraHours || 0), 0);
  const totalExtraEarnings = monthWorkDays.reduce((acc, day) => {
    const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : employee.extraHourRate;
    return acc + (day.extraHours || 0) * extraRate;
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
            <div className="w-12 h-12 rounded-full bg-logo-gradient animate-logo-border p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full bg-brand-card rounded-full flex items-center justify-center font-extrabold text-sm text-brand-primary uppercase overflow-hidden">
                {employee.photoUrl ? (
                  <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover rounded-full" />
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
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => setIsEditDetailsOpen(true)}
              className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all border border-amber-500/20"
              title="Dados Pessoais, PIX, Uniforme e Contatos"
            >
              <User size={18} />
            </button>

            {!isReadOnly && (
              <button 
                onClick={() => onEdit(employee)}
                className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-border/40 rounded-lg transition-all"
                title="Editar taxas financeiras e nível"
              >
                <Edit2 size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Diária CCSP:</span>
            <AnimatedCurrency value={employee.dailyRate} className="font-bold text-brand-text" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Diária Festa:</span>
            <AnimatedCurrency value={employee.partyRate} className="font-bold text-brand-text" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">Hora Extra:</span>
            <AnimatedCurrency value={employee.extraHourRate} className="font-bold text-brand-text" />
          </div>
        </div>

        {/* Dados de Pagamento (PIX) */}
        <div className="mb-5 pt-3 border-t border-brand-border/60">
          {employee.pixKey ? (
            <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-2.5 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                  <CreditCard size={12} />
                  PIX ({employee.pixType?.toUpperCase() || 'CPF'})
                </span>
                <button
                  onClick={handleCopyPix}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition-colors flex items-center gap-1"
                  title="Copiar Chave PIX"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copied ? 'Copiado!' : 'Copiar PIX'}</span>
                </button>
              </div>

              <div className="font-mono text-xs font-bold text-brand-text truncate select-all">
                {employee.pixKey}
              </div>

              {(employee.pixBank || employee.pixOwnerName) && (
                <div className="text-[10px] text-brand-muted flex flex-wrap gap-x-2 gap-y-0.5 pt-1 border-t border-slate-800/80">
                  {employee.pixBank && <span>Banco: <strong className="text-gray-200">{employee.pixBank}</strong></span>}
                  {employee.pixOwnerName && <span>Titular: <strong className="text-gray-200">{employee.pixOwnerName}</strong></span>}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsEditDetailsOpen(true)}
              className="w-full py-2 px-3 bg-slate-900/40 hover:bg-slate-900/80 border border-dashed border-brand-border hover:border-amber-500/50 rounded-xl text-[11px] font-medium text-brand-muted hover:text-amber-400 transition-all flex items-center justify-center gap-1.5"
            >
              <CreditCard size={13} />
              <span>+ Indicar Chave PIX e Banco</span>
            </button>
          )}
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
            <p className="text-[10px] text-brand-muted uppercase font-bold mb-1 flex items-center justify-center gap-1.5 flex-wrap">
              <span>{monthWorkDays.length} dias trabalhados</span>
              {totalExtraHours > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-extrabold normal-case">
                  (+{totalExtraHours}h extra = {formatCurrency(totalExtraEarnings)})
                </span>
              )}
            </p>
            <p className="text-2xl font-black text-brand-primary">
              <AnimatedCurrency value={totalEarnings} />
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-brand-bg/30 border-t border-brand-border flex gap-2">
        {onViewStory && (
          <button 
            onClick={() => onViewStory(employee)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg border border-brand-primary/30 hover:border-transparent text-xs font-extrabold py-2 px-3 rounded-lg transition-colors"
            title="Ver perfil e dados cadastrais"
          >
            <UserRound size={14} />
            Perfil
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

      <EditPersonalDetailsModal
        isOpen={isEditDetailsOpen}
        onClose={() => setIsEditDetailsOpen(false)}
        employee={employee}
        onSave={async (employeeId, updatedFields) => {
          if (onUpdateDetails) {
            await onUpdateDetails(employeeId, updatedFields);
          }
        }}
      />
    </div>
  );
};

export default EmployeeCard;
