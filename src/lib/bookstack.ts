const BASE = (process.env.BOOKSTACK_BASE_URL ?? 'http://turbodocs.netturbosolucoes.com.br').replace(/\/$/, '');

export type BookStackSource = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

export type BookStackResult = {
  provider: 'bookstack' | 'empty';
  context: string;
  sources: BookStackSource[];
  diagnostics: string[];
};

type SearchItem = {
  id: number;
  name: string;
  type: 'page' | 'chapter' | 'book' | 'bookshelf';
  url: string;
  preview_html?: { content: string };
};

type PageDetail = {
  id: number;
  name: string;
  html: string;
  markdown?: string;
  book_id: number;
};

function authHeader(): string {
  const id = process.env.BOOKSTACK_TOKEN_ID?.trim();
  const secret = process.env.BOOKSTACK_TOKEN_SECRET?.trim();
  if (!id || !secret) throw new Error('BOOKSTACK_TOKEN_ID ou BOOKSTACK_TOKEN_SECRET não configurados');
  return `Token ${id}:${secret}`;
}

function resolveUrl(src: string): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `${BASE}${src}`;
  return `${BASE}/${src}`;
}

function proxyImageUrl(src: string): string {
  const resolved = resolveUrl(src);
  if (!resolved) return '';
  return `/api/proxy-image?url=${encodeURIComponent(resolved)}`;
}

function extractImages(html: string): string[] {
  const imgs: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const url = proxyImageUrl(match[1]);
    if (url) imgs.push(url);
  }
  return [...new Set(imgs)];
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function bsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`BookStack ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchBookStack(query: string, count = 8): Promise<BookStackResult> {
  const id = process.env.BOOKSTACK_TOKEN_ID?.trim();
  const secret = process.env.BOOKSTACK_TOKEN_SECRET?.trim();

  if (!id || !secret) {
    return { provider: 'empty', context: '', sources: [], diagnostics: ['BookStack: credenciais não configuradas'] };
  }

  try {
    const search = await bsGet<{ data: SearchItem[]; total: number }>(
      `/api/search?query=${encodeURIComponent(query)}&count=${count}`
    );

    const pages = search.data.filter((r) => r.type === 'page').slice(0, count);

    if (pages.length === 0) {
      return { provider: 'empty', context: '', sources: [], diagnostics: [`BookStack: nenhuma página encontrada para "${query}"`] };
    }

    const settled = await Promise.allSettled(
      pages.map((page) => bsGet<PageDetail>(`/api/pages/${page.id}`))
    );

    const blocks: string[] = [];
    const sources: BookStackSource[] = [];

    settled.forEach((result, i) => {
      if (result.status === 'rejected') return;
      const page = result.value;
      const text = htmlToText(page.html).slice(0, 3500);
      if (!text) return;

      const images = extractImages(page.html);
      const firstImage = images[0];

      sources.push({
        title: page.name,
        source: resolveUrl(pages[i].url),
        imageUrl: firstImage,
      });

      const block = [
        `TITULO: ${page.name}`,
        `FONTE: ${BASE}${pages[i].url}`,
        firstImage ? `IMAGEM_PRINCIPAL: ${firstImage}` : null,
        images.length > 1 ? `OUTRAS_IMAGENS: ${images.slice(1, 4).join(' | ')}` : null,
        `CONTEUDO:\n${text}`,
      ].filter(Boolean).join('\n');

      blocks.push(block);
    });

    const context = blocks.join('\n\n---\n\n');

    if (!context) {
      return { provider: 'empty', context: '', sources: [], diagnostics: ['BookStack: páginas encontradas mas sem conteúdo utilizável'] };
    }

    return {
      provider: 'bookstack',
      context: context.slice(0, 14000),
      sources,
      diagnostics: [
        `BookStack: ${pages.length} página(s) encontrada(s)`,
        `Fontes com imagem: ${sources.filter((s) => s.imageUrl).length}`,
        `Total de imagens extraídas: ${sources.reduce((acc, s) => acc + (s.imageUrl ? 1 : 0), 0)}`,
      ],
    };
  } catch (error) {
    return {
      provider: 'empty',
      context: '',
      sources: [],
      diagnostics: [`BookStack erro: ${error instanceof Error ? error.message : 'desconhecido'}`],
    };
  }
}
