import { isGoogleDriveConfigured, searchGoogleDriveDocs, formatDriveMatches } from '@/lib/google-drive';

export type RagSource = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

export type RagContextResult = {
  provider: 'pinecone' | 'empty'; // Mantém o tipo existente para compatibilidade de schemas
  context: string;
  sources: RagSource[];
  diagnostics: string[];
};

/**
 * Cria o contexto de RAG realizando uma busca on-demand nos arquivos e pastas do Google Drive.
 * Substitui a busca antiga baseada em BookStack e banco vetorial Pinecone.
 * 
 * @param query Termo de busca fornecido pelo assistente de IA ou usuário
 */
export async function buildRagContext(query: string): Promise<RagContextResult> {
  if (!isGoogleDriveConfigured()) {
    return {
      provider: 'empty',
      context: '',
      sources: [],
      diagnostics: ['Google Drive RAG não configurado. Por favor, adicione as credenciais ao .env.'],
    };
  }

  try {
    // Busca até 3 documentos relevantes no Google Drive
    const matches = await searchGoogleDriveDocs(query, 3);
    
    if (matches.length === 0) {
      return {
        provider: 'empty',
        context: '',
        sources: [],
        diagnostics: [`Busca no Google Drive para "${query}" não retornou resultados.`],
      };
    }

    const context = formatDriveMatches(matches);
    
    const sources = matches.map((m) => ({
      title: m.name,
      source: `Google Drive`,
      // Retorna o link de visualização rápida do documento
      imageUrl: undefined, 
    }));

    return {
      provider: 'pinecone', // Mantido para compatibilidade com o front do Hub
      context,
      sources,
      diagnostics: [
        `RAG ativado: Google Drive`,
        `Documentos localizados: ${matches.length}`,
        `Termo pesquisado: "${query}"`
      ],
    };
  } catch (err: any) {
    console.error('Erro ao construir contexto RAG via Google Drive:', err);
    return {
      provider: 'empty',
      context: '',
      sources: [],
      diagnostics: [`Erro RAG: ${err.message}`],
    };
  }
}
