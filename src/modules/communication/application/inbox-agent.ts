// Agente de atendimento do Inbox: dado o histórico da conversa, redige uma resposta
// sugerida em PT-BR, no tom certo para a categoria (suporte, cobrança, retenção, comercial).
// Usa Groq quando há chave; senão, cai em modelos por categoria. O humano revisa antes de enviar.
import { groqClient } from '@/infrastructure/ai/chat-clients';
import type { Conversation, ConversationCategory, AgentSuggestion } from '@/shared/types/inbox';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const primeiroNome = (nome: string) => (nome || '').trim().split(/\s+/)[0] || 'tudo bem';

const GUIA: Record<ConversationCategory, string> = {
  suporte: 'Demonstre empatia, oriente um passo simples de verificação e diga que vai registrar um chamado e priorizar a checagem do sinal.',
  cobranca: 'Seja empático e ofereça caminhos para regularizar (parcelamento ou novo prazo) e reativar o serviço. Nunca constranja o cliente.',
  retencao: 'O cliente quer cancelar. Reconheça a falha, valorize a conta, prometa priorizar a solução técnica e o retorno hoje. Foque em reter.',
  comercial: 'Mostre interesse, ofereça próximo passo (enviar planos/valores, checar cobertura, agendar instalação). Seja ágil.',
  geral: 'Responda de forma cordial e breve, agradecendo e se colocando à disposição.',
};

function fallback(c: Conversation): AgentSuggestion {
  const nome = primeiroNome(c.clienteNome);
  const map: Record<ConversationCategory, string> = {
    suporte: `Sinto muito pelo transtorno, ${nome}. Já estou registrando um chamado e priorizando a verificação do sinal na sua região. Pode confirmar se as luzes do seu equipamento estão acesas em verde? Enquanto isso, nossa equipe técnica já vai analisar.`,
    cobranca: `Olá, ${nome}! Entendo a situação. Consigo te oferecer um parcelamento ou um novo prazo para regularizar e reativar o serviço ainda hoje. Qual opção fica melhor pra você?`,
    retencao: `${nome}, lamento muito pela instabilidade — não é o padrão que queremos entregar. Vou priorizar a análise técnica do seu caso e te retorno hoje com uma posição sobre o SLA. Sua conta é muito importante pra nós e quero resolver isso com você.`,
    comercial: `Oi, ${nome}! Que bom o interesse. Já te passo as opções de plano e valores e, se quiser, agendo a instalação. Posso confirmar seu endereço para checar a cobertura?`,
    geral: `Muito obrigado pela mensagem, ${nome}! Ficamos à disposição para o que precisar. 🙌`,
  };
  return { source: 'fallback', texto: map[c.categoria] };
}

export async function suggestReply(c: Conversation): Promise<AgentSuggestion> {
  if (!process.env.GROQ_API_KEY) return fallback(c);
  try {
    const historico = c.mensagens
      .map((m) => `${m.direction === 'in' ? 'Cliente' : 'Provedor'}: ${m.texto}`)
      .join('\n');

    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'Você é o atendente virtual de um provedor de internet regional, falando com um assinante pelo WhatsApp. ' +
            'Escreva UMA resposta em português do Brasil, cordial, objetiva e humana (2 a 4 frases), pronta para enviar. ' +
            `Categoria do atendimento: ${c.categoria}. Diretriz: ${GUIA[c.categoria]} ` +
            'Não invente valores, prazos exatos nem dados que não foram informados. Não use linguagem robótica. Responda só com o texto da mensagem.',
        },
        { role: 'user', content: `Cliente: ${c.clienteNome}\nAssunto: ${c.assunto}\n\nConversa até aqui:\n${historico}` },
      ],
    });
    const texto = (completion.choices[0]?.message?.content ?? '').trim();
    if (!texto) return fallback(c);
    return { source: 'ai', texto };
  } catch {
    return fallback(c);
  }
}
