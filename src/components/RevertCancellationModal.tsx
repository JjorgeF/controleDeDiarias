import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  PartyPopper,
  Sparkles,
  ShieldCheck,
  FileText,
  Clock,
  History,
  Check
} from 'lucide-react';
import { Employee, WorkDay } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RevertCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string;
  initialDate?: string;
  onRevertCancellation: (params: {
    employeeId: string;
    dates: string[];
    reason: string;
    mode: 'restore_workday' | 'ignore_penalty_only';
  }) => Promise<{ success: boolean; error?: string }>;
}

const QUICK_REASONS = [
  'Cancelamento acidental pelo colaborador',
  'Falta justificada com atestado médico',
  'Acordo prévio com a coordenação',
  'Troca de plantão / Cobertura de escala',
  'Correção administrativa de sistema'
];

export default function RevertCancellationModal({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  initialDate,
  onRevertCancellation
}: RevertCancellationModalProps) {
  // Active employees list
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'inactive');
  }, [employees]);

  // Selected employee ID
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    initialEmployeeId || (activeEmployees[0]?.id || '')
  );

  // When initialEmployeeId changes and modal opens
  React.useEffect(() => {
    if (initialEmployeeId) {
      setSelectedEmployeeId(initialEmployeeId);
    } else if (!selectedEmployeeId && activeEmployees.length > 0) {
      setSelectedEmployeeId(activeEmployees[0].id);
    }
  }, [initialEmployeeId, isOpen, activeEmployees]);

  const currentEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Filter cancelled days for this employee
  const cancelledDays = useMemo(() => {
    if (!currentEmployee || !currentEmployee.workDays) return [];
    return currentEmployee.workDays.filter(wd => wd.isCancelled && !wd.cancellationIgnored);
  }, [currentEmployee]);

  // History of already reverted days
  const revertedDaysHistory = useMemo(() => {
    if (!currentEmployee || !currentEmployee.workDays) return [];
    return currentEmployee.workDays.filter(wd => wd.revertedAt || wd.cancellationIgnored);
  }, [currentEmployee]);

  // Selected dates to revert
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reversionMode, setReversionMode] = useState<'restore_workday' | 'ignore_penalty_only'>('restore_workday');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize selected dates when modal opens or initialDate is provided
  React.useEffect(() => {
    if (isOpen) {
      if (initialDate && cancelledDays.some(cd => cd.date === initialDate)) {
        setSelectedDates([initialDate]);
      } else if (cancelledDays.length > 0) {
        setSelectedDates([cancelledDays[0].date]);
      } else {
        setSelectedDates([]);
      }
      setReason('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialDate, selectedEmployeeId, cancelledDays.length]);

  if (!isOpen) return null;

  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const selectAllDates = () => {
    setSelectedDates(cancelledDays.map(d => d.date));
  };

  const clearAllDates = () => {
    setSelectedDates([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployeeId) {
      setErrorMessage('Selecione um colaborador.');
      return;
    }

    if (selectedDates.length === 0) {
      setErrorMessage('Selecione ao menos um dia cancelado para reverter.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Por favor, informe o motivo da reversão do cancelamento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onRevertCancellation({
        employeeId: selectedEmployeeId,
        dates: selectedDates,
        reason: reason.trim(),
        mode: reversionMode
      });

      if (res.success) {
        setSuccessMessage(`Cancelamento revertido com sucesso para ${selectedDates.length} dia(s)!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Erro ao reverter cancelamento.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao reverter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col"
      >
        {/* Header (Fixo no topo) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-brand-primary/10 to-emerald-500/15 border-b border-brand-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <RotateCcw size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-brand-text flex items-center gap-2">
                Reverter Cancelamento
              </h2>
              <p className="text-[11px] sm:text-xs text-brand-muted line-clamp-1">
                Anule cancelamentos acidentais e restaure diárias sem penalizar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-xl transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body (Scrollável com flex-1 min-h-0) */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Feedback messages */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs font-bold">
                <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-300 text-xs font-bold">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. Seleção de Colaborador */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-brand-muted mb-1.5">
                1. Colaborador(a)
              </label>
              <div className="relative">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-brand-text focus:outline-none focus:border-brand-primary appearance-none cursor-pointer pr-10 truncate"
                >
                  {activeEmployees.map(emp => {
                    const empCancelledCount = emp.workDays?.filter(d => d.isCancelled && !d.cancellationIgnored).length || 0;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.artisticName || emp.name} ({emp.level}) {empCancelledCount > 0 ? `— ⚠️ ${empCancelledCount} cancelamento(s)` : '— Sem cancelamentos'}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* 2. Seleção de Dias Cancelados */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-brand-muted">
                  2. Selecione o(s) dia(s) ({selectedDates.length} marcado{selectedDates.length !== 1 ? 's' : ''})
                </label>
                {cancelledDays.length > 1 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllDates}
                      className="text-brand-primary hover:underline font-bold"
                    >
                      Todos
                    </button>
                    <span className="text-brand-muted">•</span>
                    <button
                      type="button"
                      onClick={clearAllDates}
                      className="text-brand-muted hover:text-brand-text font-bold"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {cancelledDays.length > 0 ? (
                <div className="grid gap-2 max-h-48 sm:max-h-56 overflow-y-auto pr-1">
                  {cancelledDays.map((wd) => {
                    const isSelected = selectedDates.includes(wd.date);
                    let formattedDate = wd.date;
                    try {
                      formattedDate = format(parseISO(wd.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                      formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
                    } catch {}

                    let cancelTimeFormatted = '';
                    if (wd.cancelledAt) {
                      try {
                        cancelTimeFormatted = format(parseISO(wd.cancelledAt), "dd/MM 'às' HH:mm", { locale: ptBR });
                      } catch {}
                    }

                    return (
                      <div
                        key={wd.date}
                        onClick={() => toggleDateSelection(wd.date)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                            : 'bg-brand-bg/60 border-brand-border hover:bg-brand-bg'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-amber-500 border-amber-500 text-slate-950 font-black'
                                : 'border-brand-border bg-brand-bg'
                            }`}
                          >
                            {isSelected && <Check size={12} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-brand-text">
                                {formattedDate}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                  wd.type === 'party'
                                    ? 'bg-brand-party/15 text-brand-party border border-brand-party/30'
                                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                }`}
                              >
                                {wd.type === 'party' ? 'Festa 🥳' : 'CCSP'}
                              </span>
                            </div>
                            {cancelTimeFormatted && (
                              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock size={10} /> Cancelado em: {cancelTimeFormatted}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-amber-400 shrink-0">
                          {isSelected ? '✓ Marcado' : 'Marcar'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-brand-bg/40 border border-brand-border rounded-xl text-center">
                  <ShieldCheck size={24} className="mx-auto text-emerald-400 mb-1.5 opacity-80" />
                  <p className="text-xs font-bold text-brand-text">
                    Nenhum cancelamento ativo para este colaborador!
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Selecione outro colaborador no campo acima para reverter.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Ação da Reversão */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-brand-muted mb-1.5">
                3. Como deseja tratar este cancelamento?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Opção A: Restaurar Diária como Trabalhada */}
                <div
                  onClick={() => setReversionMode('restore_workday')}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    reversionMode === 'restore_workday'
                      ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-brand-bg/40 border-brand-border hover:bg-brand-bg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] sm:text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles size={13} />
                        Restaurar Diária
                      </span>
                      <input
                        type="radio"
                        name="reversionMode"
                        checked={reversionMode === 'restore_workday'}
                        onChange={() => setReversionMode('restore_workday')}
                        className="text-emerald-500 focus:ring-0"
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-300 font-medium leading-relaxed">
                      Reativa a diária como <strong>trabalhada</strong>, soma aos ganhos e elimina a falta.
                    </p>
                  </div>
                </div>

                {/* Opção B: Apenas Anular Falta */}
                <div
                  onClick={() => setReversionMode('ignore_penalty_only')}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    reversionMode === 'ignore_penalty_only'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'bg-brand-bg/40 border-brand-border hover:bg-brand-bg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] sm:text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <ShieldCheck size={13} />
                        Apenas Anular Penalidade
                      </span>
                      <input
                        type="radio"
                        name="reversionMode"
                        checked={reversionMode === 'ignore_penalty_only'}
                        onChange={() => setReversionMode('ignore_penalty_only')}
                        className="text-amber-500 focus:ring-0"
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-300 font-medium leading-relaxed">
                      Mantém sem diária, mas <strong>desconsidera o cancelamento</strong> no histórico.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Motivo da Reversão */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-brand-muted mb-1.5">
                4. Motivo / Justificativa da Reversão <span className="text-rose-400">*</span>
              </label>
              
              {/* Quick reason suggestions */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_REASONS.map((qReason) => (
                  <button
                    key={qReason}
                    type="button"
                    onClick={() => setReason(qReason)}
                    className={`text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                      reason === qReason
                        ? 'bg-brand-primary text-slate-900 border-brand-primary font-bold'
                        : 'bg-brand-bg border-brand-border text-gray-300 hover:text-brand-text hover:border-brand-primary/40'
                    }`}
                  >
                    + {qReason}
                  </button>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo da anulação do cancelamento..."
                rows={2}
                className="w-full bg-brand-bg border border-brand-border rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm text-brand-text placeholder-gray-500 focus:outline-none focus:border-brand-primary resize-none"
                required
              />
            </div>

            {/* 5. Histórico de Reversões Anteriores */}
            {revertedDaysHistory.length > 0 && (
              <div className="pt-2.5 border-t border-brand-border/60">
                <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-brand-muted mb-1.5 flex items-center gap-1.5">
                  <History size={12} />
                  Histórico de Reversões Passadas ({revertedDaysHistory.length})
                </h4>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {revertedDaysHistory.map((rh, idx) => {
                    let dateStr = rh.date;
                    try {
                      dateStr = format(parseISO(rh.date), "dd/MM/yyyy", { locale: ptBR });
                    } catch {}

                    let revDateStr = '';
                    if (rh.revertedAt) {
                      try {
                        revDateStr = format(parseISO(rh.revertedAt), "dd/MM 'às' HH:mm", { locale: ptBR });
                      } catch {}
                    }

                    return (
                      <div key={`hist-${idx}`} className="p-2 bg-brand-bg/30 border border-brand-border/60 rounded-lg text-xs flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-brand-text text-[11px]">Dia {dateStr}</span>
                          {rh.reversionReason && (
                            <p className="text-[10px] text-gray-400 italic">"{rh.reversionReason}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Revertido {revDateStr ? revDateStr : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons (Fixo na base com safe-padding) */}
          <div className="p-3 sm:p-4 bg-brand-card/95 backdrop-blur-md border-t border-brand-border flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-gray-400 hover:text-brand-text hover:bg-brand-bg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedDates.length === 0}
              className="px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-amber-500 to-brand-primary text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <RotateCcw size={15} className={isSubmitting ? "animate-spin" : ""} />
              <span>{isSubmitting ? 'Revertendo...' : `Reverter (${selectedDates.length})`}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
