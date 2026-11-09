import React from 'react';
import { X, HelpCircle, Zap, Lock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const CalendarLegendModal: React.FC<CalendarLegendModalProps> = ({
  isOpen,
  onClose,
  isAdmin = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
        {/* Overlay backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal Sheet container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-brand-border flex items-center justify-between bg-brand-bg/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-brand-text">
                  Legenda do Calendário
                </h3>
                <p className="text-[10px] sm:text-xs text-brand-muted">
                  Significado de cada cor, tag e indicador no mês
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 sm:p-5 space-y-5 overflow-y-auto">
            {/* Seção 1: Suas Escalas Confirmadas */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-brand-muted block">
                Escalas de Trabalho (Você foi escalado)
              </span>

              {/* Escalado CCSP */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-[#f2d861] text-slate-950 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-xs text-center whitespace-nowrap">
                    Escalado
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Escala CCSP Confirmada</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    Você está escalado para trabalhar nas atividades normais do CCSP nesta data.
                  </p>
                </div>
              </div>

              {/* Escalado Festa */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-brand-party text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1 text-center whitespace-nowrap">
                    <span>🎉</span>
                    <span>Escalado</span>
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Escala de Festa Confirmada</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    Você foi escalado para uma Festa/Evento. O nome e horário aparecem na lista detalhada abaixo do calendário.
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 2: Suas Disponibilidades Enviadas */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-brand-muted block">
                Disponibilidades (Dias que você marcou)
              </span>

              {/* Disp CCSP */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-tight uppercase flex items-center gap-1 shadow-xs text-center whitespace-nowrap">
                    <span>CCSP</span>
                    <span className="font-mono">1/1</span>
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Disponibilidade CCSP Enviada</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    Você informou que está apto para trabalhar no CCSP neste dia e está aguardando a coordenação montar a escala.
                  </p>
                </div>
              </div>

              {/* Disp Festa */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-brand-party/95 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-tight uppercase flex items-center gap-1 shadow-xs text-center whitespace-nowrap">
                    <span>🎉</span>
                    <span className="font-mono">1/2</span>
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Disponibilidade para Festa</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    A fração mostra para quantas festas você deu disponibilidade em relação ao total de festas cadastradas no dia (ex: 1 de 2 festas).
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 3: Indicadores Especiais */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-brand-muted block">
                Sinais & Status Especiais
              </span>

              {/* Abertura Extra */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs text-center whitespace-nowrap">
                    <Zap size={10} className="fill-amber-400 text-amber-400" />
                    <span>Extra</span>
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Abertura Extraordinária</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    Dia liberado pela coordenação para envio de novas disponibilidades fora do prazo padrão para suprir demanda.
                  </p>
                </div>
              </div>

              {/* Borda Iluminada */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-lg border-2 border-emerald-400/80 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-xs">
                    <Sparkles size={13} />
                  </div>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Borda Iluminada no Dia</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    Borda verde = dia em que você marcou disponibilidade. Borda azul = dia aberto com vagas para preenchimento.
                  </p>
                </div>
              </div>

              {/* Prazo Fechado */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs text-center whitespace-nowrap">
                    <Lock size={10} />
                    <span>Bloqueado</span>
                  </span>
                </div>
                <div className="text-xs min-w-0">
                  <p className="font-bold text-brand-text">Prazo Encerrado</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                    O período de envio/edição de disponibilidades para este mês já se encerrou.
                  </p>
                </div>
              </div>

              {/* Admin counters */}
              {isAdmin && (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/60">
                  <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center gap-1">
                    <span className="bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full text-[9px] font-black">
                      3 C
                    </span>
                    <span className="bg-brand-party/20 text-brand-party px-1.5 py-0.5 rounded-full text-[9px] font-black">
                      2 F
                    </span>
                  </div>
                  <div className="text-xs min-w-0">
                    <p className="font-bold text-brand-text">Total de Escalados (Gestão)</p>
                    <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                      Número total de recreadores escalados para o dia: C = CCSP, F = Festas.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer button */}
          <div className="p-3.5 sm:p-4 border-t border-brand-border bg-brand-bg/80 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-brand-primary text-slate-950 font-black text-xs sm:text-sm rounded-xl hover:bg-brand-primary/90 transition-all shadow-md active:scale-98"
            >
              Entendi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
