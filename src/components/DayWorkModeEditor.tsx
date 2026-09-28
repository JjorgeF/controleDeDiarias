import React, { useState, useEffect } from 'react';
import { Clock, Moon, Check, RotateCcw, AlertCircle, ShieldAlert } from 'lucide-react';
import { Employee, WorkDay } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { removeUndefinedFields } from '../lib/firebase';

interface DayWorkModeEditorProps {
  employee: Employee;
  selectedDayStr: string;
  onUpdateDays: (employeeId: string, days: WorkDay[]) => void | Promise<void>;
  onClose?: () => void;
  isAdmin?: boolean;
  isReadOnly?: boolean;
}

export default function DayWorkModeEditor({
  employee,
  selectedDayStr,
  onUpdateDays,
  onClose,
  isAdmin = true,
  isReadOnly = false,
}: DayWorkModeEditorProps) {
  const canEdit = isAdmin && !isReadOnly;

  // Find the employee's work day on this date
  const dayData = employee.workDays.find(d => d.date === selectedDayStr && !d.isCancelled);

  // Compute saved values from the database
  const savedMode: 'normal' | 'reduced' | 'overnight' = 
    dayData?.isOvernight ? 'overnight' : 
    dayData?.isReducedHours ? 'reduced' : 'normal';

  const savedCustomHours = dayData?.customHoursText || '01h30m';
  const savedCustomPay = dayData?.customTotalPay !== undefined ? dayData.customTotalPay : 45.0;
  const savedOvernightHours = dayData?.overnightHoursText || '22h às 08h';
  const savedOvernightPay = dayData?.overnightPay !== undefined ? dayData.overnightPay : 150.0;
  const savedExtraHours = dayData?.extraHours || 0;

  // Local draft state for editing before committing to Firestore
  const [selectedMode, setSelectedMode] = useState<'normal' | 'reduced' | 'overnight'>(savedMode);
  const [customHoursText, setCustomHoursText] = useState<string>(savedCustomHours);
  const [customTotalPay, setCustomTotalPay] = useState<number | string>(savedCustomPay);
  const [overnightHoursText, setOvernightHoursText] = useState<string>(savedOvernightHours);
  const [overnightPay, setOvernightPay] = useState<number | string>(savedOvernightPay);
  const [extraHours, setExtraHours] = useState<number | string>(savedExtraHours);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Synchronize draft state if employee or date changes externally
  useEffect(() => {
    setSelectedMode(savedMode);
    setCustomHoursText(savedCustomHours);
    setCustomTotalPay(savedCustomPay);
    setOvernightHoursText(savedOvernightHours);
    setOvernightPay(savedOvernightPay);
    setExtraHours(savedExtraHours);
    setStatusMessage(null);
  }, [employee.id, selectedDayStr, dayData?.isOvernight, dayData?.isReducedHours, dayData?.customHoursText, dayData?.customTotalPay, dayData?.overnightHoursText, dayData?.overnightPay, dayData?.extraHours]);

  // Determine if there are uncommitted changes
  const hasModeChanged = selectedMode !== savedMode;
  const isDirty = 
    hasModeChanged ||
    (selectedMode === 'reduced' && (customHoursText !== savedCustomHours || Number(customTotalPay) !== savedCustomPay)) ||
    (selectedMode === 'overnight' && (overnightHoursText !== savedOvernightHours || Number(overnightPay) !== savedOvernightPay || Number(extraHours) !== savedExtraHours)) ||
    (selectedMode === 'normal' && Number(extraHours) !== savedExtraHours);

  // Financial calculations
  const isParty = dayData?.type === 'party';
  const baseRate = isParty 
    ? (dayData?.partyRateAtTime !== undefined ? dayData.partyRateAtTime : employee.partyRate)
    : (dayData?.dailyRateAtTime !== undefined ? dayData.dailyRateAtTime : employee.dailyRate);

  const extraHourRate = dayData?.extraHourRateAtTime !== undefined ? dayData.extraHourRateAtTime : employee.extraHourRate;
  const numericExtraHours = Math.max(0, Number(extraHours) || 0);
  const extraVal = numericExtraHours * extraHourRate;
  const numericOvernightPay = Math.max(0, Number(overnightPay) || 0);
  const totalOvernightVal = baseRate + numericOvernightPay + extraVal;
  const numericCustomTotalPay = Math.max(0, Number(customTotalPay) || 0);

  // Handle saving the draft changes to Firestore
  const handleSave = async () => {
    if (!canEdit) {
      setStatusMessage({ 
        type: 'error', 
        text: 'Permissão negada: apenas administradores podem alterar e salvar a escala.' 
      });
      return;
    }

    if (selectedMode === 'reduced') {
      const pay = Number(customTotalPay);
      if (isNaN(pay) || pay < 0) {
        setStatusMessage({ type: 'error', text: 'Informe um valor válido em R$ para o horário reduzido.' });
        return;
      }
    }

    if (selectedMode === 'overnight') {
      const pay = Number(overnightPay);
      if (isNaN(pay) || pay < 0) {
        setStatusMessage({ type: 'error', text: 'Informe um valor válido em R$ para o adicional da pernoite.' });
        return;
      }
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const newDays = employee.workDays.map(d => {
        if (d.date === selectedDayStr && !d.isCancelled) {
          const updated: WorkDay = { ...d };

          if (selectedMode === 'normal') {
            updated.isReducedHours = false;
            updated.isOvernight = false;
            delete updated.customHoursText;
            delete updated.customTotalPay;
            delete updated.overnightHoursText;
            delete updated.overnightPay;
          } else if (selectedMode === 'reduced') {
            updated.isReducedHours = true;
            updated.isOvernight = false;
            updated.customHoursText = (customHoursText || '').trim() || 'Horário Reduzido';
            updated.customTotalPay = numericCustomTotalPay;
            delete updated.overnightHoursText;
            delete updated.overnightPay;
          } else if (selectedMode === 'overnight') {
            updated.isOvernight = true;
            updated.isReducedHours = false;
            updated.overnightHoursText = (overnightHoursText || '').trim() || '22h às 08h';
            updated.overnightPay = numericOvernightPay;
            delete updated.customHoursText;
            delete updated.customTotalPay;
          }

          if (numericExtraHours > 0) {
            updated.extraHours = numericExtraHours;
          } else {
            delete updated.extraHours;
          }

          return updated;
        }
        return d;
      });

      const sanitizedDays = removeUndefinedFields(newDays);
      await onUpdateDays(employee.id, sanitizedDays);

      setStatusMessage({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving workday:', err);
      setStatusMessage({ 
        type: 'error', 
        text: err?.message || 'Falha ao salvar no banco de dados. Verifique a conexão e permissões.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancelling / discarding changes
  const handleCancel = () => {
    setSelectedMode(savedMode);
    setCustomHoursText(savedCustomHours);
    setCustomTotalPay(savedCustomPay);
    setOvernightHoursText(savedOvernightHours);
    setOvernightPay(savedOvernightPay);
    setExtraHours(savedExtraHours);
    setStatusMessage({ type: 'info', text: 'Alterações descartadas.' });

    setTimeout(() => {
      setStatusMessage(null);
      if (onClose) onClose();
    }, 400);
  };

  return (
    <div className="pt-2.5 mt-2 border-t border-brand-primary/10 animate-in fade-in slide-in-from-top-2 space-y-3">
      {/* Permission alert if read-only */}
      {!canEdit && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 p-2.5 rounded-lg">
          <ShieldAlert size={14} className="shrink-0" />
          <span>Modo de visualização. Apenas administradores podem modificar ou salvar configurações de escala.</span>
        </div>
      )}

      {/* Mode selection tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-brand-bg/80 rounded-xl border border-brand-border text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSelectedMode('normal')}
          className={cn(
            "py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5",
            selectedMode === 'normal'
              ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/40 font-bold shadow-sm"
              : "text-brand-muted hover:text-brand-text hover:bg-brand-card/50"
          )}
        >
          <Clock size={13} />
          <span>Horas Extras</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('reduced')}
          className={cn(
            "py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5",
            selectedMode === 'reduced'
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm"
              : "text-brand-muted hover:text-brand-text hover:bg-brand-card/50"
          )}
        >
          <Clock size={13} />
          <span>Horário Reduzido</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('overnight')}
          className={cn(
            "py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5",
            selectedMode === 'overnight'
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold shadow-sm"
              : "text-brand-muted hover:text-brand-text hover:bg-brand-card/50"
          )}
        >
          <Moon size={13} />
          <span>Pernoite</span>
        </button>
      </div>

      {/* Helpful context notification when changing modes */}
      {savedMode === 'overnight' && selectedMode === 'reduced' && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Substituindo Pernoite por Horário Reduzido:</strong> A pernoite anterior será cancelada e o colaborador passará a receber o valor acordado pelo horário reduzido após clicar em <em>Salvar</em>.
          </div>
        </div>
      )}

      {savedMode === 'overnight' && selectedMode === 'normal' && (
        <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-[11px] text-blue-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Cancelando Pernoite:</strong> O adicional de pernoite será removido e o colaborador retornará ao turno padrão com diária integral após clicar em <em>Salvar</em>.
          </div>
        </div>
      )}

      {savedMode === 'reduced' && selectedMode === 'normal' && (
        <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-[11px] text-blue-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Cancelando Horário Reduzido:</strong> O colaborador retornará à diária integral da categoria após clicar em <em>Salvar</em>.
          </div>
        </div>
      )}

      {/* Option 2: Horário Reduzido Inputs */}
      {selectedMode === 'reduced' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-brand-bg/60 p-3 rounded-lg border border-amber-500/20">
          <div>
            <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
              Quantas Horas (Ex: 01h30m)
            </label>
            <input 
              type="text"
              value={customHoursText}
              onChange={(e) => setCustomHoursText(e.target.value)}
              placeholder="01h30m"
              disabled={!canEdit || isSaving}
              className="w-full bg-brand-card border border-amber-500/40 rounded-md py-1 px-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
              Valor Total de Horas (R$)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1 text-xs text-gray-400 font-bold">R$</span>
              <input 
                type="number"
                min="0"
                step="1"
                value={customTotalPay}
                onChange={(e) => setCustomTotalPay(e.target.value)}
                placeholder="45.00"
                disabled={!canEdit || isSaving}
                className="w-full bg-brand-card border border-amber-500/40 rounded-md py-1 pl-8 pr-2.5 text-xs font-bold text-emerald-400 focus:outline-none focus:border-amber-400 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="col-span-full text-[10px] text-amber-300 font-medium bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
            Valor total acordado para este dia: <strong>{formatCurrency(numericCustomTotalPay)}</strong> ({customHoursText || 'Horário Reduzido'}).
          </div>
        </div>
      )}

      {/* Option 3: Pernoite Inputs */}
      {selectedMode === 'overnight' && (
        <div className="space-y-2.5 bg-brand-bg/60 p-3 rounded-lg border border-indigo-500/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Horário da Pernoite (Ex: 22h às 08h)
              </label>
              <input 
                type="text"
                value={overnightHoursText}
                onChange={(e) => setOvernightHoursText(e.target.value)}
                placeholder="22h às 08h"
                disabled={!canEdit || isSaving}
                className="w-full bg-brand-card border border-indigo-500/40 rounded-md py-1 px-2.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-400 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Adicional de Pernoite (R$)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1 text-xs text-gray-400 font-bold">R$</span>
                <input 
                  type="number"
                  min="0"
                  step="1"
                  value={overnightPay}
                  onChange={(e) => setOvernightPay(e.target.value)}
                  placeholder="150.00"
                  disabled={!canEdit || isSaving}
                  className="w-full bg-brand-card border border-indigo-500/40 rounded-md py-1 pl-8 pr-2.5 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-400 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Campo de Horas Extras também na Pernoite */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-brand-border/40">
            <label className="text-[10px] font-black text-brand-muted uppercase">Horas Extras na Pernoite:</label>
            <input 
              type="number"
              min="0"
              step="0.5"
              value={extraHours || ''}
              onChange={(e) => setExtraHours(e.target.value)}
              placeholder="0"
              disabled={!canEdit || isSaving}
              className="w-20 bg-brand-bg border border-indigo-500/30 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-indigo-400 text-brand-text disabled:opacity-60"
            />
            {numericExtraHours > 0 && (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                = {formatCurrency(extraVal)} ({formatCurrency(extraHourRate)}/h)
              </span>
            )}
          </div>

          <div className="text-[10px] text-indigo-300 font-medium bg-indigo-500/10 p-2 rounded border border-indigo-500/20 leading-relaxed">
            Diária Base: <strong>{formatCurrency(baseRate)}</strong> ({employee.level}) + Adicional Pernoite: <strong>{formatCurrency(numericOvernightPay)}</strong>
            {numericExtraHours > 0 && <> + Extras ({numericExtraHours}h): <strong>{formatCurrency(extraVal)}</strong></>}
            {' '} = <strong>Total: {formatCurrency(totalOvernightVal)}</strong>.
          </div>
        </div>
      )}

      {/* Option 1: Horas Extras Padrão */}
      {selectedMode === 'normal' && (
        <div className="space-y-2 bg-brand-bg/40 p-2.5 rounded-lg border border-brand-border">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-black text-brand-muted uppercase">Horas Extras:</label>
            <input 
              type="number"
              min="0"
              step="0.5"
              value={extraHours || ''}
              onChange={(e) => setExtraHours(e.target.value)}
              placeholder="0"
              disabled={!canEdit || isSaving}
              className="w-20 bg-brand-bg border border-brand-primary/20 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:border-brand-primary text-brand-text disabled:opacity-60"
            />
            {numericExtraHours > 0 ? (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                = {formatCurrency(extraVal)} ({formatCurrency(extraHourRate)}/h)
              </span>
            ) : (
              <span className="text-[10px] text-brand-muted italic">
                (Taxa padrão: {formatCurrency(extraHourRate)}/h)
              </span>
            )}
          </div>
          <div className="text-[10px] text-brand-muted">
            Diária Normal: <strong>{formatCurrency(baseRate)}</strong>
            {numericExtraHours > 0 && <> + Extras: <strong>{formatCurrency(extraVal)}</strong> = <strong>Total: {formatCurrency(baseRate + extraVal)}</strong></>}
          </div>
        </div>
      )}

      {/* Status or validation message */}
      {statusMessage && (
        <div className={cn(
          "flex items-center gap-2 text-xs p-2 rounded-lg font-medium",
          statusMessage.type === 'success' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
          statusMessage.type === 'error' && "bg-red-500/10 text-red-400 border border-red-500/30",
          statusMessage.type === 'info' && "bg-blue-500/10 text-blue-400 border border-blue-500/30"
        )}>
          {statusMessage.type === 'success' ? <Check size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Action buttons: Salvar e Cancelar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-brand-border/60">
        <div className="flex items-center gap-1.5">
          {isDirty && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Alterações pendentes" />
          )}
          <span className="text-[10px] text-brand-muted">
            {isDirty ? 'Modificações não salvas' : 'Configuração sincronizada'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Cancelar */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg/80 hover:bg-brand-card text-brand-muted hover:text-brand-text text-xs font-semibold transition-all disabled:opacity-50"
            title="Descartar alterações e restaurar escala original"
          >
            <RotateCcw size={13} />
            <span>Cancelar</span>
          </button>

          {/* Botão Salvar */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !canEdit}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
              canEdit
                ? "bg-brand-primary hover:bg-brand-primary/90 text-brand-bg hover:shadow"
                : "bg-gray-700 text-gray-400 cursor-not-allowed",
              isSaving && "opacity-75 cursor-wait"
            )}
            title={!canEdit ? "Apenas administradores podem salvar alterações" : "Salvar alterações nesta escala"}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Salvar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
