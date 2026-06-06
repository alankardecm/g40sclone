import { NextRequest, NextResponse } from 'next/server';
import { moveLead } from '@/modules/crm/application/crm-store';
import { PIPELINE_STAGES, type PipelineStage } from '@/shared/types/crm';

export const dynamic = 'force-dynamic';

const VALID = new Set<string>(PIPELINE_STAGES.map((s) => s.id));

// POST /api/crm/leads/:id/move  body: { stage: PipelineStage }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { stage?: string };
    if (!body.stage || !VALID.has(body.stage)) {
      return NextResponse.json({ ok: false, error: 'Etapa inválida.' }, { status: 400 });
    }
    const lead = moveLead(id, body.stage as PipelineStage);
    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao mover o lead.' },
      { status: 500 },
    );
  }
}
