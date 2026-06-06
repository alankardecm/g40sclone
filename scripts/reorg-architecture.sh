#!/usr/bin/env bash
# ============================================================================
#  Reorganizacao da arquitetura do G4OS  (lib -> infrastructure / modules / shared)
# ----------------------------------------------------------------------------
#  RODE LOCALMENTE, com o dev server (next) e o editor FECHADOS na pasta,
#  para que o Git consiga mover/remover arquivos sem travar.
#
#  Pre-requisitos: bash, git, perl.  Execute a partir da RAIZ do repo:
#     bash scripts/reorg-architecture.sh
#
#  Tudo usa "git mv -f", entao o historico de cada arquivo e preservado e voce
#  pode reverter com:  git reset --hard
# ============================================================================
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo ">> Verificando arvore de trabalho..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "AVISO: ha mudancas nao commitadas. Recomendado commitar/stashar antes."
  read -p "Continuar mesmo assim? [y/N] " a; [ "$a" = "y" ] || exit 1
fi

echo ">> Criando diretorios de destino..."
mkdir -p src/infrastructure/{supabase,evolution,zabbix,outlook,google-drive,bookstack} \
         src/modules/datalake/application src/modules/rag/application \
         src/modules/communication/application src/modules/netmeet/application

echo ">> Movendo arquivos (git mv -f)..."
moves=(
  "src/lib/supabase.ts:src/infrastructure/supabase/supabase.ts"
  "src/lib/evolution-api.ts:src/infrastructure/evolution/evolution-api.ts"
  "src/lib/zabbix.ts:src/infrastructure/zabbix/zabbix.ts"
  "src/lib/outlook.ts:src/infrastructure/outlook/outlook.ts"
  "src/lib/google-drive.ts:src/infrastructure/google-drive/google-drive.ts"
  "src/lib/bookstack.ts:src/infrastructure/bookstack/bookstack.ts"
  "src/lib/tts.ts:src/infrastructure/ai/tts.ts"
  "src/lib/ai.ts:src/infrastructure/ai/ai.ts"
  "src/lib/ai-providers.ts:src/infrastructure/ai/ai-providers.ts"
  "src/lib/csat.ts:src/modules/datalake/application/csat.ts"
  "src/lib/datalake-semantics.ts:src/modules/datalake/application/datalake-semantics.ts"
  "src/lib/dashboard-widget-intelligence.ts:src/modules/datalake/application/dashboard-widget-intelligence.ts"
  "src/lib/rag.ts:src/modules/rag/application/rag.ts"
  "src/lib/rag-agent.ts:src/modules/rag/application/rag-agent.ts"
  "src/lib/evolution-bot.ts:src/modules/communication/application/evolution-bot.ts"
  "src/lib/waMonitor.ts:src/modules/communication/application/waMonitor.ts"
  "src/lib/waGroups.js:src/modules/communication/application/waGroups.js"
  "src/lib/bot-registry.ts:src/modules/communication/application/bot-registry.ts"
  "src/lib/pending-audio.ts:src/modules/communication/application/pending-audio.ts"
  "src/lib/phone-email-registry.ts:src/modules/communication/application/phone-email-registry.ts"
  "src/lib/netmeet-whatsapp.ts:src/modules/netmeet/application/netmeet-whatsapp.ts"
  "src/modules/netmeet/storage.ts:src/modules/netmeet/application/storage.ts"
  "src/modules/netmeet/insights.ts:src/modules/netmeet/application/insights.ts"
  "src/types/next-auth.d.ts:src/shared/types/next-auth.d.ts"
)
for pair in "${moves[@]}"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  if [ -f "$src" ]; then git mv -f "$src" "$dst"; echo "   $src -> $dst"; fi
done
rmdir src/types 2>/dev/null || true

echo ">> Reescrevendo imports @/..."
find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -print0 \
  | xargs -0 perl -0777 -i -p scripts/reorg-imports.pl

echo ">> Verificando..."
echo "   @/lib/* remanescentes (esperado APENAS: auth, auth.config, brand, dashboard-cors, env, modules, user-pages, user-registry):"
grep -rhoE "@/lib/[a-zA-Z0-9_.-]+" src --include=*.ts --include=*.tsx --include=*.js | sort -u | sed 's/^/     /'

echo ""
echo ">> Pronto. Agora rode:"
echo "     npm run typecheck   # deve passar sem erros"
echo "     npm run build"
echo "   Se tudo ok:  git add -A && git commit -m 'refactor: reorganiza arquitetura (lib -> infrastructure/modules/shared)'"
echo "   Se algo der errado:  git reset --hard   (desfaz tudo)"
