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

// Convert VAPID key string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
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
export async function registerPushSubscription(userEmail?: string, userName?: string, employeeId?: string): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Ambiente não suportado.' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Seu navegador ou dispositivo não suporta notificações em segundo plano (PWA).' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Permissão de notificações não foi concedida.' };
    }

    // Ensure Service Worker is registered and active
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch {
      reg = await navigator.serviceWorker.register('/sw.js');
    }

    let subscription = await reg.pushManager.getSubscription();

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!subscription) {
      if (vapidKey) {
        try {
          const applicationServerKey = urlBase64ToUint8Array(vapidKey);
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        } catch (err) {
          console.warn('Falha ao assinar com VAPID Key, tentando sem chave explícita:', err);
        }
      }

      if (!subscription) {
        try {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true
          });
        } catch (subErr) {
          console.warn('Erro na inscrição padrão do PushManager:', subErr);
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
        await setDoc(doc(db, 'push_tokens', tokenId), payload, { merge: true });
      } catch (firestoreErr) {
        console.warn('Coleção push_tokens restrita nas regras do Firebase, salvando na coleção permitida (cancellations):', firestoreErr);
        await setDoc(doc(db, 'cancellations', `push_token_${tokenId}`), { isPushToken: true, ...payload }, { merge: true });
      }

      return { success: true, message: 'Notificações em segundo plano registradas com sucesso!' };
    } else {
      return { success: true, message: 'Permissão de notificações ativada no dispositivo!' };
    }
  } catch (error) {
    console.error('Erro ao registrar assinatura de push:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Erro ao ativar notificações.' };
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

  return {
    notificationPermission,
    hasSW,
    hasPushManager,
    swActive,
    swScope,
    swError,
    vapidKeyPublic: vapidKey ? `${vapidKey.substring(0, 15)}... (tamanho ${vapidKey.length})` : 'NÃO CONFIGURADA (VITE_FIREBASE_VAPID_KEY)',
    hasVapidKey: !!vapidKey,
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
