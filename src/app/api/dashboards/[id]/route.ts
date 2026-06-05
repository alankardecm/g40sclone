import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DashboardLayout, WidgetConfig } from '@/shared/types/dashboard';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('hub_dashboards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: 'Dashboard não encontrado.' }, { status: 404 });
    }

    const dashboard: DashboardLayout = {
      id: data.id as string,
      name: data.name as string,
      description: (data.description as string | null) ?? undefined,
      widgets: (data.widgets as WidgetConfig[]) ?? [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };

    return NextResponse.json({ ok: true, dashboard });
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro ao buscar dashboard.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { name?: string; description?: string; widgets?: WidgetConfig[] };

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.slice(0, 120);
    if (body.description !== undefined) updates.description = body.description;
    if (body.widgets !== undefined) updates.widgets = body.widgets;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('hub_dashboards').update(updates).eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro ao salvar dashboard.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('hub_dashboards').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro ao excluir dashboard.' }, { status: 500 });
  }
}
