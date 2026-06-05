import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DashboardLayout, WidgetConfig } from '@/shared/types/dashboard';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('hub_dashboards')
      .select('id, name, description, widgets, created_by, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const dashboards: DashboardLayout[] = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      widgets: (row.widgets as WidgetConfig[]) ?? [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    return NextResponse.json({ ok: true, dashboards });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao listar dashboards.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; description?: string; widgets?: WidgetConfig[] };
    const name = (body.name ?? 'Dashboard sem título').slice(0, 120);
    const widgets = Array.isArray(body.widgets) ? body.widgets : [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('hub_dashboards')
      .insert({ name, description: body.description ?? null, widgets })
      .select('id, name, description, widgets, created_at, updated_at')
      .single();

    if (error) throw error;

    const dashboard: DashboardLayout = {
      id: data.id as string,
      name: data.name as string,
      description: (data.description as string | null) ?? undefined,
      widgets: (data.widgets as WidgetConfig[]) ?? [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };

    return NextResponse.json({ ok: true, dashboard }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao criar dashboard.' },
      { status: 500 }
    );
  }
}
