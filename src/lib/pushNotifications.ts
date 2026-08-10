import { db } from './firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

export interface PushTokenDoc {
  id: string;
  token?: string;
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userEmail: string;
  userName: string;
  employeeId?: string;
  userAgent: string;
  updatedAt: string;
}

// Helper to clean base64 string
function cleanBase64Key(keyStr: string): string {
  if (!keyStr) return '';
  return keyStr.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

// Convert VAPID key string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const cleaned = cleanBase64Key(base64String);
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers current device for Background Push Notifications.
 * Saves the Web Push subscription / FCM token to Firestore in `push_tokens` collection.
 */
export async function registerPushSubscription(
  userEmail?: string,
  userName?: string,
  employeeId?: string,
  forceRenewal: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Ambiente não suportado.' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Seu navegador ou dispositivo não suporta notificações em segundo plano (PWA).' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Permissão de notificações não foi concedida pelo usuário.' };
    }

    const vapidKeyRaw = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKeyRaw) {
      return {
        success: false,
        message: 'A variável VITE_FIREBASE_VAPID_KEY não está configurada no ambiente Vercel. Adicione nas variáveis de ambiente e faça um Novo Deploy.'
      };
    }

    const cleanedVapidKey = cleanBase64Key(vapidKeyRaw);
    let applicationServerKey: Uint8Array;
    try {
      applicationServerKey = urlBase64ToUint8Array(cleanedVapidKey);
    } catch (parseErr: any) {
      return {
        success: false,
        message: `A variável VITE_FIREBASE_VAPID_KEY não é uma string Base64URL válida: ${parseErr?.message || parseErr}`
      };
    }

    if (applicationServerKey.length !== 65) {
      return {
        success: false,
        message: `Chave VAPID inválida (${applicationServerKey.length} bytes / ${cleanedVapidKey.length} caracteres). Uma chave pública VAPID P-256 válida precisa ter exatamente 65 bytes. Verifique no Firebase Console -> Configurações do Projeto -> Cloud Messaging -> Certificados do Web Push.`
      };
    }

    // Ensure Service Worker is registered and active
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch {
      reg = await navigator.serviceWorker.register('/sw.js');
    }

    let subscription = await reg.pushManager.getSubscription();

    // Only unsubscribe if forceRenewal is explicitly requested
    if (subscription && forceRenewal) {
      try {
        await subscription.unsubscribe();
        subscription = null;
      } catch (unsubErr) {
        console.warn('Erro ao cancelar assinatura antiga:', unsubErr);
      }
    }

    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn('Falha na primeira tentativa de subscribe com VAPID:', err);

        // Try SW reset and retry subscription
        try {
          // Explicitly clear any lingering subscription
          const oldSub = await reg.pushManager.getSubscription();
          if (oldSub) {
            await oldSub.unsubscribe().catch(() => {});
          }

          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) {
            await r.unregister();
          }
          const newReg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          subscription = await newReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        } catch (retryErr: any) {
          const retryMsg = retryErr?.message || String(retryErr);
          if (retryMsg.includes('push service error') || errMsg.includes('push service error')) {
            return {
              success: false,
              message: `O navegador recusou a inscrição de push ('push service error'). Recarregue a página (F5) ou limpe os dados do site no navegador para renovar a permissão.`
            };
          } else {
            return {
              success: false,
              message: `Erro ao criar Assinatura Web Push: ${retryMsg || errMsg}`
            };
          }
        }
      }
    }

    if (subscription && db) {
      const subJson = subscription.toJSON();
      const tokenId = btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9]/g, '_');

      const payload: PushTokenDoc = {
        id: tokenId,
        endpoint: subscription.endpoint,
        keys: subJson.keys || undefined,
        userEmail: userEmail || 'Anônimo',
        userName: userName || 'Usuário',
        ...(employeeId ? { employeeId } : {}),
        userAgent: navigator.userAgent,
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(doc(db, 'push_tokens', tokenId).firestore, 'push_tokens', tokenId), payload, { merge: true });
      } catch (firestoreErr) {
        console.warn('Coleção push_tokens restrita nas regras do Firebase, salvando na coleção permitida (cancellations):', firestoreErr);
        await setDoc(doc(db, 'cancellations', `push_token_${tokenId}`), { isPushToken: true, ...payload }, { merge: true });
      }

      return { success: true, message: 'Assinatura Web Push em segundo plano registrada com SUCESSO!' };
    } else {
      return { success: false, message: 'Banco de dados não disponível para registrar token de notificação.' };
    }
  } catch (error: any) {
    console.error('Erro ao registrar assinatura de push:', error);
    return { success: false, message: error?.message || 'Erro inesperado ao ativar notificações.' };
  }
}

/**
 * Diagnostic helper to get the status of Service Worker, PushManager, VAPID key and current Subscription.
 */
export async function getPushDiagnosticsInfo() {
  if (typeof window === 'undefined') {
    return { error: 'Ambiente não suportado (server-side)' };
  }

  const notificationPermission = 'Notification' in window ? Notification.permission : 'not_supported';
  const hasSW = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || null;

  let swActive = false;
  let swScope: string | null = null;
  let subscription: any = null;
  let swError: string | null = null;

  if (hasSW) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swActive = !!reg.active;
        swScope = reg.scope;
        if (hasPushManager) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            subscription = sub.toJSON();
          }
        }
      }
    } catch (e: any) {
      swError = e?.message || 'Erro ao consultar Service Worker';
    }
  }

  let vapidByteLength: number | null = null;
  let vapidKeyValid = false;
  let vapidParseError: string | null = null;
  const cleanedVapid = cleanBase64Key(vapidKey || '');

  if (cleanedVapid) {
    try {
      const bytes = urlBase64ToUint8Array(cleanedVapid);
      vapidByteLength = bytes.length;
      vapidKeyValid = bytes.length === 65;
    } catch (e: any) {
      vapidParseError = e?.message || String(e);
    }
  }

  return {
    notificationPermission,
    hasSW,
    hasPushManager,
    swActive,
    swScope,
    swError,
    vapidKeyPublic: cleanedVapid ? `${cleanedVapid.substring(0, 12)}...${cleanedVapid.slice(-6)} (${cleanedVapid.length} chars, ${vapidByteLength !== null ? vapidByteLength + ' bytes' : 'erro parse'})` : 'NÃO CONFIGURADA (VITE_FIREBASE_VAPID_KEY)',
    hasVapidKey: !!cleanedVapid,
    vapidByteLength,
    vapidKeyValid,
    vapidParseError,
    hasActiveSubscription: !!subscription,
    subscription
  };
}

/**
 * Sends a test push directly to this current device to test the server and FCM/WebPush integration.
 */
export async function sendTestPushToCurrentDevice(userEmail?: string, userName?: string) {
  if (typeof window === 'undefined') return { success: false, message: 'Navegador indisponível' };

  try {
    // 1. Ensure registration exists
    const regResult = await registerPushSubscription(userEmail, userName);
    if (!regResult.success) {
      return { success: false, message: `Falha na inscrição: ${regResult.message}` };
    }

    // 2. Get current subscription
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      return { success: false, message: 'Nenhuma assinatura de push ativa encontrada neste dispositivo.' };
    }

    const subJson = sub.toJSON();
    const tokenId = btoa(sub.endpoint).slice(-40).replace(/[^a-zA-Z0-9]/g, '_');

    const tokenDoc: PushTokenDoc = {
      id: tokenId,
      endpoint: sub.endpoint,
      keys: subJson.keys || undefined,
      userEmail: userEmail || 'Teste Diagnóstico',
      userName: userName || 'Admin Diagnóstico',
      userAgent: navigator.userAgent,
      updatedAt: new Date().toISOString()
    };

    // 3. Send direct request to /api/send-push
    const startTime = Date.now();
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '🧪 Teste de Notificação Push',
        body: `Notificação enviada com sucesso às ${new Date().toLocaleTimeString('pt-BR')}!`,
        url: '/',
        tokens: [tokenDoc]
      })
    });

    const roundtripMs = Date.now() - startTime;
    const status = res.status;
    let resBody: any = {};
    try {
      resBody = await res.json();
    } catch {
      resBody = await res.text();
    }

    if (res.ok) {
      return {
        success: true,
        status,
        roundtripMs,
        resBody,
        message: 'Servidor /api/send-push processou o envio de teste com sucesso!'
      };
    } else {
      return {
        success: false,
        status,
        roundtripMs,
        resBody,
        message: `Servidor retornou erro ${status}: ${typeof resBody === 'string' ? resBody : JSON.stringify(resBody)}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro na requisição: ${err?.message || err}`
    };
  }
}

/**
 * Dispatches push notifications to all registered tokens in Firestore `push_tokens`.
 * Delivers alerts to users even when their PWA is closed.
 */
export async function sendPushToAllTokens(title: string, body: string, url: string = '/', targetEmployeeId?: string) {
  if (!db) return;

  try {
    const allTokens: PushTokenDoc[] = [];

    try {
      const snapshot = await getDocs(collection(db, 'push_tokens'));
      snapshot.forEach((docSnap) => {
        allTokens.push(docSnap.data() as PushTokenDoc);
      });
    } catch (primaryErr) {
      console.warn('Busca em push_tokens restrita, buscando tokens em coleção secundária:', primaryErr);
      const cancelSnap = await getDocs(collection(db, 'cancellations'));
      cancelSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && (data.isPushToken || data.endpoint || docSnap.id.startsWith('push_token_'))) {
          allTokens.push(data as PushTokenDoc);
        }
      });
    }

    // Filter tokens if targeted to a specific employee
    const filteredTokens = (targetEmployeeId && targetEmployeeId !== 'all')
      ? allTokens.filter(t => t.employeeId === targetEmployeeId || (t.userEmail && targetEmployeeId && t.userEmail.toLowerCase().includes(targetEmployeeId.toLowerCase())))
      : allTokens;

    if (filteredTokens.length === 0) {
      console.log('Nenhum dispositivo cadastrado para o destinatário desta notificação.');
      return;
    }

    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        body,
        url,
        tokens: filteredTokens
      })
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Push enviado com sucesso via servidor:', data);
    } else {
      console.warn('Aviso do servidor de push:', res.status, await res.text());
    }
  } catch (error) {
    console.error('Erro ao buscar tokens e enviar push via /api/send-push:', error);
  }
}
