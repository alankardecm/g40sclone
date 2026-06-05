import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool, isMysqlConfigured } from '@/infrastructure/datalake/mysql-client';
import type { RowDataPacket } from 'mysql2';

// Dias da semana em pt-BR, ordem dom→sáb
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
type DayLabel = (typeof DAY_LABELS)[number];

// MySQL DAYOFWEEK: 1=Dom, 2=Seg … 7=Sáb
const DAY_NUM_TO_LABEL: Record<number, DayLabel> = {
  1: 'Dom', 2: 'Seg', 3: 'Ter', 4: 'Qua', 5: 'Qui', 6: 'Sex', 7: 'Sáb',
};

export type WeekData = {
  label: string;
  weekKey: string;
  isCurrent: boolean;
  days: Partial<Record<DayLabel, number>>;
};

export type WeeklyProtocolsResponse = {
  ok: boolean;
  weeks?: WeekData[];
  equipes?: string[];
  anomalies?: Partial<Record<DayLabel, boolean>>;
  error?: string;
};

type WeekRow = RowDataPacket & {
  semana_yw: number;
  week_start: string;
  dia_num: number;
  total: number;
};

export async function GET(request: NextRequest) {
  if (!isMysqlConfigured()) {
    return NextResponse.json<WeeklyProtocolsResponse>(
      { ok: false, error: 'MySQL não configurado.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const equipe = searchParams.get('equipe')?.trim() ?? '';

  const pool = getMysqlPool();

  try {
    // Lista de equipes para o filtro
    const [equipeRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT equipe FROM fato_solicitacoes
       WHERE equipe IS NOT NULL AND equipe != ''
       ORDER BY equipe LIMIT 100`,
    );
    const equipes = (equipeRows as Array<{ equipe: string }>).map((r) => r.equipe);

    // Parâmetros do filtro de equipe
    const params: string[] = [];
    const equipeWhere = equipe ? ' AND equipe = ?' : '';
    if (equipe) params.push(equipe);

    // Protocolos por semana ISO × dia da semana (últimas 4 semanas)
    const [rows] = await pool.query<WeekRow[]>(
      `SELECT
         YEARWEEK(data_abertura, 1) AS semana_yw,
         DATE_FORMAT(
           SUBDATE(DATE(MIN(data_abertura)), (DAYOFWEEK(MIN(data_abertura)) + 5) % 7),
           '%d/%m'
         ) AS week_start,
         DAYOFWEEK(data_abertura) AS dia_num,
         COUNT(*) AS total
       FROM fato_solicitacoes
       WHERE data_abertura >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
         AND data_abertura < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         ${equipeWhere}
       GROUP BY semana_yw, dia_num
       ORDER BY semana_yw ASC, dia_num ASC`,
      params,
    );

    // Agrupa por semana
    const weekMap = new Map<number, WeekData>();
    for (const row of rows) {
      if (!weekMap.has(row.semana_yw)) {
        weekMap.set(row.semana_yw, {
          label: `Semana de ${row.week_start}`,
          weekKey: String(row.semana_yw),
          isCurrent: false,
          days: {},
        });
      }
      const week = weekMap.get(row.semana_yw)!;
      const dayLabel = DAY_NUM_TO_LABEL[row.dia_num];
      if (dayLabel) week.days[dayLabel] = row.total;
    }

    const weeks = Array.from(weekMap.values());
    if (weeks.length > 0) weeks[weeks.length - 1].isCurrent = true;

    // Detecção de anomalias: dia atual > 20% acima da média das semanas anteriores
    const anomalies: Partial<Record<DayLabel, boolean>> = {};
    if (weeks.length >= 2) {
      const current = weeks[weeks.length - 1];
      const prev = weeks.slice(0, -1);

      for (const day of DAY_LABELS) {
        const val = current.days[day];
        if (val === undefined) continue;

        const prevVals = prev
          .filter((w) => w.days[day] !== undefined)
          .map((w) => w.days[day] as number);

        if (prevVals.length === 0) continue;

        const avg = prevVals.reduce((a, b) => a + b, 0) / prevVals.length;
        anomalies[day] = val > avg * 1.2;
      }
    }

    return NextResponse.json<WeeklyProtocolsResponse>({ ok: true, weeks, equipes, anomalies });
  } catch (error) {
    return NextResponse.json<WeeklyProtocolsResponse>(
      { ok: false, error: error instanceof Error ? error.message : 'Erro na query.' },
      { status: 500 },
    );
  }
}
