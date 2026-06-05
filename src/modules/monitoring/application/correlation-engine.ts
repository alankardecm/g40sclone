import { getActiveProblems, type ZabbixProblem } from '@/lib/zabbix';
import { getSupabaseAdmin } from '@/lib/supabase';

export type CorrelatedIncident = {
  zabbixProblem: ZabbixProblem;
  relatedMessages: {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    sentiment: string;
    urgency: string;
  }[];
  impactScore: number; // 0 to 100
  matchReason: string;
};

/**
 * Normalizes text for comparison
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

/**
 * Extracts potential location/context keywords from Zabbix host or problem name
 */
function extractKeywords(text: string): string[] {
  const normalized = normalize(text);
  // Common prefixes in hostnames: POP_, OLT_, SW_, etc.
  return normalized
    .split(/\s+|_/)
    .filter(word => word.length > 3 && !['host', 'problem', 'down', 'offline', 'alarme', 'alerta'].includes(word));
}

export async function getNocWppCorrelation(lookbackMinutes: number = 120) {
  const supabase = getSupabaseAdmin();
  
  // 1. Fetch Zabbix Problems
  const zabbixProblems = await getActiveProblems(50);
  
  // 2. Fetch Recent WhatsApp Messages (Negative or Urgent)
  const nowTs = Math.floor(Date.now() / 1000);
  const sinceTs = nowTs - (lookbackMinutes * 60);

  const { data: analysisData, error: analysisError } = await supabase
    .from('wa_analysis')
    .select(`
      id,
      sentiment,
      urgency,
      keywords,
      wa_messages!inner(
        id,
        text_raw,
        sender_name,
        msg_timestamp
      )
    `)
    .gte('wa_messages.msg_timestamp', sinceTs)
    .or('sentiment.eq.negative,urgency.eq.critica')
    .order('wa_messages.msg_timestamp', { ascending: false });

  if (analysisError) throw analysisError;

  const correlatedIncidents: CorrelatedIncident[] = [];

  // 3. Correlation Logic
  for (const problem of zabbixProblems) {
    const problemText = `${problem.name} ${(problem.hosts || []).map(h => h.name).join(' ')}`;
    const problemKeywords = extractKeywords(problemText);
    const problemTs = Number(problem.clock);

    const relatedMessages = (analysisData || [])
      .filter(item => {
        const msg = item.wa_messages as any;
        const msgTs = msg.msg_timestamp;
        
        // Time proximity check: message happened after or slightly before the alarm (within 30m)
        const timeDiff = Math.abs(msgTs - problemTs);
        if (timeDiff > (60 * 60)) return false; // Max 1 hour diff

        // Keyword/Context match
        const msgText = normalize(msg.text_raw);
        const hasKeywordMatch = problemKeywords.some(kw => msgText.includes(kw));
        
        return hasKeywordMatch;
      })
      .map(item => {
        const msg = item.wa_messages as any;
        return {
          id: msg.id,
          text: msg.text_raw,
          sender: msg.sender_name || 'Desconhecido',
          timestamp: msg.msg_timestamp,
          sentiment: item.sentiment,
          urgency: item.urgency
        };
      });

    if (relatedMessages.length > 0) {
      // Calculate impact score based on volume and urgency
      const urgentCount = relatedMessages.filter(m => m.urgency === 'critica').length;
      const impactScore = Math.min(100, (relatedMessages.length * 10) + (urgentCount * 20));

      correlatedIncidents.push({
        zabbixProblem: problem,
        relatedMessages,
        impactScore,
        matchReason: `Encontradas ${relatedMessages.length} mensagens com termos coincidentes (${problemKeywords.slice(0, 3).join(', ')})`
      });
    }
  }

  // Sort by impact score
  return correlatedIncidents.sort((a, b) => b.impactScore - a.impactScore);
}
