import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Smartphone, Compass, Share2, MoreVertical, AlertTriangle } from 'lucide-react';

export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined' || !navigator) return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  // Check for common in-app browsers
  return /WhatsApp|FBAN|FBAV|Instagram|LinkedIn|MicroMessenger|Line|TikTok|GSA/i.test(ua);
}

export function isIOS(): boolean {
  if (typeof window === 'undefined' || !navigator) return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function InAppBrowserGuide() {
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const inApp = isInAppBrowser();
  const ios = isIOS();

  if (!inApp) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="w-full max-w-md my-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left shadow-lg transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
          <AlertTriangle size={20} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
            Aviso: Navegador do WhatsApp / App
          </h3>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            O navegador interno do WhatsApp bloqueia janelas de login do Google. Para entrar sem erros:
          </p>
        </div>
      </div>

      <div className="mt-3 bg-black/30 border border-amber-500/20 rounded-xl p-3 space-y-2 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
          <span>Toque no botão <strong className="text-white">Opções ({ios ? '🧭 / 🔗' : '⋮ / ↗️'})</strong> no canto da tela.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
          <span>Selecione <strong className="text-amber-300">{ios ? '"Abrir no Safari"' : '"Abrir no Chrome"'}</strong>.</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-95"
        >
          {copied ? (
            <>
              <Check size={16} className="text-slate-950" />
              Link Copiado! Cole no {ios ? 'Safari' : 'Chrome'}
            </>
          ) : (
            <>
              <Copy size={16} />
              Copiar Link do App
            </>
          )}
        </button>

        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-center gap-1.5 bg-brand-card hover:bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold text-xs py-2.5 px-3 rounded-xl transition-all"
        >
          <Compass size={15} />
          {showGuide ? 'Ocultar Dica' : 'Ver Dica'}
        </button>
      </div>

      {showGuide && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs text-gray-300 space-y-2 animate-in fade-in duration-200">
          <p className="font-semibold text-amber-300">Como abrir fora do WhatsApp:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 pl-1">
            {ios ? (
              <>
                <li>No iPhone: toque no ícone da <strong>bússola 🧭</strong> ou nos <strong>três pontos (...)</strong> no canto inferior ou superior direito.</li>
                <li>Clique em <strong>"Abrir no Safari"</strong>.</li>
              </>
            ) : (
              <>
                <li>No Android: toque nos <strong>três pontos (⋮)</strong> no canto superior direito.</li>
                <li>Clique em <strong>"Abrir no Chrome"</strong> ou <strong>"Abrir no navegador"</strong>.</li>
              </>
            )}
            <li>Após abrir no seu navegador padrão, clique em <strong>"Entrar com Google"</strong> normalmente.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
