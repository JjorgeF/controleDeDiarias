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

function maskEndpoint(endpoint?: string): string {
  if (!endpoint) return 'indefinido';
  try {
    const url = new URL(endpoint);
    const lastPart = endpoint.slice(-8);
    return `${url.origin}/.../${lastPart}`;
  } catch {
    return endpoint.length > 20 ? `${endpoint.slice(0, 10)}...${endpoint.slice(-8)}` : '***';
  }
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
    const isVapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

    if (isVapidConfigured) {
      webpush.setVapidDetails(
        'mailto:suporte@ligapositiva.com',
        vapidPublicKey as string,
        vapidPrivateKey as string
      );
    } else {
      console.warn('[PUSH-SERVER] VAPID keys incompletas: VAPID_PUBLIC_KEY=' + Boolean(vapidPublicKey) + ', VAPID_PRIVATE_KEY=' + Boolean(vapidPrivateKey));
    }

    const targetTokens: PushTokenDoc[] = Array.isArray(tokens) ? tokens : [];

    if (targetTokens.length === 0) {
      return res.status(200).json({
        success: true,
        simulationMode: !isVapidConfigured,
        sentCount: 0,
        failedCount: 0,
        totalCount: 0,
        message: 'Nenhum dispositivo encontrado para envio.',
        details: []
      });
    }

    // Se as chaves NÃO estiverem configuradas, reportamos simulação explicitamente (NÃO contar como enviado)
    if (!isVapidConfigured) {
      console.log('[PUSH-SERVER] Executando em MODO SIMULAÇÃO (chaves ausentes no backend).');
      return res.status(200).json({
        success: false,
        simulationMode: true,
        sentCount: 0,
        failedCount: targetTokens.length,
        totalCount: targetTokens.length,
        message: 'Modo simulação: chaves VAPID não configuradas no servidor (VAPID_PRIVATE_KEY ou VAPID_PUBLIC_KEY ausentes). Nenhuma notificação real foi enviada.',
        details: targetTokens.map(tok => ({
          endpoint: maskEndpoint(tok.endpoint),
          userEmail: tok.userEmail || 'desconhecido',
          status: 'simulado',
          pushServiceStatusCode: null,
          error: 'Chave privada VAPID não configurada no servidor Vercel'
        }))
      });
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
    const results: Array<{
      endpoint: string;
      userEmail: string;
      status: 'enviado' | 'falha';
      pushServiceStatusCode: number | null;
      error?: string;
    }> = [];

    await Promise.all(
      targetTokens.map(async (tok) => {
        if (!tok.endpoint || !tok.keys?.p256dh || !tok.keys?.auth) {
          failCount++;
          results.push({
            endpoint: maskEndpoint(tok.endpoint),
            userEmail: tok.userEmail || 'desconhecido',
            status: 'falha',
            pushServiceStatusCode: null,
            error: 'Inscrição incompleta (chaves p256dh ou auth ausentes)'
          });
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
          const sendResult = await webpush.sendNotification(pushSubscription, payload, {
            TTL: 60 * 60 * 24 // 24 hours TTL
          });
          const statusCode = sendResult.statusCode || 201;
          successCount++;
          results.push({
            endpoint: maskEndpoint(tok.endpoint),
            userEmail: tok.userEmail || 'desconhecido',
            status: 'enviado',
            pushServiceStatusCode: statusCode
          });
        } catch (pushErr: any) {
          failCount++;
          const statusCode = pushErr?.statusCode || null;
          const errorMessage = pushErr?.body || pushErr?.message || 'Erro desconhecido ao comunicar com o FCM';
          console.error('[PUSH-SERVER] Falha no envio para FCM:', {
            statusCode,
            endpoint: maskEndpoint(tok.endpoint),
            error: errorMessage
          });
          results.push({
            endpoint: maskEndpoint(tok.endpoint),
            userEmail: tok.userEmail || 'desconhecido',
            status: 'falha',
            pushServiceStatusCode: statusCode,
            error: typeof errorMessage === 'string' ? errorMessage.slice(0, 300) : 'Erro no serviço de push'
          });
        }
      })
    );

    return res.status(200).json({
      success: successCount > 0,
      simulationMode: false,
      sentCount: successCount,
      failedCount: failCount,
      totalCount: targetTokens.length,
      message: successCount > 0 
        ? `Envio real processado com sucesso para ${successCount} dispositivo(s).` 
        : `Falha no envio para todos os ${failCount} dispositivo(s).`,
      details: results
    });
  } catch (error: any) {
    console.error('[PUSH-SERVER] Erro geral no handler:', error);
    return res.status(500).json({
      success: false,
      simulationMode: false,
      error: error?.message || 'Erro interno do servidor ao processar envio de push.'
    });
  }
}
