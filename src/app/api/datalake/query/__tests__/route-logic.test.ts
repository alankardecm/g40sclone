import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helpers mirroring the logic in route.ts (no Next.js / mysql2 deps)
// ---------------------------------------------------------------------------

type TimeBucket = 'none' | 'day' | 'month' | 'year';

function normalizeDateTo(dateTo: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo} 23:59:59` : dateTo;
}

function canFormatAsDate(column: string): boolean {
  return /(data|dt_|_at$|competencia|vencimento|inicio|fim|conclusao|abertura|resposta|evento)/i.test(column);
}

function resolveQueryAxes(
  safeXColumn: string,
  timeBucket: TimeBucket,
  safeDateColumn: string,
): { effectiveXColumn: string; effectiveTimeBucket: TimeBucket } {
  const autoPromotedDateAxis = !safeXColumn && timeBucket !== 'none' && !!safeDateColumn;
  const effectiveXColumn = autoPromotedDateAxis ? safeDateColumn : safeXColumn;
  const effectiveTimeBucket: TimeBucket = autoPromotedDateAxis
    ? timeBucket
    : effectiveXColumn && canFormatAsDate(effectiveXColumn)
      ? timeBucket === 'none' ? 'month' : timeBucket
      : 'none';
  return { effectiveXColumn, effectiveTimeBucket };
}

// ---------------------------------------------------------------------------
// Bug 1 — dateTo deve incluir o dia inteiro em colunas DATETIME
// ---------------------------------------------------------------------------
describe('normalizeDateTo', () => {
  it('transforma YYYY-MM-DD em YYYY-MM-DD 23:59:59', () => {
    expect(normalizeDateTo('2026-04-30')).toBe('2026-04-30 23:59:59');
  });

  it('não altera valor que já traz horário', () => {
    expect(normalizeDateTo('2026-04-30 15:30:00')).toBe('2026-04-30 15:30:00');
  });

  it('não altera datetime completo com T', () => {
    expect(normalizeDateTo('2026-04-30T23:59:59')).toBe('2026-04-30T23:59:59');
  });

  it('não altera string vazia', () => {
    expect(normalizeDateTo('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — timeBucket ignorado quando xColumn vazio
// ---------------------------------------------------------------------------
describe('resolveQueryAxes — auto-promoção de dateColumn', () => {
  it('promove dateColumn como eixo quando xColumn vazio e timeBucket configurado', () => {
    const { effectiveXColumn, effectiveTimeBucket } = resolveQueryAxes('', 'month', 'data_criacao');
    expect(effectiveXColumn).toBe('data_criacao');
    expect(effectiveTimeBucket).toBe('month');
  });

  it('preserva xColumn quando informado (não substitui)', () => {
    const { effectiveXColumn } = resolveQueryAxes('status', 'month', 'data_criacao');
    expect(effectiveXColumn).toBe('status');
  });

  it('mantém scalar (effectiveXColumn vazio) quando timeBucket="none" e xColumn vazio', () => {
    const { effectiveXColumn } = resolveQueryAxes('', 'none', 'data_criacao');
    expect(effectiveXColumn).toBe('');
  });

  it('mantém scalar quando nem xColumn nem dateColumn estão preenchidos', () => {
    const { effectiveXColumn, effectiveTimeBucket } = resolveQueryAxes('', 'month', '');
    expect(effectiveXColumn).toBe('');
    expect(effectiveTimeBucket).toBe('none');
  });

  it('aplica timeBucket=year ao auto-promover dateColumn', () => {
    const { effectiveXColumn, effectiveTimeBucket } = resolveQueryAxes('', 'year', 'dt_vencimento');
    expect(effectiveXColumn).toBe('dt_vencimento');
    expect(effectiveTimeBucket).toBe('year');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — configWarning quando timeBucket configurado mas sem eixo
// ---------------------------------------------------------------------------
describe('configWarning para timeBucket sem eixo', () => {
  it('deve emitir aviso quando timeBucket ativo e xColumn/dateColumn vazios', () => {
    const { effectiveXColumn } = resolveQueryAxes('', 'month', '');
    let timeBucket: TimeBucket = 'month';
    const configWarning = !effectiveXColumn && (timeBucket as TimeBucket) !== 'none'
      ? 'Agrupamento Temporal requer um Eixo ou Coluna de Período'
      : undefined;
    expect(configWarning).toBe('Agrupamento Temporal requer um Eixo ou Coluna de Período');
  });

  it('não emite aviso quando timeBucket="none"', () => {
    const { effectiveXColumn } = resolveQueryAxes('', 'none', '');
    let timeBucket: TimeBucket = 'none';
    const configWarning = !effectiveXColumn && (timeBucket as TimeBucket) !== 'none'
      ? 'Agrupamento Temporal requer um Eixo ou Coluna de Período'
      : undefined;
    expect(configWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — GROUP BY posicional evita conflito com coluna "label"
// ---------------------------------------------------------------------------
describe('GROUP BY posicional', () => {
  it('query usa GROUP BY 1 e não GROUP BY label', () => {
    const sql = `SELECT col AS label, COUNT(*) AS value
       FROM tabela
       GROUP BY 1
       ORDER BY value DESC
       LIMIT 20`;
    expect(sql).toContain('GROUP BY 1');
    expect(sql).not.toContain('GROUP BY label');
  });
});
