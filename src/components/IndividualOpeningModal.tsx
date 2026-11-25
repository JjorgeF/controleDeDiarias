import React, { useEffect, useMemo, useState } from 'react';
import { format, addHours, addDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X,
  Search,
  Clock,
  Check,
  Unlock,
  Lock,
  Users,
  AlertCircle,
  Ban
} from 'lucide-react';
import { Employee } from '../types';
import { cn } from '../lib/utils';

interface IndividualOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentMonth: Date;
  currentMonthKey: string;
  initialSelectedEmployeeIds?: string[];
  initialOpenUntilIso?: string;
  onConfirm: (employeeIds: string[], monthKey: string, openUntilIso: string) => Promise<void> | void;
}

export default function IndividualOpeningModal({
  isOpen,
  onClose,
  employees,
  currentMonth,
  currentMonthKey,
  initialSelectedEmployeeIds = [],
  initialOpenUntilIso,
  onConfirm
}: IndividualOpeningModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [onlyWithoutSubmission, setOnlyWithoutSubmission] = useState(false);

  // Initialize form state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setSelectedIds(initialSelectedEmployeeIds);
    setOnlyWithoutSubmission(false);

    const baseDate = initialOpenUntilIso && !isNaN(new Date(initialOpenUntilIso).getTime()) && isAfter(new Date(initialOpenUntilIso), new Date())
      ? new Date(initialOpenUntilIso)
      : addHours(new Date(), 24);

    setDateInput(format(baseDate, 'yyyy-MM-dd'));
    setTimeInput(format(baseDate, 'HH:mm'));
  }, [isOpen, initialSelectedEmployeeIds, initialOpenUntilIso]);

  const activeEmployees = useMemo(() => {
    return employees
      .filter(emp => emp.status !== 'inactive')
      .map(emp => {
        const avails = emp.availabilities || [];
        const hasDeclaredNoAvail = avails.includes(`no_avail_${currentMonthKey}`);
        const monthAvailDates = new Set(
          avails
            .filter(s => s.startsWith(currentMonthKey) && !s.startsWith('login_') && !s.startsWith('no_avail_'))
            .map(s => s.split('_')[0])
        );
        const opening = emp.individualOpenings?.[currentMonthKey];
        const isOpeningActive = Boolean(
          opening?.openUntil &&
          !isNaN(new Date(opening.openUntil).getTime()) &&
          new Date() <= new Date(opening.openUntil)
        );
        return {
          emp,
          hasDeclaredNoAvail,
          submittedDaysCount: monthAvailDates.size,
          hasNoSubmission: !hasDeclaredNoAvail && monthAvailDates.size === 0,
          isOpeningActive,
          activeUntil: isOpeningActive && opening ? new Date(opening.openUntil) : null
        };
      })
      .sort((a, b) => {
        // Prioriza quem ainda não enviou, depois por nome
        if (a.hasNoSubmission !== b.hasNoSubmission) return a.hasNoSubmission ? -1 : 1;
        return (a.emp.artisticName || a.emp.name).localeCompare(b.emp.artisticName || b.emp.name, 'pt-BR');
      });
  }, [employees, currentMonthKey]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeEmployees.filter(item => {
      if (onlyWithoutSubmission && !item.hasNoSubmission) return false;
      if (!q) return true;
      const name = (item.emp.name || '').toLowerCase();
      const artistic = (item.emp.artisticName || '').toLowerCase();
      const email = (item.emp.email || '').toLowerCase();
      return name.includes(q) || artistic.includes(q) || email.includes(q);
    });
  }, [activeEmployees, searchTerm, onlyWithoutSubmission]);

  if (!isOpen) return null;

  const toggleEmployee = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const applyQuickPreset = (targetDate: Date) => {
    setDateInput(format(targetDate, 'yyyy-MM-dd'));
    setTimeInput(format(targetDate, 'HH:mm'));
  };

  const parsedTargetDate = dateInput && timeInput ? new Date(`${dateInput}T${timeInput}`) : null;
  const isTargetValid = Boolean(parsedTargetDate && !isNaN(parsedTargetDate.getTime()) && isAfter(parsedTargetDate, new Date()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !parsedTargetDate || !isTargetValid) return;
    setIsSaving(true);
    try {
      await onConfirm(selectedIds, currentMonthKey, parsedTargetDate.toISOString());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-brand-card border border-brand-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-brand-text">
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-start justify-between gap-3 bg-brand-bg/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <Unlock size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-brand-text capitalize">
                Liberação Individual • {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Abra o envio de disponibilidades (CCSP e Festas) apenas para pessoas específicas por tempo limitado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text hover:bg-brand-primary/10 p-1.5 rounded-lg transition-all shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Step 1: Time window */}
            <div className="space-y-2.5 bg-brand-bg/50 border border-brand-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-cyan-400" />
                  1. Tempo que ficará aberto
                </label>
                {parsedTargetDate && isTargetValid && (
                  <span className="text-[11px] font-bold text-emerald-400">
                    Fecha em {format(parsedTargetDate, "dd/MM 'às' HH:mm")}
                  </span>
                )}
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+2 horas', getDate: () => addHours(new Date(), 2) },
                  { label: '+6 horas', getDate: () => addHours(new Date(), 6) },
                  { label: '+24 horas', getDate: () => addHours(new Date(), 24) },
                  {
                    label: 'Hoje 23:59',
                    getDate: () => {
                      const d = new Date();
                      d.setHours(23, 59, 0, 0);
                      return d;
                    }
                  },
                  {
                    label: 'Amanhã 23:59',
                    getDate: () => {
                      const d = addDays(new Date(), 1);
                      d.setHours(23, 59, 0, 0);
                      return d;
                    }
                  }
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyQuickPreset(preset.getDate())}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all active:scale-95"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <span className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Data limite</span>
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    required
                    className="w-full bg-brand-card border border-brand-border focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-brand-text focus:outline-none"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Horário limite</span>
                  <input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    required
                    className="w-full bg-brand-card border border-brand-border focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-brand-text focus:outline-none"
                  />
                </div>
              </div>

              {!isTargetValid && dateInput && timeInput && (
                <p className="text-[11px] text-red-400 font-bold flex items-center gap-1.5 pt-1">
                  <AlertCircle size={13} />
                  Defina uma data e horário futuros.
                </p>
              )}
            </div>

            {/* Step 2: Select employees */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-black uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                  <Users size={14} className="text-brand-primary" />
                  2. Selecionar funcionários ({selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'})
                </label>
                <button
                  type="button"
                  onClick={() => setOnlyWithoutSubmission(prev => !prev)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                    onlyWithoutSubmission
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-brand-bg text-brand-muted border-brand-border hover:text-brand-text"
                  )}
                >
                  {onlyWithoutSubmission ? 'Mostrando só quem não enviou' : 'Filtrar só sem envio'}
                </button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="w-full bg-brand-bg border border-brand-border focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text focus:outline-none"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {filteredList.length === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-6">
                    Nenhum funcionário encontrado com esse filtro.
                  </p>
                ) : (
                  filteredList.map(({ emp, hasDeclaredNoAvail, submittedDaysCount, hasNoSubmission, isOpeningActive, activeUntil }) => {
                    const isSelected = selectedIds.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleEmployee(emp.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-all",
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-500/60 ring-1 ring-cyan-500/30"
                            : "bg-brand-bg/40 border-brand-border hover:bg-brand-bg/80"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "bg-cyan-500 border-cyan-400 text-slate-950"
                                : "border-brand-border bg-brand-card text-transparent"
                            )}
                          >
                            <Check size={13} strokeWidth={3.5} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-text truncate">
                              {emp.artisticName || emp.name}
                            </p>
                            {emp.artisticName && emp.name && emp.artisticName !== emp.name && (
                              <p className="text-[10px] text-brand-muted truncate">{emp.name}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {isOpeningActive && activeUntil && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Até {format(activeUntil, 'dd/MM HH:mm')}
                            </span>
                          )}
                          {hasNoSubmission ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Sem envio
                            </span>
                          ) : hasDeclaredNoAvail ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1">
                              <Ban size={10} /> Indisponível
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50">
                              {submittedDaysCount} dia{submittedDaysCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Security/Lock rule notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200/90">
              <Lock size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-300">Regra de proteção automática</p>
                <p>
                  Os selecionados poderão marcar qualquer dia futuro deste mês (CCSP e Festas). Itens que eles já tinham enviado antes permanecem travados e só podem sair via solicitação de cancelamento.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-brand-bg/70 border-t border-brand-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-brand-muted hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || selectedIds.length === 0 || !isTargetValid}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <Unlock size={14} />
              {isSaving
                ? 'Salvando...'
                : `Liberar para ${selectedIds.length} funcionário${selectedIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
