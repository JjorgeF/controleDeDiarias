import React, { useState, useEffect } from 'react';
import { X, Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Send, Smartphone, ShieldCheck, Key, Info } from 'lucide-react';
import { getPushDiagnosticsInfo, sendTestPushToCurrentDevice, registerPushSubscription } from '../lib/pushNotifications';

interface PushDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export default function PushDiagnosticsModal({
  isOpen,
  onClose,
  userEmail,
  userName
}: PushDiagnosticsModalProps) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testingPush, setTestingPush] = useState(false);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await getPushDiagnosticsInfo();
      setInfo(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDiagnostics();
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
      await loadDiagnostics();
    }
  };

  const handleRegisterDevice = async () => {
    setLoading(true);
    try {
      const res = await registerPushSubscription(userEmail, userName, undefined, true);
      alert(res.message);
      await loadDiagnostics();
    } catch (e: any) {
      alert(`Erro ao registrar: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    setTestResult(null);
    try {
      const result = await sendTestPushToCurrentDevice(userEmail, userName);
      setTestResult(result);
      await loadDiagnostics();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Erro ao disparar teste de push'
      });
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border flex items-center justify-between bg-brand-bg/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-brand-text text-base sm:text-lg flex items-center gap-2">
                Diagnóstico de Notificações Push
              </h2>
              <p className="text-xs text-brand-muted">
                Valide a comunicação em segundo plano e Service Worker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-bg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Refresh Action */}
          <div className="flex items-center justify-between bg-brand-bg/50 p-3 rounded-xl border border-brand-border">
            <span className="text-xs text-brand-muted font-medium">
              Dispositivo: <strong className="text-brand-text">{navigator.userAgent.includes('Mobile') ? 'Celular / Mobile' : 'Computador / Desktop'}</strong>
            </span>
            <button
              onClick={loadDiagnostics}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar Diagnóstico
            </button>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              1. Status do Dispositivo e Navegador
            </h3>

            {/* Notification Permission */}
            <div className="p-3.5 rounded-xl border border-brand-border bg-brand-bg/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {info?.notificationPermission === 'granted' ? (
                  <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                ) : info?.notificationPermission === 'denied' ? (
                  <XCircle className="text-rose-400 shrink-0" size={20} />
                ) : (
                  <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                )}
                <div>
                  <p className="font-semibold text-brand-text text-sm">
                    Permissão de Notificação do Navegador
                  </p>
                  <p className="text-xs text-brand-muted">
                    Status atual: <code className="px-1.5 py-0.5 rounded bg-brand-bg border border-brand-border text-purple-300">{info?.notificationPermission || 'carregando...'}</code>
                  </p>
                </div>
              </div>
              {info?.notificationPermission !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0"
                >
                  Ativar Permissão
                </button>
              )}
            </div>

            {/* Service Worker */}
            <div className="p-3.5 rounded-xl border border-brand-border bg-brand-bg/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {info?.swActive ? (
                  <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                ) : (
                  <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                )}
                <div>
                  <p className="font-semibold text-brand-text text-sm">
                    Service Worker em Segundo Plano (sw.js)
                  </p>
                  <p className="text-xs text-brand-muted">
                    {info?.swActive ? `Ativo e rodando no escopo (${info?.swScope})` : 'Service Worker não está ativo ou não registrado.'}
                  </p>
                </div>
              </div>
            </div>

            {/* VAPID Public Key */}
            <div className="p-3.5 rounded-xl border border-brand-border bg-brand-bg/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {info?.hasVapidKey ? (
                  <Key className="text-emerald-400 shrink-0" size={20} />
                ) : (
                  <XCircle className="text-rose-400 shrink-0" size={20} />
                )}
                <div>
                  <p className="font-semibold text-brand-text text-sm">
                    Chave Pública VAPID (Frontend)
                  </p>
                  <p className="text-xs text-brand-muted">
                    {info?.vapidKeyPublic}
                  </p>
                </div>
              </div>
            </div>

            {/* Push Subscription */}
            <div className="p-3.5 rounded-xl border border-brand-border bg-brand-bg/30 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {info?.hasActiveSubscription ? (
                    <Smartphone className="text-emerald-400 shrink-0" size={20} />
                  ) : (
                    <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                  )}
                  <div>
                    <p className="font-semibold text-brand-text text-sm">
                      Assinatura Web Push (PushManager)
                    </p>
                    <p className="text-xs text-brand-muted">
                      {info?.hasActiveSubscription ? 'Dispositivo inscrito com token do navegador!' : 'Dispositivo não inscrito para receber pushes diretos.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRegisterDevice}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold shrink-0"
                >
                  Renovar Inscrição
                </button>
              </div>

              {info?.subscription && (
                <div className="mt-2 p-2.5 rounded bg-brand-bg/70 border border-brand-border text-[11px] font-mono text-brand-muted break-all max-h-24 overflow-y-auto">
                  <p><strong className="text-purple-300">Endpoint:</strong> {info.subscription.endpoint}</p>
                  <p><strong className="text-purple-300">P256dh:</strong> {info.subscription.keys?.p256dh ? '✅ Presente' : '❌ Ausente'}</p>
                  <p><strong className="text-purple-300">Auth:</strong> {info.subscription.keys?.auth ? '✅ Presente' : '❌ Ausente'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Test Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              2. Teste Direto de Comunicação Servidor PWA
            </h3>

            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-brand-text text-sm flex items-center gap-2">
                    <Send size={16} className="text-purple-400" />
                    Enviar Notificação de Teste Imediata
                  </h4>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Testa a rota `/api/send-push` e o envio via VAPID para este dispositivo específico
                  </p>
                </div>
                <button
                  onClick={handleSendTestPush}
                  disabled={testingPush || !info?.notificationPermission || info?.notificationPermission !== 'granted'}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0"
                >
                  {testingPush ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Testando Servidor...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Disparar Push de Teste
                    </>
                  )}
                </button>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}>
                  <div className="flex items-start gap-2 font-bold text-sm">
                    {testResult.success ? (
                      <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                    ) : (
                      <XCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                    )}
                    <span>{testResult.message}</span>
                  </div>

                  {testResult.status && (
                    <p className="text-brand-muted text-[11px]">
                      Status HTTP: <strong className="text-brand-text">{testResult.status}</strong> | Tempo de resposta: <strong className="text-brand-text">{testResult.roundtripMs}ms</strong>
                    </p>
                  )}

                  {testResult.resBody && (
                    <div className="mt-2 p-2 rounded bg-black/40 border border-white/10 font-mono text-[11px] overflow-x-auto text-brand-text">
                      <pre>{JSON.stringify(testResult.resBody, null, 2)}</pre>
                    </div>
                  )}

                  {testResult.success && (
                    <div className="mt-2 text-xs bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/20 text-emerald-300 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        Servidor de Push respondeu com SUCESSO!
                      </p>
                      <p className="text-emerald-200/90 text-[11px]">
                        Agora minimize ou feche o aplicativo PWA no seu celular e solicite outro teste. Se a notificação não vibrar/apitar com o app fechado, siga as orientações de sistema do Android/iOS abaixo.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Device Specific Guidelines */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
              <Info size={14} className="text-purple-400" />
              3. Por que notificações podem atrasar com o app fechado?
            </h3>

            <div className="p-4 rounded-xl border border-brand-border bg-brand-bg/40 space-y-3 text-xs text-brand-muted leading-relaxed">
              <div className="space-y-1">
                <p className="font-bold text-brand-text flex items-center gap-1.5">
                  📱 No iPhone / iOS (Safari):
                </p>
                <p className="pl-4">
                  A Apple exige que você adicione o site à <strong>Tela de Início</strong> (Abrir no Safari → Compartilhar → Adicionar à Tela de Início) e abra o app a partir da Tela de Início no iOS 16.4+. No Safari normal em guia, notificações com app fechado não funcionam por restrição do iOS.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-brand-border/50">
                <p className="font-bold text-brand-text flex items-center gap-1.5">
                  🤖 No Android (Xiaomi, Samsung, Motorola):
                </p>
                <p className="pl-4">
                  Sistemas Android possuem otimizadores agressivos de bateria. Vá nas <strong>Configurações do Celular → Aplicativos → Liga Positiva / Chrome → Bateria</strong> e altere para <em>"Sem restrições" / "Permitir em segundo plano"</em>.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-brand-border/50">
                <p className="font-bold text-brand-text flex items-center gap-1.5">
                  🔑 Variáveis no Vercel (Produção):
                </p>
                <p className="pl-4">
                  Confirme que no painel da Vercel você adicionou as duas chaves: <code className="text-purple-300">VITE_FIREBASE_VAPID_KEY</code> e <code className="text-purple-300">VAPID_PRIVATE_KEY</code> e efetuou um <strong>Redeploy</strong> do projeto.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-brand-border bg-brand-bg/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-bg hover:bg-brand-border text-brand-text font-bold text-xs border border-brand-border transition-colors"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
}
