import React, { useMemo, useState, useEffect } from 'react';
import {
  Building2,
  PartyPopper,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  ShieldCheck,
  TrendingUp,
  ChevronsUpDown,
  FileText
} from 'lucide-react';
import { format, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Employee, EmployeeLevel, WorkDay } from '../types';
import {
  cn,
  formatCurrency,
  getCcspCycleAndDueDate,
  getPartyPaymentDueDate,
  getWorkDayPayBreakdown,
  getWorkDayLevel,
  isCcspWorkDayPaid,
  isPartyWorkDayPaid,
  computeCcspBatchStatus
} from '../lib/utils';

interface PaymentAuditViewProps {
  employees: Employee[];
  currentMonth: Date;
  typeFilter: 'all' | 'ccsp' | 'parties';
  statusFilter: 'all' | 'pending' | 'paid';
  groupFilter: 'all' | 'general' | 'management';
  searchQuery: string;
  focusedEmployeeId?: string | null;
  onClearFocus?: () => void;
}

type AuditScopeMode = 'batch' | 'worked';

interface AuditRowItem {
  key: string;
  workDay: WorkDay;
  dateFormatted: string;
  dayOfWeekShort: string;
  isParty: boolean;
  level: EmployeeLevel;
  activityLabel: string;
  modalityLabel: string;
  baseRate: number;
  overnightPay: number;
  extraHours: number;
  extraPay: number;
  totalAmount: number;
  dueDateFormatted: string;
  dueDateStr: string;
  isPaid: boolean;
  isMonthTurnBridge: boolean;
  isPulledFromNextMonth: boolean;
  isManualAssignment: boolean;
  hasSameDayOtherWork: boolean;
}

interface LevelBreakdownItem {
  level: EmployeeLevel;
  count: number;
  ccspCount: number;
  partyCount: number;
  total: number;
  paid: number;
  pending: number;
}

interface PersonAuditSummary {
  employee: Employee;
  rows: AuditRowItem[];
  levelBreakdown: LevelBreakdownItem[];
  hasLevelChange: boolean;
  ccspCount: number;
  partyCount: number;
  ccspTotal: number;
  partyTotal: number;
  extraHoursTotal: number;
  extraPayTotal: number;
  grandTotal: number;
  paidTotal: number;
  pendingTotal: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  hasBridgeDays: boolean;
  batchPartialNote?: string;
}

const LEVEL_ORDER: EmployeeLevel[] = [
  'Trainee',
  'Aprendiz',
  'Recreador(a)',
  'Recreador(a) Experiente',
  'Coordenador(a)',
  'Motorista'
];

const LEVEL_BADGE_STYLES: Record<EmployeeLevel, string> = {
  'Trainee': 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'Aprendiz': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Recreador(a)': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Recreador(a) Experiente': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Coordenador(a)': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'Motorista': 'bg-blue-500/15 text-blue-300 border-blue-500/30'
};

export default function PaymentAuditView({
  employees,
  currentMonth,
  typeFilter,
  statusFilter,
  groupFilter,
  searchQuery,
  focusedEmployeeId,
  onClearFocus
}: PaymentAuditViewProps) {
  const [scopeMode, setScopeMode] = useState<AuditScopeMode>('batch');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedEmpId, setCopiedEmpId] = useState<string | null>(null);

  const currentMonthCcspKey = format(currentMonth, 'yyyy-MM-15');
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Auto-expand focused employee when navigating from "Detalhar Dias"
  useEffect(() => {
    if (focusedEmployeeId) {
      setExpandedIds(prev => ({ ...prev, [focusedEmployeeId]: true }));
      const el = document.getElementById(`audit-person-${focusedEmployeeId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedEmployeeId]);

  const personSummaries = useMemo(() => {
    const activeEmps = employees.filter(e => e.status !== 'inactive');
    const results: PersonAuditSummary[] = [];

    activeEmps.forEach(emp => {
      if (groupFilter === 'general' && emp.paymentGroup === 'management') return;
      if (groupFilter === 'management' && emp.paymentGroup !== 'management') return;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesArtistic = emp.artisticName.toLowerCase().includes(q);
        const matchesPix = (emp.pixKey || '').toLowerCase().includes(q);
        if (!matchesName && !matchesArtistic && !matchesPix) return;
      }

      const isManagement = emp.paymentGroup === 'management';
      const activeWorkDays = (emp.workDays || []).filter(wd => !wd.isCancelled && wd.date);
      const rows: AuditRowItem[] = [];

      activeWorkDays.forEach((wd, idx) => {
        if (typeFilter === 'ccsp' && wd.type !== 'common') return;
        if (typeFilter === 'parties' && wd.type !== 'party') return;

        try {
          const dateObj = parseISO(wd.date.includes('T') ? wd.date : `${wd.date}T12:00:00`);
          const isParty = wd.type === 'party';

          let dueDateStr = '';
          let dueDateFormatted = '';
          let isMonthTurnBridge = false;
          let isPulledFromNextMonth = false;
          let matchesScope = false;

          if (isParty) {
            const forecastDate = getPartyPaymentDueDate(dateObj, isManagement);
            dueDateStr = format(forecastDate, 'yyyy-MM-dd');
            dueDateFormatted = format(forecastDate, 'dd/MM/yyyy');
            matchesScope = scopeMode === 'batch'
              ? isSameMonth(forecastDate, currentMonth)
              : isSameMonth(dateObj, currentMonth);
          } else {
            const cycleInfo = getCcspCycleAndDueDate(dateObj);
            dueDateStr = cycleInfo.dueDateStr;
            dueDateFormatted = cycleInfo.dueDateFormatted;
            isMonthTurnBridge = cycleInfo.isMonthTurnBridge;
            isPulledFromNextMonth = cycleInfo.isPulledFromNextMonth;
            matchesScope = scopeMode === 'batch'
              ? cycleInfo.dueDateStr === currentMonthCcspKey
              : isSameMonth(dateObj, currentMonth);
          }

          if (!matchesScope) return;

          const isPaid = isParty
            ? isPartyWorkDayPaid(wd, emp)
            : isCcspWorkDayPaid(wd, emp);

          const breakdown = getWorkDayPayBreakdown(wd, emp);
          const resolvedLevel = getWorkDayLevel(wd, emp);
          const dayOfWeekRaw = format(dateObj, 'EEE', { locale: ptBR }).replace('.', '');
          const dayOfWeekShort = dayOfWeekRaw.charAt(0).toUpperCase() + dayOfWeekRaw.slice(1);

          let modalityLabel = wd.shift || (isParty ? 'Horário padrão' : 'CCSP Padrão');
          if (wd.isReducedHours) {
            modalityLabel = `Reduzido (${wd.customHoursText || 'Acordo'})`;
          } else if (wd.isOvernight) {
            modalityLabel = `Pernoite (${wd.overnightHoursText || '22h às 08h'})`;
          }

          const hasSameDayOtherWork = activeWorkDays.some(
            other => other !== wd && other.date === wd.date
          );

          rows.push({
            key: `${wd.date}_${wd.type}_${wd.partyId || wd.id || idx}_${idx}`,
            workDay: wd,
            dateFormatted: format(dateObj, 'dd/MM/yyyy'),
            dayOfWeekShort,
            isParty,
            level: resolvedLevel,
            activityLabel: isParty ? (wd.partyName || 'Festa / Evento') : 'Diária CCSP',
            modalityLabel,
            baseRate: breakdown.baseRate,
            overnightPay: breakdown.overnightPay,
            extraHours: breakdown.extraHours,
            extraPay: breakdown.extraPay,
            totalAmount: breakdown.total,
            dueDateFormatted,
            dueDateStr,
            isPaid,
            isMonthTurnBridge,
            isPulledFromNextMonth,
            isManualAssignment: !!wd.isManualAssignment,
            hasSameDayOtherWork
          });
        } catch {
          // Ignora registros com data inválida
        }
      });

      if (rows.length === 0) return;

      rows.sort((a, b) => {
        const cmp = a.workDay.date.localeCompare(b.workDay.date);
        if (cmp !== 0) return cmp;
        return a.isParty === b.isParty ? 0 : a.isParty ? 1 : -1;
      });

      const ccspRows = rows.filter(r => !r.isParty);
      const partyRows = rows.filter(r => r.isParty);

      const ccspTotal = Number(ccspRows.reduce((acc, r) => acc + r.totalAmount, 0).toFixed(2));
      const partyTotal = Number(partyRows.reduce((acc, r) => acc + r.totalAmount, 0).toFixed(2));
      const extraHoursTotal = Number(rows.reduce((acc, r) => acc + r.extraHours, 0).toFixed(2));
      const extraPayTotal = Number(rows.reduce((acc, r) => acc + r.extraPay, 0).toFixed(2));
      const grandTotal = Number((ccspTotal + partyTotal).toFixed(2));

      const paidTotal = Number(rows.reduce((acc, r) => acc + (r.isPaid ? r.totalAmount : 0), 0).toFixed(2));
      const pendingTotal = Math.max(0, Number((grandTotal - paidTotal).toFixed(2)));
      const isFullyPaid = pendingTotal <= 0.009;
      const isPartiallyPaid = paidTotal > 0 && pendingTotal > 0.009;
      const hasBridgeDays = rows.some(r => r.isMonthTurnBridge);

      if (statusFilter === 'pending' && isFullyPaid) return;
      if (statusFilter === 'paid' && !isFullyPaid) return;

      let batchPartialNote: string | undefined;
      if (scopeMode === 'batch' && typeFilter !== 'parties') {
        const batchStatus = computeCcspBatchStatus(emp, currentMonthCcspKey);
        if (batchStatus.isPartiallyPaid || batchStatus.hasPaidFlagWithPendingBalance) {
          const pendingDates = batchStatus.unpaidDays.map(d => {
            try {
              return format(parseISO(d.date), 'dd/MM');
            } catch {
              return d.date;
            }
          });
          batchPartialNote = `Lote CCSP ${format(currentMonth, '15/MM')}: Já quitado ${formatCurrency(batchStatus.alreadyPaidAmount)} · Saldo em aberto: ${formatCurrency(batchStatus.remainingAmount)}${pendingDates.length > 0 ? ` (${pendingDates.join(', ')})` : ''}`;
        }
      }

      const levelMap = new Map<EmployeeLevel, LevelBreakdownItem>();
      rows.forEach(r => {
        const existing = levelMap.get(r.level) || {
          level: r.level,
          count: 0,
          ccspCount: 0,
          partyCount: 0,
          total: 0,
          paid: 0,
          pending: 0
        };
        existing.count += 1;
        if (r.isParty) {
          existing.partyCount += 1;
        } else {
          existing.ccspCount += 1;
        }
        existing.total = Number((existing.total + r.totalAmount).toFixed(2));
        if (r.isPaid) {
          existing.paid = Number((existing.paid + r.totalAmount).toFixed(2));
        } else {
          existing.pending = Number((existing.pending + r.totalAmount).toFixed(2));
        }
        levelMap.set(r.level, existing);
      });

      const levelBreakdown = Array.from(levelMap.values()).sort((a, b) => {
        const idxA = LEVEL_ORDER.indexOf(a.level);
        const idxB = LEVEL_ORDER.indexOf(b.level);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
      const hasLevelChange = levelBreakdown.length > 1;

      results.push({
        employee: emp,
        rows,
        levelBreakdown,
        hasLevelChange,
        ccspCount: ccspRows.length,
        partyCount: partyRows.length,
        ccspTotal,
        partyTotal,
        extraHoursTotal,
        extraPayTotal,
        grandTotal,
        paidTotal,
        pendingTotal,
        isFullyPaid,
        isPartiallyPaid,
        hasBridgeDays,
        batchPartialNote
      });
    });

    return results.sort((a, b) => a.employee.artisticName.localeCompare(b.employee.artisticName));
  }, [employees, currentMonth, currentMonthCcspKey, scopeMode, typeFilter, statusFilter, groupFilter, searchQuery]);

  const allExpanded = personSummaries.length > 0 && personSummaries.every(p => expandedIds[p.employee.id]);

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedIds({});
    } else {
      const next: Record<string, boolean> = {};
      personSummaries.forEach(p => {
        next[p.employee.id] = true;
      });
      setExpandedIds(next);
    }
  };

  const togglePerson = (empId: string) => {
    setExpandedIds(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  const handleCopyStatement = (summary: PersonAuditSummary) => {
    const scopeTitle = scopeMode === 'batch' ? `Lote ${capitalizedMonth}` : `Trabalhado em ${capitalizedMonth}`;
    const lines = [
      `*Conferência — ${summary.employee.artisticName} (${summary.employee.name})*`,
      `Referência: ${scopeTitle}`,
      ''
    ];

    summary.rows.forEach(r => {
      const extraText = r.extraHours > 0 ? ` + ${r.extraHours}h extra (${formatCurrency(r.extraPay)})` : '';
      const statusText = r.isPaid ? 'Pago ✓' : `Pendente (Venc. ${r.dueDateFormatted.slice(0, 5)})`;
      lines.push(
        `${r.dateFormatted} (${r.dayOfWeekShort}): ${r.activityLabel} [${r.level}]${extraText} — ${formatCurrency(r.totalAmount)} [${statusText}]`
      );
    });

    lines.push('');
    if (summary.levelBreakdown.length > 0) {
      lines.push('Resumo por nível:');
      summary.levelBreakdown.forEach(lb => {
        lines.push(
          `• ${lb.level} (${lb.count}x): ${formatCurrency(lb.total)} (Pago: ${formatCurrency(lb.paid)} | Falta: ${formatCurrency(lb.pending)})`
        );
      });
      lines.push('');
    }
    if (summary.ccspCount > 0) lines.push(`CCSP (${summary.ccspCount}): ${formatCurrency(summary.ccspTotal)}`);
    if (summary.partyCount > 0) lines.push(`Festas (${summary.partyCount}): ${formatCurrency(summary.partyTotal)}`);
    if (summary.extraHoursTotal > 0) lines.push(`Horas Extras (${summary.extraHoursTotal}h): ${formatCurrency(summary.extraPayTotal)}`);
    lines.push(`TOTAL: ${formatCurrency(summary.grandTotal)}`);
    lines.push(`Já Pago: ${formatCurrency(summary.paidTotal)}`);
    lines.push(`Falta Pagar: ${formatCurrency(summary.pendingTotal)}`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedEmpId(summary.employee.id);
    setTimeout(() => setCopiedEmpId(null), 2500);
  };

  const auditTotals = useMemo(() => {
    return personSummaries.reduce(
      (acc, p) => ({
        grand: Number((acc.grand + p.grandTotal).toFixed(2)),
        paid: Number((acc.paid + p.paidTotal).toFixed(2)),
        pending: Number((acc.pending + p.pendingTotal).toFixed(2)),
        days: acc.days + p.rows.length
      }),
      { grand: 0, paid: 0, pending: 0, days: 0 }
    );
  }, [personSummaries]);

  return (
    <div className="space-y-4">
      {/* Barra de Controles da Conferência */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Alternador de Critério: Lote vs Mês Trabalhado */}
          <div className="flex items-center bg-brand-bg/80 border border-brand-border rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setScopeMode('batch')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap",
                scopeMode === 'batch'
                  ? "bg-brand-primary text-slate-950 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
              title="Mostra CCSP com vencimento dia 15 deste mês e festas pagas neste mês"
            >
              <Calendar size={13} />
              <span>Por Lote de Pagamento ({format(currentMonth, 'MM/yyyy')})</span>
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('worked')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap",
                scopeMode === 'worked'
                  ? "bg-brand-primary text-slate-950 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
              title="Mostra todos os dias fisicamente trabalhados dentro do mês civil selecionado"
            >
              <FileText size={13} />
              <span>Por Mês Trabalhado ({format(currentMonth, 'MM/yyyy')})</span>
            </button>
          </div>

          {focusedEmployeeId && onClearFocus && (
            <button
              type="button"
              onClick={onClearFocus}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Limpar destaque
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
          <div className="text-[11px] text-brand-muted font-semibold tabular-nums flex items-center gap-2">
            <span>{personSummaries.length} {personSummaries.length === 1 ? 'pessoa' : 'pessoas'}</span>
            <span aria-hidden="true">·</span>
            <span>{auditTotals.days} {auditTotals.days === 1 ? 'escala' : 'escalas'}</span>
            <span aria-hidden="true">·</span>
            <span>Falta: <strong className="text-amber-400">{formatCurrency(auditTotals.pending)}</strong></span>
          </div>

          {personSummaries.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-bg border border-brand-border text-brand-text hover:border-brand-primary/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <ChevronsUpDown size={14} />
              <span>{allExpanded ? 'Recolher Todos' : 'Expandir Todos'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista Pessoa por Pessoa */}
      {personSummaries.length === 0 ? (
        <div className="bg-brand-card/60 border border-brand-border rounded-2xl p-8 text-center text-brand-muted">
          <p className="text-sm font-medium">
            Nenhum registro encontrado para conferência com os filtros selecionados em {capitalizedMonth}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {personSummaries.map(summary => {
            const emp = summary.employee;
            const isExpanded = !!expandedIds[emp.id];
            const isFocused = focusedEmployeeId === emp.id;

            return (
              <div
                key={emp.id}
                id={`audit-person-${emp.id}`}
                className={cn(
                  "rounded-2xl border bg-brand-card transition-colors overflow-hidden",
                  isFocused
                    ? "border-brand-primary/70 ring-1 ring-brand-primary/30"
                    : summary.isPartiallyPaid
                      ? "border-amber-500/40"
                      : "border-brand-border"
                )}
              >
                {/* Linha Resumo da Pessoa */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => togglePerson(emp.id)}
                    className="flex items-start sm:items-center gap-3 text-left min-w-0 flex-1 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center overflow-hidden shrink-0">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-brand-primary">
                          {emp.artisticName?.slice(0, 2).toUpperCase() || 'LP'}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-sm sm:text-base text-brand-text group-hover:text-brand-primary transition-colors">
                          {emp.artisticName}
                        </h4>
                        <span className="text-[11px] text-brand-muted truncate">
                          {emp.name}
                        </span>
                        {!summary.hasLevelChange && summary.levelBreakdown[0] && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 whitespace-nowrap",
                            LEVEL_BADGE_STYLES[summary.levelBreakdown[0].level] || LEVEL_BADGE_STYLES['Trainee']
                          )}>
                            {summary.levelBreakdown[0].level}
                          </span>
                        )}
                        {summary.hasLevelChange && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 inline-flex items-center gap-1 whitespace-nowrap">
                            <TrendingUp size={10} /> Subiu de nível ({summary.levelBreakdown.length})
                          </span>
                        )}
                        {emp.paymentGroup === 'management' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 inline-flex items-center gap-1">
                            <ShieldCheck size={10} /> Gestão
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap",
                          summary.isFullyPaid
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : summary.isPartiallyPaid
                              ? "bg-amber-500/25 text-amber-200 border border-amber-400/50"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        )}>
                          {summary.isFullyPaid ? <CheckCircle2 size={10} /> : summary.isPartiallyPaid ? <AlertCircle size={10} /> : <Clock size={10} />}
                          {summary.isFullyPaid ? 'Quitado' : summary.isPartiallyPaid ? 'Pago Parcial' : 'Pendente'}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                        <span className="text-brand-primary font-semibold">{summary.ccspCount} CCSP ({formatCurrency(summary.ccspTotal)})</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-pink-300 font-semibold">{summary.partyCount} {summary.partyCount === 1 ? 'Festa' : 'Festas'} ({formatCurrency(summary.partyTotal)})</span>
                        {summary.extraHoursTotal > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-semibold">+{summary.extraHoursTotal}h extra ({formatCurrency(summary.extraPayTotal)})</span>
                          </>
                        )}
                        {summary.hasBridgeDays && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-cyan-300 font-semibold">Inclui virada/feriado</span>
                          </>
                        )}
                      </div>

                      {summary.hasLevelChange && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                          {summary.levelBreakdown.map(lb => (
                            <span
                              key={lb.level}
                              className={cn(
                                "px-2 py-0.5 rounded-md border font-semibold inline-flex items-center gap-1",
                                LEVEL_BADGE_STYLES[lb.level] || LEVEL_BADGE_STYLES['Trainee']
                              )}
                            >
                              <span>{lb.level}:</span>
                              <span>{lb.count}x</span>
                              <span className="opacity-75">({formatCurrency(lb.total)})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Totais Financeiros + Ações */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 sm:gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-brand-border/40">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 text-right tabular-nums">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-brand-muted block">Total</span>
                        <span className="text-xs sm:text-sm font-black text-brand-text">{formatCurrency(summary.grandTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-emerald-400 block">Já Pago</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-400">{formatCurrency(summary.paidTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-amber-400 block">Falta</span>
                        <span className={cn(
                          "text-xs sm:text-sm font-black",
                          summary.pendingTotal > 0 ? "text-amber-400" : "text-gray-500"
                        )}>
                          {formatCurrency(summary.pendingTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyStatement(summary)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap",
                          copiedEmpId === emp.id
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : "bg-brand-bg border-brand-border text-gray-300 hover:text-white hover:border-brand-primary/40"
                        )}
                        title="Copiar extrato detalhado linha a linha para WhatsApp"
                      >
                        {copiedEmpId === emp.id ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedEmpId === emp.id ? 'Copiado!' : 'Copiar Extrato'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePerson(emp.id)}
                        className="p-2 rounded-xl bg-brand-bg border border-brand-border text-gray-300 hover:text-white hover:border-brand-primary/40 transition-colors"
                        aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detalhamento Cronológico Dia a Dia */}
                {isExpanded && (
                  <div className="border-t border-brand-border/70 bg-brand-bg/40 p-3 sm:p-4 space-y-3">
                    {summary.batchPartialNote && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2 text-xs text-amber-200">
                        <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <span>{summary.batchPartialNote}</span>
                      </div>
                    )}

                    {/* Resumo por Nível no Período */}
                    {summary.levelBreakdown.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-brand-muted px-0.5">
                          <span>Valores por Nível no Período</span>
                          {summary.hasLevelChange && (
                            <span className="text-cyan-300">Evolução de nível detectada</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 tabular-nums">
                          {summary.levelBreakdown.map(lb => (
                            <div
                              key={lb.level}
                              className="rounded-xl border border-brand-border/80 bg-brand-card/70 px-3 py-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block",
                                  LEVEL_BADGE_STYLES[lb.level] || LEVEL_BADGE_STYLES['Trainee']
                                )}>
                                  {lb.level}
                                </span>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {lb.ccspCount > 0 ? `${lb.ccspCount} CCSP` : ''}
                                  {lb.ccspCount > 0 && lb.partyCount > 0 ? ' · ' : ''}
                                  {lb.partyCount > 0 ? `${lb.partyCount} ${lb.partyCount === 1 ? 'Festa' : 'Festas'}` : ''}
                                  <span className="text-gray-500"> ({lb.count} {lb.count === 1 ? 'dia' : 'dias'})</span>
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs sm:text-sm font-black text-brand-text">
                                  {formatCurrency(lb.total)}
                                </div>
                                <div className="text-[10px] font-semibold space-x-2">
                                  <span className="text-emerald-400">Pago {formatCurrency(lb.paid)}</span>
                                  {lb.pending > 0 && (
                                    <span className="text-amber-400">Falta {formatCurrency(lb.pending)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabela Desktop */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-brand-border/70">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-brand-bg/90 border-b border-brand-border text-[10px] uppercase tracking-wider text-brand-muted">
                            <th className="py-2.5 px-3 font-bold">Data</th>
                            <th className="py-2.5 px-3 font-bold">Tipo / Atividade</th>
                            <th className="py-2.5 px-3 font-bold">Nível</th>
                            <th className="py-2.5 px-3 font-bold">Turno / Modalidade</th>
                            <th className="py-2.5 px-3 font-bold text-right">Base</th>
                            <th className="py-2.5 px-3 font-bold text-right">Hora Extra</th>
                            <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                            <th className="py-2.5 px-3 font-bold">Vencimento</th>
                            <th className="py-2.5 px-3 font-bold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/50">
                          {summary.rows.map(row => (
                            <tr key={row.key} className="hover:bg-brand-card/50 transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                                <div className="font-bold text-brand-text">
                                  {row.dateFormatted} <span className="text-gray-400 font-normal">({row.dayOfWeekShort})</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-0.5 text-[10px]">
                                  {row.isMonthTurnBridge && (
                                    <span className="text-cyan-300 font-semibold">
                                      Virada/Feriado
                                    </span>
                                  )}
                                  {row.isManualAssignment && (
                                    <span className="text-amber-300 font-semibold">
                                      Escala Manual
                                    </span>
                                  )}
                                  {row.hasSameDayOtherWork && (
                                    <span className="text-purple-300 font-semibold">
                                      Dupla Escala
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 font-semibold text-brand-text">
                                  {row.isParty ? (
                                    <PartyPopper size={13} className="text-pink-400 shrink-0" />
                                  ) : (
                                    <Building2 size={13} className="text-brand-primary shrink-0" />
                                  )}
                                  <span>{row.activityLabel}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block",
                                  LEVEL_BADGE_STYLES[row.level] || LEVEL_BADGE_STYLES['Trainee']
                                )}>
                                  {row.level}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-gray-300">
                                {row.modalityLabel}
                              </td>

                              <td className="py-2.5 px-3 text-right tabular-nums text-gray-200 whitespace-nowrap">
                                {formatCurrency(row.baseRate)}
                                {row.overnightPay > 0 && (
                                  <span className="block text-[10px] text-indigo-300">
                                    +{formatCurrency(row.overnightPay)} pernoite
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                                {row.extraHours > 0 ? (
                                  <span className="text-amber-300 font-bold">
                                    +{row.extraHours}h ({formatCurrency(row.extraPay)})
                                  </span>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right tabular-nums font-black text-brand-text whitespace-nowrap">
                                {formatCurrency(row.totalAmount)}
                              </td>

                              <td className="py-2.5 px-3 tabular-nums text-gray-300 whitespace-nowrap">
                                {row.dueDateFormatted}
                              </td>

                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {row.isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300">
                                    <CheckCircle2 size={12} /> Pago
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-300">
                                    <Clock size={12} /> Pendente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Lista Mobile */}
                    <div className="md:hidden space-y-2">
                      {summary.rows.map(row => (
                        <div key={row.key} className="rounded-xl border border-brand-border/70 bg-brand-card/70 p-3 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-brand-text tabular-nums">
                                  {row.dateFormatted} ({row.dayOfWeekShort})
                                </span>
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                                  LEVEL_BADGE_STYLES[row.level] || LEVEL_BADGE_STYLES['Trainee']
                                )}>
                                  {row.level}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 font-semibold text-gray-200 mt-0.5">
                                {row.isParty ? (
                                  <PartyPopper size={12} className="text-pink-400 shrink-0" />
                                ) : (
                                  <Building2 size={12} className="text-brand-primary shrink-0" />
                                )}
                                <span>{row.activityLabel}</span>
                              </div>
                            </div>
                            {row.isPaid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300 shrink-0">
                                <CheckCircle2 size={12} /> Pago
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-300 shrink-0">
                                <Clock size={12} /> Pendente
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 pt-1.5 border-t border-brand-border/40 tabular-nums">
                            <span>Base: <strong className="text-gray-200">{formatCurrency(row.baseRate + row.overnightPay)}</strong></span>
                            <span>Extra: <strong className={row.extraHours > 0 ? 'text-amber-300' : 'text-gray-500'}>{row.extraHours > 0 ? `+${row.extraHours}h (${formatCurrency(row.extraPay)})` : '—'}</strong></span>
                            <span>Venc.: <strong className="text-gray-200">{row.dueDateFormatted.slice(0, 5)}</strong></span>
                            <span>Total: <strong className="text-brand-text">{formatCurrency(row.totalAmount)}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
