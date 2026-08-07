import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function runBackup() {
  console.log("🚀 Iniciando Backup do Firestore para o Google Drive...");

  // 1. Validar Credenciais do Firebase
  const firebaseCredsRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!firebaseCredsRaw) {
    console.error("❌ ERRO: A variável de ambiente 'FIREBASE_SERVICE_ACCOUNT' não foi configurada nos Secrets do GitHub.");
    process.exit(1);
  }

  let firebaseCreds;
  try {
    firebaseCreds = JSON.parse(firebaseCredsRaw);
    if (firebaseCreds.private_key) {
      firebaseCreds.private_key = firebaseCreds.private_key.replace(/\\n/g, '\n');
    }
  } catch (err) {
    console.error("❌ ERRO: 'FIREBASE_SERVICE_ACCOUNT' não é um JSON válido.", err);
    process.exit(1);
  }

  // 2. Inicializar Firebase Admin SDK
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(firebaseCreds)
    });
  }
  const db = getFirestore();

  // 3. Extrair dados das coleções
  console.log("📦 Coletando dados do Firestore...");
  const collectionsToBackup = ['employees', 'dayConfigs', 'cancellations', 'customNotifications'];
  const backupData = {};
  const counts = {};

  for (const colName of collectionsToBackup) {
    try {
      const snapshot = await db.collection(colName).get();
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      backupData[colName] = docs;
      counts[colName] = docs.length;
      console.log(`  ✓ Coleção '${colName}': ${docs.length} documentos encontrados.`);
    } catch (err) {
      console.warn(`  ⚠️ Aviso ao ler coleção '${colName}':`, err.message);
      backupData[colName] = [];
      counts[colName] = 0;
    }
  }

  // 4. Formatar o arquivo de backup em JSON
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const fileName = `backup_escala_bartenders_${dateStr}.json`;
  
  const payload = {
    exportDate: now.toISOString(),
    appName: "Escala Bartenders CCSP",
    projectId: firebaseCreds.project_id || "lp-diarias-dev",
    counts,
    data: backupData
  };

  const tempFilePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`📄 Arquivo local criado: ${fileName} (${(fs.statSync(tempFilePath).size / 1024).toFixed(2)} KB)`);

  // 5. Validar Pasta do Google Drive
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!driveFolderId) {
    console.log("ℹ️ 'GOOGLE_DRIVE_FOLDER_ID' não fornecido. O arquivo será salvo na raiz do Service Account no Google Drive.");
  }

  // 6. Configurar Autenticação do Google Drive API
  const driveCredsRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT || firebaseCredsRaw;
  let driveCreds;
  try {
    driveCreds = JSON.parse(driveCredsRaw);
    if (driveCreds.private_key) {
      driveCreds.private_key = driveCreds.private_key.replace(/\\n/g, '\n');
    }
  } catch (err) {
    console.error("❌ ERRO: JSON de credenciais do Google Drive inválido.", err);
    process.exit(1);
  }

  const driveAuth = new google.auth.GoogleAuth({
    credentials: driveCreds,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  const drive = google.drive({ version: 'v3', auth: driveAuth });

  // 7. Enviar arquivo para o Google Drive
  console.log("☁️ Enviando backup para o Google Drive...");
  const fileMetadata = {
    name: fileName,
    parents: driveFolderId ? [driveFolderId] : []
  };

  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(tempFilePath)
  };

  try {
    const res = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    console.log(`✅ BACKUP CONCLUÍDO COM SUCESSO!`);
    console.log(`   ID do Arquivo no Drive: ${res.data.id}`);
    console.log(`   Link de Acesso: ${res.data.webViewLink}`);

    // Limpar arquivo temporário
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  } catch (err) {
    console.error("❌ ERRO ao enviar para o Google Drive:", err.message);
    if (err.errors) {
      console.error(JSON.stringify(err.errors, null, 2));
    }
    process.exit(1);
  }
}

runBackup();
