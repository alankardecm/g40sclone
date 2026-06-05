import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { groqClient, openaiClient } from '@/infrastructure/ai/chat-clients';
import { buildAgenticRagContext } from '@/lib/rag-agent';
import { buildZabbixContext } from '@/modules/zabbix/application/build-zabbix-context';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type LLMMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type Source = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

const SYSTEM_GERAL = `Você é o assistente interno da Netturbo — um GPT corporativo para uso exclusivo dos colaboradores.

Você pode ajudar com qualquer coisa: responder perguntas gerais, redigir e melhorar textos, explicar conceitos, pesquisar assuntos, analisar situações, criar rascunhos de email, resolver problemas técnicos, fazer cálculos, resumir documentos, traduzir, etc.

Regras:
- Este é um ambiente INTERNO para colaboradores. Você NÃO é um chatbot de atendimento ao cliente.
- Responda qualquer pergunta usando seu conhecimento geral — não restrinja respostas à "base interna".
- Seja direto, natural e útil. Evite introduções desnecessárias ou listas de capacidades.
- Para saudações simples, responda de forma breve e natural, sem listar o que você pode fazer.
- Responda sempre em português do Brasil, a menos que o usuário escreva em outro idioma.
- Quando pedirem para reescrever ou melhorar um texto, entregue o resultado pronto, sem comentários extras.
- Sempre que a resposta incluir comandos, código ou scripts, coloque-os em blocos de código markdown (exemplo: \`\`\`bash\\ngit init\\n\`\`\`). Nunca coloque comandos em texto corrido.`;

const SYSTEM_INTERNO = (context: string, queries: string[], zabbixContext?: string) =>
  `Você é um assistente técnico interno da Netturbo, provedora de internet.
Sua função é responder perguntas dos colaboradores com base na documentação interna (TurboDocs) e nos dados ao vivo do Zabbix.

INSTRUÇÕES:
- Para perguntas sobre alarmes, clientes offline, eventos ou status de host: use os DADOS DO ZABBIX como fonte principal
- Para perguntas sobre procedimentos, configurações e manuais: use a DOCUMENTAÇÃO abaixo
- Se a documentação cobrir parcialmente a dúvida, use o que encontrou e indique o que falta
- Se não houver informação suficiente em nenhuma fonte, diga claramente
- Seja direto, técnico e objetivo. Responda sempre em português do Brasil

BUSCAS REALIZADAS NA DOCUMENTAÇÃO: ${queries.join(' | ')}

--- DOCUMENTAÇÃO INTERNA (TurboDocs) ---
${context || 'Nenhuma documentação encontrada para esta consulta.'}
--- FIM DA DOCUMENTAÇÃO ---
${zabbixContext ? `\n--- DADOS AO VIVO DO ZABBIX ---\n${zabbixContext}\n--- FIM DO ZABBIX ---` : ''}`;

async function callLLM(payload: LLMMessage[], maxTokens = 1024): Promise<string> {
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

function generateTitleFromMessage(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, ' ');
  return cleaned.length > 50 ? cleaned.slice(0, 50) + '...' : cleaned;
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { content: string };

  if (!body.content?.trim()) {
    return Response.json({ error: 'Conteúdo da mensagem é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verifica ownership da conversa
  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('id, user_email, mode, title')
    .eq('id', id)
    .single();

  if (!conv || conv.user_email !== session.user.email) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // Salva mensagem do usuário
  await supabase.from('chat_messages').insert({
    conversation_id: id,
    role: 'user',
    content: body.content.trim(),
  });

  // Busca histórico para contexto LLM (últimas 20 mensagens)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(20);

  const normalized: LLMMessage[] = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const isInterno = conv.mode === 'interno';
  let answer = '';
  let sources: Source[] = [];

  if (!isInterno) {
    answer = await callLLM([{ role: 'system', content: SYSTEM_GERAL }, ...normalized]);
    sources = [];
  } else {
    const lastUserMsg = body.content.trim();
    const [ragResult, zabbixCtx] = await Promise.all([
      buildAgenticRagContext(lastUserMsg),
      buildZabbixContext(lastUserMsg).catch(() => ''),
    ]);
    sources = ragResult.sources ?? [];
    const systemPrompt = SYSTEM_INTERNO(ragResult.context ?? '', ragResult.queries ?? [], zabbixCtx || undefined);
    answer = await callLLM([{ role: 'system', content: systemPrompt }, ...normalized], 2048);
  }

  const finalAnswer = answer.trim() || 'Não consegui gerar uma resposta. Tente novamente.';

  // Salva resposta do assistente
  await supabase.from('chat_messages').insert({
    conversation_id: id,
    role: 'assistant',
    content: finalAnswer,
    sources: sources.length > 0 ? sources : null,
  });

  // Atualiza updated_at da conversa e título automático se ainda for padrão
  const isFirstMessage = (history ?? []).filter((m) => m.role === 'user').length === 1;
  const titleUpdate: Record<string, string> = { updated_at: new Date().toISOString() };
  if (isFirstMessage && conv.title === 'Nova conversa') {
    titleUpdate.title = generateTitleFromMessage(body.content);
  }

  await supabase.from('chat_conversations').update(titleUpdate).eq('id', id);

  return Response.json({ answer: finalAnswer, sources, title: titleUpdate.title });
}
