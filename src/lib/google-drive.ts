import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export interface GoogleDriveDocMatch {
  id: string;
  name: string;
  mimeType: string;
  content: string;
}

export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error('Credenciais do Google Drive (Service Account) não configuradas no arquivo .env.');
  }

  // Corrige quebras de linha na chave privada se estiver formatada como string linear no .env
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email,
    key: formattedKey,
    scopes: SCOPES,
  });
}

/**
 * Pesquisa documentos no Google Drive contendo o termo de consulta.
 * Retorna os metadados e o conteúdo textual dos arquivos encontrados.
 */
export async function searchGoogleDriveDocs(query: string, limit: number = 3): Promise<GoogleDriveDocMatch[]> {
  if (!isGoogleDriveConfigured()) {
    console.warn('Pesquisa no Google Drive não configurada no .env.');
    return [];
  }

  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Filtra apenas tipos de arquivos textuais legíveis
    let q = "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf')";
    
    // Filtra por pasta específica se fornecida
    if (folderId && folderId.trim()) {
      q = `('${folderId.trim()}' in parents) and ${q}`;
    }

    // Filtra pelo termo de busca no título ou no texto completo
    if (query && query.trim()) {
      const sanitizedQuery = query.replace(/'/g, "\\'");
      q = `${q} and (name contains '${sanitizedQuery}' or fullText contains '${sanitizedQuery}')`;
    }

    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType)',
      pageSize: limit,
    });

    const files = res.data.files || [];
    const matches: GoogleDriveDocMatch[] = [];

    for (const file of files) {
      if (!file.id || !file.name) continue;
      try {
        let content = '';

        if (file.mimeType === 'application/vnd.google-apps.document') {
          // Exporta o Google Doc como texto plano
          const docRes = await drive.files.export({
            fileId: file.id,
            mimeType: 'text/plain',
          });
          content = docRes.data as string;
        } else if (file.mimeType === 'text/plain') {
          // Baixa o arquivo de texto puro diretamente
          const textRes = await drive.files.get({
            fileId: file.id,
            alt: 'media',
          });
          content = textRes.data as string;
        } else if (file.mimeType === 'application/pdf') {
          content = `[Arquivo PDF: ${file.name} - Indexação de texto bruto em PDF requer parser vetorial adicional. Para melhor performance no MVP, use Google Docs ou TXT.]`;
        }

        matches.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType || 'unknown',
          content: content.trim()
        });
      } catch (err: any) {
        console.error(`Erro ao baixar arquivo "${file.name}" (${file.id}) do Google Drive:`, err.message);
      }
    }

    return matches;
  } catch (err: any) {
    console.error('Erro geral ao pesquisar no Google Drive:', err);
    return [];
  }
}

/**
 * Formata os resultados estruturados em uma string simples para uso em prompts.
 */
export function formatDriveMatches(matches: GoogleDriveDocMatch[]): string {
  if (matches.length === 0) return 'Nenhum documento relevante encontrado.';
  
  return matches.map((file) => {
    const truncated = file.content.slice(0, 2000);
    return `📄 DOCUMENTO: ${file.name}\nID: ${file.id}\nCONTEÚDO:\n${truncated}\n----------------------------------`;
  }).join('\n\n');
}
