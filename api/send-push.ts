import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

export interface PushTokenDoc {
  tokenId?: string;
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userEmail?: string;
  userName?: string;
  employeeId?: string;
  isPushToken?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { title, body, url = '/', tokens = [] } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({ error: 'Título e corpo da notificação são obrigatórios.' });
    }

    const vapidPublicKey = process.env.VITE_FIREBASE_VAPID_KEY || process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys não configuradas totalmente nas variáveis de ambiente. Requer VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.');
    } else {
      webpush.setVapidDetails(
        'mailto:suporte@ligapositiva.com',
        vapidPublicKey,
        vapidPrivateKey
      );
    }

    const targetTokens: PushTokenDoc[] = Array.isArray(tokens) ? tokens : [];

    if (targetTokens.length === 0) {
      return res.status(200).json({ success: true, sentCount: 0, message: 'Nenhum dispositivo encontrado para envio.' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/logo.svg',
      timestamp: Date.now()
    });

    let successCount = 0;
    let failCount = 0;

    await Promise.all(
      targetTokens.map(async (tok) => {
        if (!tok.endpoint || !tok.keys?.p256dh || !tok.keys?.auth) {
          failCount++;
          return;
        }

        const pushSubscription = {
          endpoint: tok.endpoint,
          keys: {
            p256dh: tok.keys.p256dh,
            auth: tok.keys.auth
          }
        };

        try {
          if (vapidPublicKey && vapidPrivateKey) {
            await webpush.sendNotification(pushSubscription, payload);
            successCount++;
          } else {
            console.log('Modo simulação: Push token processado para', tok.userEmail);
            successCount++;
          }
        } catch (pushErr: any) {
          console.error('Erro ao enviar web push para dispositivo:', pushErr?.message || pushErr);
          failCount++;
        }
      })
    );

    return res.status(200).json({
      success: true,
      sentCount: successCount,
      failedCount: failCount,
      totalCount: targetTokens.length
    });
  } catch (error: any) {
    console.error('Erro no endpoint de envio de push:', error);
    return res.status(500).json({ error: error?.message || 'Erro interno do servidor ao enviar push.' });
  }
}
