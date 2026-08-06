import React from 'react';
import { Edit2, Calendar, FileDown, Award, UserCheck, UserX, Trash2, Clock, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
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
  employees: Employee[]; // All employees
  onEdit: (employee: Employee) => void;
  onManageDays: (employee: Employee) => void;
  onViewStory?: (employee: Employee) => void;
  onReactivate?: (id: string) => Promise<void>;
  onInactivate?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onPurgeExpired?: () => Promise<void>;
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
}

export default function EmployeeList({ 
  employees, 
  onEdit, 
  onManageDays,
  onViewStory,
  onReactivate,
  onInactivate,
  onDelete,
  onPurgeExpired,
  currentMonth,
  setCurrentMonth
}: EmployeeListProps) {
  const [activeTab, setActiveTab] = React.useState<'active' | 'inactive'>('active');

  const activeEmployees = React.useMemo(() => {
    return employees.filter(emp => emp.status !== 'inactive');
  }, [employees]);

  const inactiveEmployees = React.useMemo(() => {
    return employees.filter(emp => emp.status === 'inactive');
  }, [employees]);

  const sortedActive = React.useMemo(() => {
    return [...activeEmployees].sort((a, b) => {
      const nameA = a.artisticName || a.name || '';
      const nameB = b.artisticName || b.name || '';
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    });
  }, [activeEmployees]);

  const sortedInactive = React.useMemo(() => {
    return [...inactiveEmployees].sort((a, b) => {
      const dateA = a.inactivatedAt ? new Date(a.inactivatedAt).getTime() : 0;
      const dateB = b.inactivatedAt ? new Date(b.inactivatedAt).getTime() : 0;
      return dateB - dateA; // Most recently inactivated first
    });
  }, [inactiveEmployees]);

  // Check how many inactives are older than 180 days (6 months)
  const expiredCount = React.useMemo(() => {
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return inactiveEmployees.filter(emp => {
      if (!emp.inactivatedAt) return false;
      const t = new Date(emp.inactivatedAt).getTime();
      return (now - t) >= SIX_MONTHS_MS;
    }).length;
  }, [inactiveEmployees]);

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-lg flex flex-col gap-0">
      {/* Header Tabs */}
      <div className="bg-brand-bg/60 border-b border-brand-border p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2",
              activeTab === 'active'
                ? "bg-brand-primary text-brand-bg shadow-sm"
                : "bg-brand-bg/80 hover:bg-brand-border/40 text-brand-muted hover:text-brand-text"
            )}
          >
            <UserCheck size={14} />
            <span>Ativos ({activeEmployees.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inactive')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 relative",
              activeTab === 'inactive'
                ? "bg-amber-500 text-brand-bg shadow-sm"
                : "bg-brand-bg/80 hover:bg-brand-border/40 text-brand-muted hover:text-brand-text"
            )}
          >
            <UserX size={14} />
            <span>Desativados ({inactiveEmployees.length})</span>
            {expiredCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>

        {activeTab === 'inactive' && expiredCount > 0 && onPurgeExpired && (
          <button
            onClick={onPurgeExpired}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            title="Excluir da base todos os funcionários desativados há mais de 6 meses"
          >
            <Trash2 size={13} />
            <span>Limpar {expiredCount} expirado(s) (+6 meses)</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'active' ? (
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
            <tbody className="divide-y divide-brand-border relative">
              {sortedActive.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-brand-muted italic">
                    Nenhum funcionário ativo encontrado.
                  </td>
                </tr>
              ) : (
                sortedActive.map((emp) => {
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

                  const totalExtraHours = monthWorkDays.reduce((acc, day) => acc + (day.extraHours || 0), 0);
                  const totalExtraEarnings = monthWorkDays.reduce((acc, day) => {
                    const extraRate = day.extraHourRateAtTime !== undefined ? day.extraHourRateAtTime : emp.extraHourRate;
                    return acc + (day.extraHours || 0) * extraRate;
                  }, 0);

                  const monthPromotion = (emp.promotions || []).find(promo => {
                    const promoDate = parseISO(promo.date);
                    return isSameMonth(promoDate, currentMonth);
                  });

                  return (
                    <motion.tr 
                      key={emp.id} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="hover:bg-brand-bg/60 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-xs font-bold text-brand-primary shrink-0 overflow-hidden">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.artisticName?.substring(0, 2) || emp.name?.substring(0, 2)}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-brand-text group-hover:text-brand-primary transition-colors">{emp.name}</span>
                            <span className="text-[10px] text-brand-primary font-medium">{emp.artisticName}</span>
                          </div>
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
                          <div className="flex justify-between w-32">
                            <span>Extra:</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{formatCurrency(emp.extraHourRate)}/h</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-black text-brand-primary">{formatCurrency(totalEarnings)}</span>
                          <div className="flex flex-col text-[10px]">
                            <span className="text-brand-muted font-bold uppercase">{monthWorkDays.length} dias</span>
                            {totalExtraHours > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                +{totalExtraHours}h extra ({formatCurrency(totalExtraEarnings)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onViewStory && (
                            <button 
                              onClick={() => onViewStory(emp)}
                              className="flex items-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-brand-bg text-[10px] font-bold py-1.5 px-2.5 rounded transition-colors border border-brand-primary/30"
                              title="Ver história e conquistas"
                            >
                              <Award size={12} />
                              <span className="hidden sm:inline">História</span>
                            </button>
                          )}
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
                            title="Editar funcionário"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Inactive Employees Tab */
        <div className="p-4 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-center gap-2.5">
            <Clock size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300">Regra de Conservação e Exclusão Automática (6 Meses)</p>
              <p className="text-[11px] text-amber-100/90 mt-0.5">
                Funcionários desativados saem das escalas e listas de trabalho mantendo seu histórico salvo. Ao completarem <strong>6 meses (180 dias) desativados</strong>, os dados são elegíveis para exclusão permanente. Você pode reativá-los a qualquer momento antes deste prazo.
              </p>
            </div>
          </div>

          {sortedInactive.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-muted italic bg-brand-bg/30 rounded-xl border border-brand-border/40">
              Nenhum funcionário desativado no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedInactive.map((emp) => {
                const inactDate = emp.inactivatedAt ? new Date(emp.inactivatedAt) : new Date();
                const now = new Date();
                const daysInactive = Math.floor((now.getTime() - inactDate.getTime()) / (1000 * 60 * 60 * 24));
                const daysRemaining = Math.max(0, 180 - daysInactive);
                const isExpired = daysInactive >= 180;

                return (
                  <div 
                    key={emp.id}
                    className={cn(
                      "p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all",
                      isExpired 
                        ? "bg-red-950/20 border-red-500/40" 
                        : "bg-brand-bg/50 border-brand-border hover:border-amber-500/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 overflow-hidden">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{emp.artisticName?.substring(0, 2) || emp.name?.substring(0, 2)}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-brand-text truncate">{emp.name}</span>
                          <span className="text-xs text-amber-400 font-medium truncate">{emp.artisticName} ({emp.level})</span>
                        </div>
                      </div>

                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0",
                        isExpired 
                          ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse" 
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      )}>
                        {isExpired ? "Expirado (+180 dias)" : "Inativo"}
                      </span>
                    </div>

                    <div className="text-[11px] bg-brand-bg/70 p-2.5 rounded-lg border border-brand-border/40 space-y-1">
                      <div className="flex justify-between text-brand-muted">
                        <span>Desativado em:</span>
                        <span className="font-bold text-brand-text">
                          {emp.inactivatedAt ? format(inactDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não registrada'}
                        </span>
                      </div>
                      <div className="flex justify-between text-brand-muted">
                        <span>Tempo desativado:</span>
                        <span className="font-bold text-amber-300">{daysInactive} {daysInactive === 1 ? 'dia' : 'dias'}</span>
                      </div>
                      <div className="flex justify-between text-brand-muted pt-1 border-t border-brand-border/30">
                        <span>Prazo até exclusão:</span>
                        <span className={cn("font-bold", isExpired ? "text-red-400 font-black" : "text-emerald-400")}>
                          {isExpired ? "Pronto para exclusão automática" : `${daysRemaining} dias restantes`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {onReactivate && (
                        <button
                          onClick={() => onReactivate(emp.id)}
                          className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                          title="Reativar funcionário e colocar de volta nas escalas"
                        >
                          <RotateCcw size={13} />
                          <span>Reativar</span>
                        </button>
                      )}

                      <button
                        onClick={() => onEdit(emp)}
                        className="p-1.5 text-brand-muted hover:text-brand-text hover:bg-brand-border/40 rounded-lg transition-all"
                        title="Ver ou editar dados"
                      >
                        <Edit2 size={16} />
                      </button>

                      {onDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja excluir definitivamente ${emp.name} da base? Esta ação apaga todos os registros permanentemente.`)) {
                              onDelete(emp.id);
                            }
                          }}
                          className="p-1.5 text-red-400/80 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all"
                          title="Excluir definitivamente da base de dados"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

