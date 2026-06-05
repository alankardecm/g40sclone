import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, mode, created_at, updated_at')
    .eq('user_email', session.user.email)
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let mode: 'geral' | 'interno' = 'geral';
  try {
    const body = await req.json() as { mode?: string };
    if (body.mode === 'interno') mode = 'interno';
  } catch { /* body vazio é ok */ }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_email: session.user.email,
      title: 'Nova conversa',
      mode,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ conversation: data });
}
