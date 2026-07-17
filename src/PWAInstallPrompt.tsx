import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, Plus, Smartphone, Check } from 'lucide-react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(false);

  React.useEffect(() => {
    // 1. Check if already running in standalone mode (installed)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check dismissal cookie/localStorage (hidden for 7 days)
    const dismissedAt = localStorage.getItem('liga_positiva_pwa_dismissed_at');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const now = Date.now();
      const differenceInDays = (now - dismissedTime) / (1000 * 60 * 60 * 24);
      if (differenceInDays < 7) {
        return; // Don't show if dismissed less than 7 days ago
      }
    }

    // 3. Detect iOS
    const iosDetection = 
      (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && 
      !('MSStream' in window);
    
    setIsIOS(iosDetection);

    // 4. Listen for beforeinstallprompt (Android / Chrome / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show after 3 seconds for a smoother experience
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Fallback for iOS
    if (iosDetection) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Wait 5 seconds before offering PWA on iOS
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('liga_positiva_pwa_installed', 'true');
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('liga_positiva_pwa_dismissed_at', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] z-50">
        {!showInstructions ? (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-brand-card border border-brand-border/80 rounded-2xl shadow-2xl p-4 md:p-5 flex flex-col gap-4 backdrop-blur-md relative overflow-hidden"
          >
            {/* Background Accent glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 border border-brand-primary/20 shadow-inner">
                <Smartphone size={20} className="animate-pulse" />
              </div>

              <div className="flex-1 pr-6">
                <h4 className="text-sm font-black text-white leading-tight">
                  Instalar Liga Positiva
                </h4>
                <p className="text-xs text-gray-400 font-medium mt-1 leading-relaxed">
                  Acesse suas escalas de forma rápida, offline e direto da sua tela inicial como um aplicativo!
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-gray-400 hover:text-white hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <button
                onClick={handleDismiss}
                className="flex-1 bg-transparent hover:bg-white/5 border border-brand-border text-gray-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                Agora não
              </button>
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-black text-xs py-2.5 px-4 rounded-xl transition-all shadow-md hover:shadow-brand-primary/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                {isIOS ? 'Como Instalar' : 'Instalar'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-brand-card border border-brand-border/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 backdrop-blur-md relative"
          >
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Voltar"
            >
              <X size={16} />
            </button>

            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Smartphone size={16} className="text-brand-primary" />
                Instalar no iPhone / iPad
              </h4>
              <p className="text-xs text-gray-400 font-medium mt-1">
                Siga estes simples passos para adicionar o app à sua tela de início:
              </p>
            </div>

            <div className="space-y-3 bg-brand-bg/40 p-3 rounded-xl border border-brand-border/50 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-gray-300 leading-normal">
                  Toque no ícone de <strong className="text-white flex inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Compartilhar <Share size={10} className="inline mx-0.5" /></strong> na barra inferior do Safari.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-gray-300 leading-normal">
                  Role a lista para baixo e toque em <strong className="text-white flex inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Adicionar à Tela de Início <Plus size={10} className="inline mx-0.5" /></strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-gray-300 leading-normal">
                  Confirme tocando em <strong className="text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20 font-black text-[10px]">Adicionar</strong> no canto superior direito.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                <Check size={12} className="text-green-400" /> Prontinho!
              </span>
              <button
                onClick={handleDismiss}
                className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-black text-xs py-2 px-4 rounded-xl transition-all shadow-md cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
