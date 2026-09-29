import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, DollarSign, X, Calendar, ShieldCheck } from 'lucide-react';

interface WhatsNewModalProps {
  isAdmin: boolean;
}

const CURRENT_VERSION_ADMIN = 'admin_v1.4.0_payment_groups_clean';
const CURRENT_VERSION_EMPLOYEE = 'employee_v1.4.0_fast_calendar';

export function WhatsNewModal({ isAdmin }: WhatsNewModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const storageKey = isAdmin ? `whats_new_seen_${CURRENT_VERSION_ADMIN}` : `whats_new_seen_${CURRENT_VERSION_EMPLOYEE}`;

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, [storageKey]);

  const handleClose = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {}
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-brand-card border border-brand-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative p-6 md:p-8 text-brand-text"
        >
          {/* Botão Fechar */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white bg-brand-bg/80 rounded-full hover:bg-brand-border transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>

          {/* Cabeçalho */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="p-3 bg-brand-primary/15 text-brand-primary rounded-2xl border border-brand-primary/30 shadow-inner">
              <Sparkles size={26} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-full border border-brand-primary/20">
                Atualização Recente
              </span>
              <h2 className="text-xl md:text-2xl font-black text-brand-text mt-1">
                {isAdmin ? 'Novidades na Gestão de Escalas ✨' : 'Novidades no seu Aplicativo! 🎉'}
              </h2>
            </div>
          </div>

          {/* Conteúdo dinâmico por papel */}
          {isAdmin ? (
            <div className="space-y-4 mb-6">
              <p className="text-sm text-brand-muted leading-relaxed">
                Trazemos melhorias para o gerenciamento de equipes e visualização do calendário:
              </p>

              <div className="bg-brand-bg/70 p-4 rounded-2xl border border-brand-border space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-brand-text uppercase tracking-wider">
                      🛡️ Grupo de Pagamento da Gestão
                    </h3>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Agora você pode marcar colaboradores no grupo <strong>Gestão</strong> para que seus pagamentos de festas e CCSP sejam calculados no dia 15, com filtros independentes no Financeiro.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-primary/15 text-brand-primary rounded-xl shrink-0 mt-0.5">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-brand-text uppercase tracking-wider">
                      ✨ Calendário Otimizado & Aberturas Extras
                    </h3>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Visualização mais espaçosa e enxuta, com lista compacta em linha única para os envios de disponibilidade extraordinária.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <p className="text-sm text-brand-muted leading-relaxed">
                Atualizamos o app para deixar sua experiência mais rápida, limpa e prática no dia a dia:
              </p>

              <div className="bg-brand-bg/70 p-4 rounded-2xl border border-brand-border space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-primary/15 text-brand-primary rounded-xl shrink-0 mt-0.5">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-brand-text uppercase tracking-wider">
                      ✨ Calendário Direto e Espaçoso
                    </h3>
                    <p className="text-xs text-brand-muted mt-0.5">
                      A tela do <strong>Meu Calendário</strong> agora abre direto nos dias do mês, com mais espaço para você ver suas escalas confirmadas e marcar disponibilidades sem precisar rolar a tela.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-party/10 text-brand-party rounded-xl shrink-0 mt-0.5">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-brand-text uppercase tracking-wider">
                      📌 Meus Ganhos & Meu Perfil
                    </h3>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Seus valores de diárias, previsão de recebimentos, chave PIX e tamanhos de uniformes continuam disponíveis a qualquer momento nas abas dedicadas no rodapé.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé com botões de ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
            <button
              onClick={handleClose}
              className="w-full bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-black py-3 px-6 rounded-2xl shadow-lg transition-all text-sm active:scale-95"
            >
              Entendido, vamos lá! 🚀
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
