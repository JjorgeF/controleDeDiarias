import React, { useState } from 'react';
import { X, Send, Users, User, AlertCircle, Sparkles } from 'lucide-react';
import { Employee } from '../types';

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: {
    title: string;
    message: string;
    targetType: 'all' | 'specific';
    targetEmployeeId?: string;
    targetEmployeeName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  employees: Employee[];
}

export default function SendNotificationModal({
  isOpen,
  onClose,
  onSend,
  employees
}: SendNotificationModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Por favor, informe o título da notificação.');
      return;
    }
    if (!message.trim()) {
      setError('Por favor, informe a mensagem da notificação.');
      return;
    }
    if (targetType === 'specific' && !targetEmployeeId) {
      setError('Por favor, selecione o funcionário destinatário.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedEmp = employees.find(e => e.id === targetEmployeeId);
      const res = await onSend({
        title: title.trim(),
        message: message.trim(),
        targetType,
        targetEmployeeId: targetType === 'specific' ? targetEmployeeId : undefined,
        targetEmployeeName: targetType === 'specific' && selectedEmp ? (selectedEmp.artisticName || selectedEmp.name) : undefined
      });

      if (res.success) {
        setTitle('');
        setMessage('');
        setTargetType('all');
        setTargetEmployeeId('');
        onClose();
      } else {
        setError(res.error || 'Erro ao enviar notificação.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border flex items-center justify-between bg-brand-bg/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
              <Send size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-brand-text text-base sm:text-lg flex items-center gap-2">
                Enviar Notificação
                <Sparkles size={16} className="text-yellow-400" />
              </h2>
              <p className="text-xs text-brand-muted">
                Envie avisos ou lembretes diretos para a equipe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-bg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Destinatário */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider">
              Destinatários 🎯
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'all'
                    ? 'bg-brand-primary/15 border-brand-primary text-brand-primary shadow-sm'
                    : 'bg-brand-bg border-brand-border/60 text-brand-muted hover:text-brand-text'
                }`}
              >
                <Users size={16} />
                <span>Todos da Equipe</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType('specific')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'specific'
                    ? 'bg-brand-primary/15 border-brand-primary text-brand-primary shadow-sm'
                    : 'bg-brand-bg border-brand-border/60 text-brand-muted hover:text-brand-text'
                }`}
              >
                <User size={16} />
                <span>Específico</span>
              </button>
            </div>
          </div>

          {/* If specific employee */}
          {targetType === 'specific' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-brand-muted">
                Selecione o Funcionário
              </label>
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 px-3 text-brand-text text-sm focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value="">-- Escolha um integrante --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.artisticName || emp.name} ({emp.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider">
              Título da Notificação 📌
            </label>
            <input
              type="text"
              placeholder="Ex: Reunião de Alinhamento na Sexta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 px-3.5 text-brand-text text-sm focus:outline-none focus:border-brand-primary font-medium"
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider">
              Mensagem do Alerta 💬
            </label>
            <textarea
              rows={4}
              placeholder="Digite o conteúdo detalhado da notificação..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-xl p-3.5 text-brand-text text-sm focus:outline-none focus:border-brand-primary font-normal leading-relaxed resize-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-brand-muted hover:text-brand-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold rounded-xl text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Disparar Notificação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
