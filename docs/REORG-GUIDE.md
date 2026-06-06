# Guia de Reorganização e Limpeza — G4OS

Este guia reúne a refatoração de arquitetura, a correção do `package.json` e a limpeza de arquivos órfãos. **Rode tudo localmente, no terminal, com o `next dev` e o editor fechados na pasta** — assim o Git move e apaga arquivos sem travar.

---

## 1. Reorganização da arquitetura (lib → infrastructure / modules / shared)

A motivação está em [`ARCHITECTURE.md` → Inconsistências conhecidas](ARCHITECTURE.md#inconsistências-conhecidas). O resumo dos movimentos:

**Para `src/infrastructure/` (clients de serviços externos):**
`supabase`, `evolution-api`, `zabbix`, `outlook`, `google-drive`, `bookstack` (cada um em sua subpasta), e `ai`, `ai-providers`, `tts` → `infrastructure/ai/`.

**Para `src/modules/<dominio>/application/` (regra de negócio):**

| Arquivo (origem em `lib/`) | Destino |
| --- | --- |
| `csat`, `datalake-semantics`, `dashboard-widget-intelligence` | `modules/datalake/application/` |
| `rag`, `rag-agent` | `modules/rag/application/` |
| `evolution-bot`, `waMonitor`, `waGroups`, `bot-registry`, `pending-audio`, `phone-email-registry` | `modules/communication/application/` |
| `netmeet-whatsapp` | `modules/netmeet/application/` |

**Padronização do netmeet:** `modules/netmeet/{storage,insights}.ts` → `modules/netmeet/application/`.

**Unificação de tipos:** `src/types/next-auth.d.ts` → `src/shared/types/`. A pasta `src/types/` deixa de existir.

**Permanece em `src/lib/`** (config + utilitário transversal): `auth`, `auth.config`, `user-pages`, `user-registry`, `env`, `brand`, `modules`, `dashboard-cors`.

### Como executar

```bash
bash scripts/reorg-architecture.sh
```

O script usa `git mv -f` (preserva histórico) e depois reescreve **todos** os imports `@/...` via `scripts/reorg-imports.pl`. Foi testado numa cópia limpa do código: 68 imports resolvidos, 0 quebrados, nenhuma linha perdida. Ao final:

```bash
npm run typecheck   # esperado: sem erros
npm run build
git add -A && git commit -m "refactor: reorganiza arquitetura (lib -> infrastructure/modules/shared)"
```

Para desfazer a qualquer momento antes do commit: `git reset --hard`.

> **Nota sobre arquivos `export {}` vazios.** Se você abrir o projeto e encontrar arquivos vazios contendo apenas `export {};` em `src/infrastructure/...` e `src/modules/.../application/...`, eles são placeholders deixados por uma tentativa anterior de reorganização (o ambiente em que rodou não conseguia apagar arquivos). O `reorg-architecture.sh` **sobrescreve** todos eles com o conteúdo real (via `git mv -f`), então rodar o script já resolve. Se decidir **não** rodar o script, apague-os:
> ```bash
> grep -rlx "export {};" src | xargs rm -f
> grep -rlx "module.exports = {};" src | xargs rm -f
> ```

---

## 2. Correção dos scripts do `package.json`

Os scripts abaixo apontam para arquivos que **não existem** no repositório (`scripts/*.mjs`) ou para a pasta inexistente `08 - IA COMUNICACAO/`. Rodá-los falha hoje. Substitua o bloco `"scripts"` por (ajuste conforme o que de fato existir na sua máquina):

```jsonc
"scripts": {
  "dev": "next dev -p 4200",
  "build": "next build",
  "start": "next start -p 4200",
  "lint": "eslint",
  "typecheck": "tsc --noEmit --pretty false",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Removidos por apontarem para arquivos ausentes: `setup`, `dev:wasm`, `build:wasm`, `start:parallel`, `smoke:parallel`, `wa-bridge`, `wa-bridge:install`, `wa-daily-summary`. Se algum desses scripts `.mjs` existir só localmente (não commitado), restaure o arquivo em `scripts/` em vez de remover a linha.

---

## 3. Remoção de backups e lixo da raiz

O histórico do Git já preserva esses estados — não precisam ficar na árvore:

```bash
rm -rf _backup-fase0-* _backup-rebrand-*
rm -f package.json.bak-*
```

`.next/` é artefato de build e já está no `.gitignore` (pode apagar com `rm -rf .next` quando quiser; o `next build` recria).

---

## 4. Ordem recomendada

```bash
# 1. ponto de partida limpo
git add -A && git commit -m "checkpoint antes da reorg"

# 2. reorganizacao
bash scripts/reorg-architecture.sh
npm run typecheck && npm run build

# 3. limpeza
rm -rf _backup-fase0-* _backup-rebrand-* && rm -f package.json.bak-*
#    edite o package.json conforme a secao 2

# 4. commit final
git add -A && git commit -m "chore: limpeza + correcao de scripts"
```
