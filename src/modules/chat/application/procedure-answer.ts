import type { RagContextResult } from '@/shared/types/rag';

function normalizeProcedureText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanupProcedureContent(value: string) {
  const normalized = normalizeProcedureText(value)
    .replace(/DOCUMENTO:\s*.+?(?=\n|$)/gi, '')
    .replace(/SETOR:\s*.+?(?=\n|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const compact: string[] = [];
  for (const line of lines) {
    const previous = compact[compact.length - 1];
    const isCommandLike =
      /[#(]|^(show|conf|configure|interface|ip |set-member|description|switchport|copy |logging |clock |sntp |authentication|qinq|server host|admin password|sip server|outbound proxy|dns server|subnet mask|default router|firmware server path|ntp server|codec|fxs)/i.test(
        line
      );
    const isFieldLine =
      /^[A-Z0-9][A-Z0-9 /()._-]{2,}:\s*\S+/i.test(line) ||
      /^(profile|basic settings|network settings|sip settings|fxs ports?|web ui access|status|maintenance|advanced settings)\b/i.test(
        line
      );

    if (isCommandLike || isFieldLine) {
      compact.push(line);
      continue;
    }

    if (!previous || /[#(:]$/.test(previous) || previous.length > 180) {
      compact.push(line);
    } else {
      compact[compact.length - 1] = `${previous} ${line}`;
    }
  }

  return compact.join('\n');
}

function normalizeDocumentTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractIdentifierTokens(value: string) {
  return normalizeDocumentTitle(value).match(/\b[a-z]{1,6}\d{2,6}\b/g) || [];
}

function splitRagBlocks(context: string) {
  return context
    .split('\n\n---\n\n')
    .map((block) => {
      const titleMatch = block.match(/FONTE:\s*(.+)/i);
      const contentMatch = block.match(/CONTEUDO:\s*([\s\S]+)/i);
      return {
        title: titleMatch?.[1]?.trim() || '',
        content: contentMatch?.[1]?.trim() || '',
      };
    })
    .filter((item) => item.title || item.content);
}

function extractProcedureStepsFromText(text: string) {
  const normalized = normalizeProcedureText(text);
  const patterns = [
    /passo\s*(\d{1,2})\s*[:\-]\s*([\s\S]*?)(?=passo\s*\d{1,2}\s*[:\-]|$)/gi,
    /etapa\s*(\d{1,2})\s*[:\-]\s*([\s\S]*?)(?=etapa\s*\d{1,2}\s*[:\-]|$)/gi,
    /(?:^|\n)\s*(\d{1,2})[.\-]\s+([\s\S]*?)(?=(?:\n\s*\d{1,2}[.\-]\s+)|$)/gim,
  ];

  const stepMap = new Map<number, string>();

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const stepNumber = Number(match[1]);
      const rawStep = normalizeProcedureText(match[2] || '');
      if (!stepNumber || rawStep.length < 12) continue;
      if (!stepMap.has(stepNumber) || rawStep.length > (stepMap.get(stepNumber) || '').length) {
        stepMap.set(stepNumber, rawStep);
      }
    }
  }

  return [...stepMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, content]) => ({
      step,
      content,
    }));
}

type ProcedureSection = {
  title: string;
  content: string;
};

function looksLikeProcedureHeading(line: string) {
  const normalized = normalizeDocumentTitle(line);
  if (!normalized || normalized.length > 80) return false;

  return (
    /^(acesso|access|login|web ui|basic settings|network settings|sip settings|profile ?\d*|profile sip|fxs ports?|fxs port \d+|codec|codecs|wan|lan|rede|network|status|maintenance|advanced settings|provisioning|validacao|validacao final|salvar|aplicar)\b/.test(
      normalized
    ) ||
    /^[A-Za-z0-9 /()_.-]+:$/.test(line.trim())
  );
}

function extractProcedureSectionsFromText(text: string) {
  const lines = normalizeProcedureText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: ProcedureSection[] = [];
  let current: ProcedureSection | null = null;

  for (const line of lines) {
    if (looksLikeProcedureHeading(line)) {
      if (current?.content.trim()) {
        sections.push({
          title: current.title,
          content: cleanupProcedureContent(current.content),
        });
      }

      current = { title: line.replace(/:$/, ''), content: '' };
      continue;
    }

    if (!current) {
      current = { title: 'Visao geral', content: line };
      continue;
    }

    current.content = current.content ? `${current.content}\n${line}` : line;
  }

  if (current?.content.trim()) {
    sections.push({
      title: current.title,
      content: cleanupProcedureContent(current.content),
    });
  }

  return sections.filter((section) => section.content.length >= 24);
}

function chooseDominantBlocks(ragContext: RagContextResult, retrievalQuery: string) {
  const blocks = splitRagBlocks(ragContext.context);
  if (!blocks.length) {
    return {
      dominantTitle: '',
      dominantBlocks: [] as ReturnType<typeof splitRagBlocks>,
    };
  }

  const queryIdentifiers = new Set(extractIdentifierTokens(retrievalQuery));
  const grouped = new Map<string, { title: string; blocks: ReturnType<typeof splitRagBlocks>; score: number }>();

  for (const block of blocks) {
    const title = block.title || ragContext.sources[0]?.title || 'Turbo-Docs Wiki';
    const normalizedTitle = normalizeDocumentTitle(title);
    const titleIdentifiers = extractIdentifierTokens(title);
    const key = titleIdentifiers[0] || normalizedTitle || title;
    const current = grouped.get(key) || { title, blocks: [], score: 0 };
    current.blocks.push(block);
    current.score += 10;
    current.score += block.content.length / 400;

    for (const identifier of queryIdentifiers) {
      if (normalizedTitle.includes(identifier)) current.score += 80;
      if (normalizeDocumentTitle(block.content).includes(identifier)) current.score += 40;
    }

    grouped.set(key, current);
  }

  const dominant = [...grouped.values()].sort((a, b) => b.score - a.score)[0];

  return {
    dominantTitle: dominant?.title || ragContext.sources[0]?.title || '',
    dominantBlocks: dominant?.blocks || blocks,
  };
}

export function buildProcedureAnswerFromRagContext(ragContext: RagContextResult, retrievalQuery: string) {
  const normalizedQuery = retrievalQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const isProcedureQuery = /\b(como|configurar|configuracao|acessar|acesso|instalar|ajustar|habilitar|passo|passos)\b/.test(
    normalizedQuery
  );

  if (!isProcedureQuery || !ragContext.context) return null;

  const { dominantTitle, dominantBlocks } = chooseDominantBlocks(ragContext, retrievalQuery);
  if (!dominantBlocks.length) return null;

  const dominantText = dominantBlocks.map((block) => block.content).join('\n\n');
  const steps = extractProcedureStepsFromText(dominantText);
  const sections = extractProcedureSectionsFromText(dominantText);

  if (steps.length < 3 && sections.length < 3) return null;

  const intro = dominantTitle
    ? `Procedimento encontrado em ${dominantTitle}:`
    : 'Procedimento encontrado na base oficial:';

  const procedureLines =
    steps.length >= 3
      ? steps.slice(0, 10).map((item) => `${item.step}. ${cleanupProcedureContent(item.content)}`)
      : sections.slice(0, 10).map((section, index) => `${index + 1}. ${section.title}\n${section.content}`);

  const answer = [intro, ...procedureLines].join('\n');

  return {
    answer,
    confidence: steps.length >= 3 ? 0.94 : 0.91,
    needsClarification: false,
    clarifyingQuestion: '',
    nextStep: 'Se precisar, posso detalhar qualquer um dos passos ou extrair os comandos exatamente como estao no manual.',
    sourceHint: dominantTitle || ragContext.sources[0]?.title || 'Turbo-Docs Wiki',
  };
}
