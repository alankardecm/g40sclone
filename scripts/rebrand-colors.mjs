/**
 * Rebrand de cores: NetTurbo/G4 (verde + branco/claro) → AM OS (dark azul tech).
 * Aplica só nas telas legadas; pula os arquivos já criados na nova identidade.
 *
 * Uso: node scripts/rebrand-colors.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = 'src';

// Arquivos já no padrão novo — NÃO mexer.
const SKIP = [
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/components/Sidebar.tsx',
  'src/components/brand/Logo.tsx',
  'src/app/auth/signin/page.tsx',
  'src/lib/brand.ts',
  'src/lib/modules.ts',
].map((p) => p.split('/').join(sep));
const SKIP_DIRS = ['em-breve'];

// 1) Hexes (case-insensitive, em qualquer contexto: style, charts, classes arbitrárias)
const HEX = [
  // Verdes G4/NetTurbo → azul/ciano
  ['8DC63F', '3B82F6'], ['7AB030', '2563EB'], ['ACD000', '22D3EE'],
  ['749202', '2563EB'], ['365003', '1E2740'], ['EDF5DA', '15233F'],
  ['E8F5C8', '15233F'], ['001B00', '101728'], ['000D00', '0A0F1E'],
  ['001100', '0A0F1E'], ['364F03', '1E2740'],
  // Cinza NetTurbo → texto claro / overlays
  ['404040', 'E6EAF3'],
];

// 2) Classes Tailwind claras → tokens dark (com fronteira de classe)
const CLASS = {
  // fundos
  'bg-white': 'bg-card',
  'bg-gray-50': 'bg-background', 'bg-stone-50': 'bg-background', 'bg-slate-50': 'bg-background',
  'bg-gray-100': 'bg-muted', 'bg-gray-200': 'bg-muted',
  'bg-stone-100': 'bg-muted', 'bg-stone-200': 'bg-muted', 'bg-slate-100': 'bg-muted',
  // bordas / divisores / ring
  'border-gray-100': 'border-border', 'border-gray-200': 'border-border', 'border-gray-300': 'border-border',
  'border-stone-100': 'border-border', 'border-stone-200': 'border-border', 'border-stone-300': 'border-border',
  'divide-gray-100': 'divide-border', 'divide-gray-200': 'divide-border',
  'divide-stone-100': 'divide-border', 'divide-stone-200': 'divide-border',
  'ring-gray-200': 'ring-border', 'ring-stone-200': 'ring-border',
  // textos fortes → foreground
  'text-gray-900': 'text-foreground', 'text-gray-800': 'text-foreground', 'text-gray-700': 'text-foreground',
  'text-stone-900': 'text-foreground', 'text-stone-800': 'text-foreground', 'text-stone-700': 'text-foreground',
  'text-slate-900': 'text-foreground', 'text-slate-800': 'text-foreground',
  // textos suaves → muted-foreground
  'text-gray-600': 'text-muted-foreground', 'text-gray-500': 'text-muted-foreground', 'text-gray-400': 'text-muted-foreground',
  'text-stone-600': 'text-muted-foreground', 'text-stone-500': 'text-muted-foreground', 'text-stone-400': 'text-muted-foreground',
  'text-slate-600': 'text-muted-foreground', 'text-slate-500': 'text-muted-foreground',
};

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const classRules = Object.entries(CLASS).map(([from, to]) => [
  new RegExp(`(?<![\\w-])${escapeRe(from)}(?![\\w-])`, 'g'), to,
]);
const hexRules = HEX.map(([from, to]) => [new RegExp(from, 'gi'), to]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.includes(name) || name === 'node_modules' || name.startsWith('_backup')) continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

let changed = 0, totalHits = 0;
for (const file of walk(ROOT)) {
  if (SKIP.includes(file)) continue;
  const orig = readFileSync(file, 'utf8');
  let next = orig, hits = 0;
  for (const [re, to] of classRules) next = next.replace(re, () => { hits++; return to; });
  for (const [re, to] of hexRules)   next = next.replace(re, () => { hits++; return to; });
  if (next !== orig) {
    writeFileSync(file, next, 'utf8');
    changed++; totalHits += hits;
    console.log(`  ${file} — ${hits} trocas`);
  }
}
console.log(`\n✔ ${changed} arquivos atualizados, ${totalHits} trocas no total.`);
