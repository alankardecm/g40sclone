import { groqClient, openaiClient } from '@/infrastructure/ai/chat-clients';
import { buildRagContext } from '@/lib/rag';

export const runtime = 'nodejs';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';

const SYSTEM_GERAL = `Você é o assistente interno do ${appName} — um GPT corporativo para uso exclusivo dos colaboradores.

Você pode ajudar com qualquer coisa: responder perguntas gerais, redigir e melhorar textos, explicar conceitos, pesquisar assuntos, analisar situações, criar rascunhos de email, resolver problemas técnicos, fazer cálculos, resumir documentos, traduzir, etc.

Regras:
- Este é um ambiente INTERNO para colaboradores. Você NÃO é um chatbot de atendimento ao cliente.
- Responda qualquer pergunta usando seu conhecimento geral — não restrinja respostas à "base interna".
- Seja direto, natural e útil. Evite introduções desnecessárias ou listas de capacidades.
- Para saudações simples, responda de forma breve e natural, sem listar o que você pode fazer.
- Responda sempre em português do Brasil, a menos que o usuário escreva em outro idioma.
- Quando pedirem para reescrever ou melhorar um texto, entregue o resultado pronto, sem comentários extras.
- Sempre que a resposta incluir comandos, código ou scripts, coloque-os em blocos de código markdown (exemplo: \`\`\`bash\\ngit init\\n\`\`\`). Nunca coloque comandos em texto corrido.`;

const SYSTEM_INTERNO = (context: string) =>
  `Você é um assistente interno do ${appName}.
Responda com base no contexto da base de conhecimento interna fornecido abaixo.
Se o contexto não contiver informação suficiente, diga claramente e ofereça o que sabe de forma geral.
Seja direto, técnico e objetivo. Responda sempre em português do Brasil.

--- BASE DE CONHECIMENTO INTERNA ---
${context}
--- FIM DA BASE ---`;

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

type Source = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

async function callLLM(payload: Message[], maxTokens = 1024): Promise<string> {
  try {
    const completion = await groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: payload,
    });
    return completion.choices[0]?.message?.content || '';
  } catch {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: payload,
    });
    return completion.choices[0]?.message?.content || '';
  }
}

export async function POST(req: Request) {
  const { messages, mode } = (await req.json()) as {
    messages: Message[];
    mode?: 'geral' | 'interno';
  };

  const normalized = (messages || []).slice(-20);
  const isInterno = mode === 'interno';

  if (!isInterno) {
    const answer = await callLLM([
      { role: 'system', content: SYSTEM_GERAL },
      ...normalized,
    ]);
    return Response.json({ answer, sources: [] });
  }

  // Modo interno — busca contexto na base de conhecimento
  const lastUserMsg = [...normalized].reverse().find((m) => m.role === 'user')?.content ?? '';
  const ragResult = await buildRagContext(lastUserMsg);

  const sources: Source[] = ragResult.sources ?? [];
  const systemPrompt = ragResult.context
    ? SYSTEM_INTERNO(ragResult.context)
    : SYSTEM_GERAL;

  const answer = await callLLM([
    { role: 'system', content: systemPrompt },
    ...normalized,
  ], 1024);

  return Response.json({ answer, sources });
}
