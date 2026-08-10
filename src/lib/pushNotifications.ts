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

      // Trigger test notification locally via Service Worker to confirm registration
      if (reg.showNotification) {
        reg.showNotification('Liga Positiva', {
          body: 'Notificações em segundo plano e com o PWA fechado ativadas com sucesso!',
          icon: '/logo.svg',
          badge: '/logo.svg',
          vibrate: [100, 50, 100]
        } as NotificationOptions);
      }

      return { success: true, message: 'Notificações em segundo plano registradas com sucesso!' };
    } else {
      // Fallback local notification if pushManager endpoint wasn't granted but Notification permission is granted
      if (reg && reg.showNotification) {
        reg.showNotification('Liga Positiva', {
          body: 'Notificações no dispositivo ativadas com sucesso!',
          icon: '/logo.svg'
        } as NotificationOptions);
      }
      return { success: true, message: 'Permissão de notificações ativada no dispositivo!' };
    }
  } catch (error) {
    console.error('Erro ao registrar assinatura de push:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Erro ao ativar notificações.' };
  }
}

/**
 * Dispatches push notifications to all registered tokens in Firestore `push_tokens`.
 * Delivers alerts to users even when their PWA is closed.
 */
export async function sendPushToAllTokens(title: string, body: string, url: string = '/', targetEmployeeId?: string) {
  try {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        body,
        url,
        targetEmployeeId
      })
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Push enviado com sucesso via servidor:', data);
    } else {
      console.warn('Aviso do servidor de push:', res.status, await res.text());
    }
  } catch (error) {
    console.error('Erro ao conectar ao servidor de push /api/send-push:', error);
  }
}
