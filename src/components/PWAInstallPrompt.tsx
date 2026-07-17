import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, Plus, Smartphone, Check, MoreVertical } from 'lucide-react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(false);
  const [instructionPlatform, setInstructionPlatform] = React.useState<'ios' | 'android' | 'desktop'>('android');

  React.useEffect(() => {
    // Check if user is forcing test mode via query parameter
    const isTestMode = window.location.search.includes('pwa=test') || window.location.search.includes('pwa=true');
    if (isTestMode) {
      localStorage.removeItem('liga_positiva_pwa_dismissed_at');
      localStorage.removeItem('liga_positiva_pwa_installed');
    }

    // 1. Check if already running in standalone mode (installed)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone && !isTestMode) {
      return;
    }

    // 2. Check dismissal cookie/localStorage (hidden for 7 days)
    const dismissedAt = localStorage.getItem('liga_positiva_pwa_dismissed_at');
    if (dismissedAt && !isTestMode) {
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
    if (iosDetection) {
      setInstructionPlatform('ios');
    } else {
      // Check if it's a mobile device or desktop
      const mobileDetection = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setInstructionPlatform(mobileDetection ? 'android' : 'desktop');
    }

    // 4. Listen for beforeinstallprompt (Android / Chrome / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Prompt is ready natively! Show it after 2 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Fallback timer: if the native prompt event doesn't fire after 4 seconds
    // (e.g. inside an iframe, on unsupported browser, or lack of user interaction),
    // we STILL show the custom visual prompt so the user can see it and manually install.
    const fallbackTimer = setTimeout(() => {
      setShowPrompt(true);
    }, isTestMode ? 1000 : 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    // If native prompt is available, trigger it!
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem('liga_positiva_pwa_installed', 'true');
          setShowPrompt(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Error triggering native PWA prompt:', err);
        setShowInstructions(true);
      }
    } else {
      // No native prompt (e.g. iOS, in-app browser, iframe, or other browser limits)
      // Show the beautifully illustrated manual guide
      setShowInstructions(true);
    }
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
                {deferredPrompt ? 'Instalar' : 'Como Instalar'}
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

            {/* Title selection based on detected platform */}
            {instructionPlatform === 'ios' && (
              <>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Smartphone size={16} className="text-brand-primary" />
                    Instalar no iPhone / iPad
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Siga estes passos simples para adicionar à tela de início:
                  </p>
                </div>

                <div className="space-y-3 bg-brand-bg/40 p-3 rounded-xl border border-brand-border/50 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Toque no ícone de <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Compartilhar <Share size={10} className="inline mx-0.5" /></strong> na barra inferior do Safari.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Role a lista para baixo e toque em <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Adicionar à Tela de Início <Plus size={10} className="inline mx-0.5" /></strong>.
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
              </>
            )}

            {instructionPlatform === 'android' && (
              <>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Smartphone size={16} className="text-brand-primary" />
                    Instalar no Android (Chrome)
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Como o navegador não disparou o instalador, instale manualmente seguindo estes passos:
                  </p>
                </div>

                <div className="space-y-3 bg-brand-bg/40 p-3 rounded-xl border border-brand-border/50 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Toque no ícone de <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Menu <MoreVertical size={10} className="inline mx-0.5" /></strong> (três pontinhos) no canto superior direito do Chrome.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Selecione a opção <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Instalar aplicativo</strong> ou <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Adicionar à tela inicial</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Confirme em <strong className="text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20 font-black text-[10px]">Instalar</strong> para adicionar o atalho à sua tela inicial.
                    </p>
                  </div>
                </div>
              </>
            )}

            {instructionPlatform === 'desktop' && (
              <>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Smartphone size={16} className="text-brand-primary" />
                    Instalar no Computador (Chrome)
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Siga os passos abaixo para instalar o Liga Positiva no seu computador:
                  </p>
                </div>

                <div className="space-y-3 bg-brand-bg/40 p-3 rounded-xl border border-brand-border/50 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Olhe para a sua <strong className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">barra de endereço</strong> do navegador no canto direito.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Clique no ícone de <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-bold text-[10px]">Instalação <Plus size={10} className="inline mx-0.5" /></strong> ou de computador com seta para baixo.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-gray-300 leading-normal">
                      Clique em <strong className="text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20 font-black text-[10px]">Instalar</strong> para iniciar o app em uma janela independente e criar o atalho de acesso.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Manual tabs to switch guide */}
            <div className="flex items-center justify-between border-t border-brand-border/50 pt-3 text-[10px]">
              <div className="flex gap-2 text-gray-500 font-bold">
                <button 
                  onClick={() => setInstructionPlatform('android')}
                  className={`cursor-pointer px-1.5 py-0.5 rounded transition-all ${instructionPlatform === 'android' ? 'text-brand-primary bg-brand-primary/5' : 'hover:text-white'}`}
                >
                  Android
                </button>
                <button 
                  onClick={() => setInstructionPlatform('ios')}
                  className={`cursor-pointer px-1.5 py-0.5 rounded transition-all ${instructionPlatform === 'ios' ? 'text-brand-primary bg-brand-primary/5' : 'hover:text-white'}`}
                >
                  iOS
                </button>
                <button 
                  onClick={() => setInstructionPlatform('desktop')}
                  className={`cursor-pointer px-1.5 py-0.5 rounded transition-all ${instructionPlatform === 'desktop' ? 'text-brand-primary bg-brand-primary/5' : 'hover:text-white'}`}
                >
                  Desktop
                </button>
              </div>

              <button
                onClick={handleDismiss}
                className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-black py-1.5 px-3 rounded-lg transition-all shadow-md cursor-pointer"
              >
                Concluído
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}

