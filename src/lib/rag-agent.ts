import { groqClient } from '@/infrastructure/ai/chat-clients';
import { buildRagContext } from '@/lib/rag';

type RagSource = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

export type AgenticRagResult = {
  context: string;
  sources: RagSource[];
  queries: string[];
};

async function decomposeQuery(question: string): Promise<string[]> {
  try {
    const completion = await groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Você é especialista em busca de documentação técnica de provedores de internet.
Dado uma pergunta, gere de 2 a 4 queries de busca otimizadas para encontrar a resposta em uma base de conhecimento técnica (TurboDocs).
Foque no aspecto TÉCNICO: equipamento, protocolo, procedimento. Ignore nomes de clientes.
Retorne APENAS um array JSON de strings. Exemplo: ["configurar ATA SIP", "ATA Grandstream HT818 passo a passo"]`,
        },
        { role: 'user', content: question },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [question];
    const queries = JSON.parse(match[0]) as unknown;
    return Array.isArray(queries) && queries.length > 0
      ? (queries as string[]).filter((q) => typeof q === 'string' && q.trim())
      : [question];
  } catch {
    return [question];
  }
}

export async function buildAgenticRagContext(question: string): Promise<AgenticRagResult> {
  const decomposed = await decomposeQuery(question);

  // Original + decomposed (sem duplicatas, máximo 5 queries)
  const allQueries = [question, ...decomposed.filter((q) => q !== question)].slice(0, 5);

  // Busca paralela em todas as queries
  const results = await Promise.all(allQueries.map((q) => buildRagContext(q)));

  // Merge: deduplica por URL de fonte
  const seenSources = new Set<string>();
  const mergedSources: RagSource[] = [];
  const contextBlocks: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result.context) continue;

    contextBlocks.push(`=== Busca: "${allQueries[i]}" ===\n${result.context}`);

    for (const source of result.sources) {
      const key = source.source || source.title;
      if (!seenSources.has(key)) {
        seenSources.add(key);
        mergedSources.push(source);
      }
    }
  }

  return {
    context: contextBlocks.join('\n\n'),
    sources: mergedSources.slice(0, 12),
    queries: allQueries,
  };
}
