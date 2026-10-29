import React, { useMemo } from 'react';
import { 
  format, 
  parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Users, 
  Ban, 
  Briefcase, 
  Wrench, 
  Moon, 
  ShieldCheck, 
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Employee, WorkDay, DayConfig } from '../types';
import { cn, formatCurrency } from '../lib/utils';

interface EmployeeMonthOverviewProps {
  myEmployee: Employee;
  currentMonth: Date;
  currentMonthKey: string;
  employees: Employee[];
  dayConfigs?: Record<string, DayConfig>;
  getDayConfig: (dateStr: string) => DayConfig;
  scheduledDaysThisMonth: WorkDay[];
  totalEarningsThisMonth: number;
  onCancelDate: (date: Date) => void;
}

export const EmployeeMonthOverview: React.FC<EmployeeMonthOverviewProps> = ({
  myEmployee,
  currentMonth,
  currentMonthKey,
  employees,
  dayConfigs = {},
  getDayConfig,
  scheduledDaysThisMonth,
  totalEarningsThisMonth,
  onCancelDate
}) => {
  const hasDeclaredNoAvail = useMemo(() => {
    return !!myEmployee.availabilities?.includes(`no_avail_${currentMonthKey}`);
  }, [myEmployee, currentMonthKey]);

  // Lista detalhada de disponibilidades enviadas pelo colaborador neste mês
  const myAvailabilitiesThisMonth = useMemo(() => {
    if (!myEmployee.availabilities || hasDeclaredNoAvail) return [];

    const monthAvailStrings = myEmployee.availabilities.filter(
      str => str.startsWith(currentMonthKey) && !str.startsWith('login_') && !str.startsWith('no_avail_')
    );

    const uniqueDates: string[] = Array.from(new Set<string>(monthAvailStrings.map(s => s.split('_')[0]))).sort();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return uniqueDates.map(dateStr => {
      const config = getDayConfig(dateStr);
      const hasCommon = monthAvailStrings.some(s => s === dateStr || s === `${dateStr}_common`);
      const hasParty = monthAvailStrings.some(s => s.startsWith(`${dateStr}_party`));

      // Contagem da equipe escalada nesta data (não cancelados)
      const teamScheduled = employees.filter(emp =>
        (emp.workDays || []).some(d => d.date === dateStr && !d.isCancelled)
      );
      const teamCount = teamScheduled.length;

      // Escalas do próprio colaborador nesta data
      const myAssignments = (myEmployee.workDays || []).filter(
        d => d.date === dateStr && !d.isCancelled
      );
      const isMyScheduled = myAssignments.length > 0;

      const dateObj = parseISO(dateStr);
      const dateStart = new Date(dateObj);
      dateStart.setHours(0, 0, 0, 0);
      const isPast = dateStart < todayStart;

      return {
        dateStr,
        dateObj,
        hasCommon,
        hasParty,
        teamCount,
        isMyScheduled,
        myAssignments,
        isPast,
        config
      };
    });
  }, [myEmployee, currentMonthKey, dayConfigs, employees, hasDeclaredNoAvail, getDayConfig]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start animate-in fade-in slide-in-from-top-4">
      {/* ----------------- COLUNA 1: SUAS DISPONIBILIDADES ENVIADAS ----------------- */}
      <div className="bg-brand-card border border-brand-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header Coluna 1 */}
        <div className="p-3.5 md:p-5 border-b border-brand-border bg-brand-bg/40 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm md:text-base font-black text-brand-text flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="capitalize">Disponibilidades Enviadas — {format(currentMonth, 'MMMM', { locale: ptBR })}</span>
            </h3>
            <p className="text-[10px] md:text-xs text-brand-muted font-medium mt-0.5">
              Dias que você informou à administração que tem disponibilidade
            </p>
          </div>
          <span className={cn(
            "text-xs font-black px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap",
            myAvailabilitiesThisMonth.length > 0 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
              : "bg-brand-bg text-brand-muted border-brand-border"
          )}>
            {myAvailabilitiesThisMonth.length} {myAvailabilitiesThisMonth.length === 1 ? 'dia informado' : 'dias informados'}
          </span>
        </div>

        {/* Conteúdo Coluna 1 */}
        <div className="p-4 md:p-5 flex-1">
          {hasDeclaredNoAvail ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-red-500/20 bg-red-500/[0.02] rounded-xl text-center">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-2.5">
                <Ban size={20} />
              </div>
              <p className="text-sm text-red-300 font-bold">Sem Disponibilidade Declarada</p>
              <p className="text-xs text-brand-muted mt-1 max-w-xs">
                Você informou à coordenação que não poderá trabalhar em nenhum dia de {format(currentMonth, 'MMMM', { locale: ptBR })}.
              </p>
            </div>
          ) : myAvailabilitiesThisMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-brand-border rounded-xl text-center">
              <div className="w-10 h-10 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-500 mb-2.5">
                <Calendar size={20} />
              </div>
              <p className="text-sm text-gray-300 font-bold">Nenhuma disponibilidade enviada</p>
              <p className="text-xs text-brand-muted mt-1 max-w-xs">
                Clique nos dias com vagas abertas no calendário acima para informar suas disponibilidades para este mês.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {myAvailabilitiesThisMonth.map(item => {
                const rawDateStr = format(item.dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR });
                const formattedDateClean = rawDateStr.replace(/-feira/gi, '').replace(/\s+feira/gi, '');

                const typeLabel = item.hasCommon && item.hasParty
                  ? 'CCSP + Festa'
                  : item.hasParty
                    ? (item.config.parties?.[0]?.name ? `Festa (${item.config.parties[0].name})` : 'Festa / Evento')
                    : 'Diária CCSP (Sede)';

                return (
                  <div 
                    key={item.dateStr}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                      item.isMyScheduled 
                        ? "bg-emerald-950/20 border-emerald-500/40 shadow-xs" 
                        : item.isPast
                          ? "bg-brand-bg/40 border-brand-border/40 opacity-70"
                          : item.teamCount > 0
                            ? "bg-brand-bg/70 border-brand-border hover:border-amber-500/40"
                            : "bg-brand-bg/50 border-brand-border/70"
                    )}
                  >
                    {/* Data e Tipo */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black shrink-0 text-xs shadow-inner",
                        item.isMyScheduled 
                          ? "bg-emerald-500 text-slate-950" 
                          : "bg-brand-bg border border-brand-border text-brand-text"
                      )}>
                        <span className="leading-none">{format(item.dateObj, 'dd')}</span>
                        <span className="text-[7px] uppercase tracking-wider leading-none mt-0.5 font-bold">
                          {format(item.dateObj, 'EEE', { locale: ptBR }).substring(0, 3)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-text capitalize truncate">
                          {formattedDateClean}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.2 rounded border",
                            item.hasParty 
                              ? "bg-pink-500/10 text-pink-300 border-pink-500/20" 
                              : "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                          )}>
                            {typeLabel}
                          </span>

                          {!item.isPast && !item.isMyScheduled && (
                            <span className="text-[10px] text-brand-muted flex items-center gap-1 font-medium">
                              <Users size={11} className="shrink-0 text-gray-400" />
                              {item.teamCount === 0 
                                ? 'Nenhum escalado ainda' 
                                : `${item.teamCount} ${item.teamCount === 1 ? 'pessoa escalada' : 'pessoas escaladas'}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status do colaborador nesta data */}
                    <div className="shrink-0 sm:text-right">
                      {item.isMyScheduled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                          <span>Escalado(a) ✓</span>
                        </span>
                      ) : item.isPast ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 px-2 py-0.5 rounded-md bg-gray-800/40 border border-gray-700/50">
                          <span>Data encerrada</span>
                        </span>
                      ) : item.teamCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Clock size={11} className="text-amber-400 shrink-0" />
                          <span>Aguardando finalização</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 px-2 py-0.5 rounded-md bg-brand-bg border border-brand-border">
                          <Clock size={11} className="text-gray-500 shrink-0" />
                          <span>Escala em montagem</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ----------------- COLUNA 2: SUAS ESCALAS CONFIRMADAS ----------------- */}
      <div className="bg-brand-card border border-brand-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header Coluna 2 */}
        <div className="p-3.5 md:p-5 border-b border-brand-border bg-brand-bg/40 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm md:text-base font-black text-brand-text flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary shrink-0"></span>
              <span className="capitalize">Escalas Confirmadas — {format(currentMonth, 'MMMM', { locale: ptBR })}</span>
            </h3>
            <p className="text-[10px] md:text-xs text-brand-muted font-medium mt-0.5">
              Dias em que você foi oficialmente escalado(a) pela gestão
            </p>
          </div>
          <span className={cn(
            "text-xs font-black px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap",
            scheduledDaysThisMonth.length > 0 
              ? "bg-brand-primary/15 text-brand-primary border-brand-primary/30" 
              : "bg-brand-bg text-brand-muted border-brand-border"
          )}>
            {scheduledDaysThisMonth.length} {scheduledDaysThisMonth.length === 1 ? 'dia escalado' : 'dias escalados'}
          </span>
        </div>

        {/* Conteúdo Coluna 2 */}
        <div className="p-4 md:p-5 flex-1 space-y-4">
          {scheduledDaysThisMonth.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {scheduledDaysThisMonth.map((d) => {
                  const dateObj = parseISO(d.date);
                  const isParty = d.type === 'party';
                  const config = getDayConfig(d.date);

                  let partyName = d.partyName;
                  let partyTime = d.shift || config.partyTime;

                  if (isParty) {
                    const matchedParty = d.partyId 
                      ? config.parties?.find(p => p.id === d.partyId) 
                      : config.parties?.find(p => p.name === d.partyName);
                    
                    if (matchedParty) {
                      if (!partyName || partyName === 'Festa') partyName = matchedParty.name;
                      if (matchedParty.time) partyTime = matchedParty.time;
                    } else if (config.parties && config.parties.length > 0) {
                      if (!partyName || partyName === 'Festa') partyName = config.parties[0].name;
                      if (config.parties[0].time) partyTime = config.parties[0].time;
                    }
                  }

                  let dayBase = 0;
                  if (d.isReducedHours && d.customTotalPay !== undefined && d.customTotalPay >= 0) {
                    dayBase = d.customTotalPay;
                  } else if (isParty) {
                    dayBase = d.partyRateAtTime !== undefined ? d.partyRateAtTime : myEmployee.partyRate;
                  } else {
                    dayBase = d.dailyRateAtTime !== undefined ? d.dailyRateAtTime : myEmployee.dailyRate;
                  }
                  if (d.isOvernight && d.overnightPay !== undefined && d.overnightPay > 0) {
                    dayBase += d.overnightPay;
                  }
                  const extraRate = (d.extraHourRateAtTime && d.extraHourRateAtTime > 0) ? d.extraHourRateAtTime : (myEmployee.extraHourRate || 0);
                  const extra = (d.extraHours || 0) * extraRate;
                  const dayTotal = dayBase + extra;
                  const rawDateStr = format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR });
                  const formattedDateClean = rawDateStr.replace(/-feira/gi, '').replace(/\s+feira/gi, '');

                  const isCoordination = isParty && (partyName || '').toLowerCase().includes('coordena');
                  const isOfficeMode = isParty && ((partyName || '').toLowerCase().includes('escritório') || (partyName || '').toLowerCase().includes('escritorio'));
                  const isJanitorMode = isParty && (partyName || '').toLowerCase().includes('zelador');

                  return (
                    <div 
                      key={`${d.date}_${d.type}_${d.partyId || d.id || ''}`}
                      onClick={() => onCancelDate(dateObj)}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none hover:scale-[1.01] duration-150 group gap-3",
                        isOfficeMode
                          ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/45 hover:bg-blue-500/10"
                          : isJanitorMode
                            ? "bg-zinc-500/5 border-zinc-500/20 hover:border-zinc-500/45 hover:bg-zinc-500/10"
                            : d.isReducedHours
                              ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/15"
                              : d.isOvernight
                                ? "bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/15"
                                : isCoordination
                                  ? "bg-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/45 hover:bg-cyan-500/10"
                                  : isParty 
                                    ? "bg-brand-party/5 border-brand-party/20 hover:border-brand-party/45 hover:bg-brand-party/10" 
                                    : "bg-brand-primary/5 border-brand-primary/20 hover:border-brand-primary/45 hover:bg-brand-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-3 animate-in fade-in duration-200 min-w-0">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-md transition-all",
                          isOfficeMode
                            ? "bg-blue-500 text-white group-hover:bg-blue-400"
                            : isJanitorMode
                              ? "bg-zinc-500 text-white group-hover:bg-zinc-400"
                              : d.isReducedHours
                                ? "bg-amber-500 text-slate-950 group-hover:bg-amber-400"
                                : d.isOvernight
                                  ? "bg-indigo-500 text-white group-hover:bg-indigo-400"
                                  : isCoordination
                                    ? "bg-cyan-500 text-slate-950 group-hover:bg-cyan-400"
                                    : isParty 
                                      ? "bg-brand-party text-white group-hover:bg-brand-party" 
                                      : "bg-brand-primary text-slate-900 group-hover:bg-brand-primary-hover"
                        )}>
                          <span className="text-sm leading-none">{format(dateObj, 'dd')}</span>
                          <span className="text-[8px] uppercase tracking-wider leading-none mt-0.5 font-bold">
                            {format(dateObj, 'EEE', { locale: ptBR }).substring(0, 3)}
                          </span>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-brand-text capitalize truncate">
                            {formattedDateClean}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {isOfficeMode ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                                <Briefcase size={10} className="shrink-0 text-blue-400" /> Escritório {d.customHoursText ? `(${d.customHoursText.replace(' (Escritório)', '')})` : ''}
                              </span>
                            ) : isJanitorMode ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-500/20">
                                <Wrench size={10} className="shrink-0 text-zinc-400" /> Zeladoria
                              </span>
                            ) : d.isOvernight ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40 shadow-sm">
                                <Moon size={10} className="text-indigo-300" /> Pernoite ({d.overnightHoursText || '22h às 08h'}) +{formatCurrency(d.overnightPay || 0)}
                              </span>
                            ) : d.isReducedHours ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 shadow-sm">
                                <Clock size={10} className="text-amber-300" /> Horário Reduzido ({d.customHoursText || 'Acordo'})
                              </span>
                            ) : isCoordination ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
                                <ShieldCheck size={10} className="shrink-0 text-cyan-300" /> Coordenação
                              </span>
                            ) : isParty ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-brand-party/10 dark:bg-brand-party/20 text-brand-party dark:text-brand-party px-2 py-0.5 rounded border border-brand-party/20">
                                🎉 {partyName && partyName !== 'Festa' ? `Festa: ${partyName}` : 'Festa'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-brand-primary/10 dark:bg-brand-primary/20 text-amber-700 dark:text-brand-primary px-2 py-0.5 rounded border border-brand-primary/20">
                                Dia CCSP 🏢
                              </span>
                            )}

                            {!!d.extraHours && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                +{d.extraHours}h extra ({formatCurrency(d.extraHours * ((d.extraHourRateAtTime && d.extraHourRateAtTime > 0) ? d.extraHourRateAtTime : (myEmployee.extraHourRate || 0)))})
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {formatCurrency(dayTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-border/30 gap-1 shrink-0">
                        <div className="text-left sm:text-right">
                          <span className="block text-[8px] text-brand-muted font-bold uppercase tracking-wider">Turno / Horário</span>
                          <span className={cn(
                            "inline-block font-black text-[11px] md:text-xs px-2.5 py-1 rounded-lg shadow-sm border",
                            d.isReducedHours
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                              : d.isOvernight
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                : isParty
                                  ? "bg-brand-party/10 dark:bg-brand-party/20 border-brand-party/30 text-brand-party dark:text-brand-party"
                                  : "bg-brand-primary/10 border-brand-primary/20 text-amber-700 dark:text-brand-primary"
                          )}>
                            {d.isReducedHours 
                              ? `Reduzido: ${d.customHoursText || 'Acordado'}` 
                              : d.isOvernight
                                ? `Pernoite: ${d.overnightHoursText || '22h às 08h'}`
                                : isParty ? (partyTime || "A definir") : (d.shift || "CCSP Padrão")}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 group-hover:opacity-100 opacity-0 transition-opacity uppercase tracking-wider">
                          Desistir ✕
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Demonstrativo de Ganhos Estimados */}
              <div className="pt-4 border-t border-brand-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-primary/[0.02] p-4 rounded-xl border border-brand-primary/10">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-brand-text uppercase tracking-wider font-playful">Demonstrativo de Ganhos</h4>
                  <p className="text-[10px] text-brand-muted font-semibold">Valores baseados nas escalas confirmadas</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-brand-muted">
                  <div className="flex flex-col bg-brand-primary/10 border border-brand-primary/20 px-3.5 py-1.5 rounded-xl">
                    <span className="text-[8px] uppercase text-amber-700 dark:text-brand-primary tracking-wider font-black">Total Estimado</span>
                    <span className="text-lg text-amber-700 dark:text-brand-primary font-black leading-none mt-0.5">
                      {formatCurrency(totalEarningsThisMonth)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-brand-border rounded-xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <Calendar size={22} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-text">
                  {myAvailabilitiesThisMonth.length > 0 
                    ? "Você ainda não foi escalado(a) neste mês" 
                    : "Nenhuma escala confirmada"}
                </h4>
                <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto leading-relaxed">
                  {hasDeclaredNoAvail ? (
                    "Você informou que não possui disponibilidade para trabalhar neste mês."
                  ) : myAvailabilitiesThisMonth.length > 0 ? (
                    <>
                      Suas <strong className="text-brand-text">{myAvailabilitiesThisMonth.length} disponibilidades</strong> estão salvas com sucesso (acompanhe na coluna ao lado). Conforme a coordenação for confirmando você nos eventos, os dias escalados e valores aparecerão aqui.
                    </>
                  ) : (
                    "Você ainda não marcou disponibilidades no calendário acima. Clique nos dias disponíveis no calendário para concorrer às vagas das escalas."
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
