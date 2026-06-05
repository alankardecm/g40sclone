import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Verifica que a conversa pertence ao usuário logado
  const { data: conv, error: convError } = await supabase
    .from('chat_conversations')
    .select('id, user_email')
    .eq('id', id)
    .single();

  if (convError || !conv) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });
  }

  if (conv.user_email !== session.user.email) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('id, role, content, sources, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (msgError) {
    return Response.json({ error: msgError.message }, { status: 500 });
  }

  return Response.json({ messages: messages ?? [] });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { title?: string; mode?: string };
  const supabase = getSupabaseAdmin();

  // Verifica ownership antes de atualizar
  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('user_email')
    .eq('id', id)
    .single();

  if (!conv || conv.user_email !== session.user.email) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim().slice(0, 120);
  }
  if (typeof body.mode === 'string' && ['geral', 'interno'].includes(body.mode)) {
    updates.mode = body.mode;
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ conversation: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Verifica ownership antes de deletar
  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('user_email')
    .eq('id', id)
    .single();

  if (!conv || conv.user_email !== session.user.email) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
