export const runtime = 'nodejs';

const BOOKSTACK_BASE = (process.env.BOOKSTACK_BASE_URL ?? 'http://turbodocs.netturbosolucoes.com.br').replace(/\/$/, '');

function authHeader(): string | null {
  const id = process.env.BOOKSTACK_TOKEN_ID?.trim();
  const secret = process.env.BOOKSTACK_TOKEN_SECRET?.trim();
  if (!id || !secret) return null;
  return `Token ${id}:${secret}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response('Missing url param', { status: 400 });
  }

  // Aceita apenas URLs do BookStack (segurança)
  const decoded = decodeURIComponent(url);
  if (!decoded.startsWith(BOOKSTACK_BASE) && !decoded.startsWith('/uploads/')) {
    return new Response('URL não permitida', { status: 403 });
  }

  const fullUrl = decoded.startsWith('http') ? decoded : `${BOOKSTACK_BASE}${decoded}`;

  try {
    const headers: Record<string, string> = {};
    const auth = authHeader();
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(fullUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return new Response(`Imagem não encontrada (${res.status})`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Falha ao carregar imagem', { status: 502 });
  }
}
