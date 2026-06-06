# Reescreve os specifiers de import "@/..." apos a reorganizacao de pastas.
# Uso (a partir da raiz do repo):
#   find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -print0 \
#     | xargs -0 perl -0777 -i -p scripts/reorg-imports.pl
#
# -0777 = le cada arquivo como UM registro (slurp);  -p = loop com auto-print;  -i = edita no lugar.
# So substitui quando o specifier vem seguido de aspas ('  "  ou `), evitando casar prefixos
# (ex.: @/lib/ai nao casa @/lib/ai-providers).
BEGIN {
  our %m = (
    '@/lib/supabase'                       => '@/infrastructure/supabase/supabase',
    '@/lib/evolution-api'                  => '@/infrastructure/evolution/evolution-api',
    '@/lib/zabbix'                         => '@/infrastructure/zabbix/zabbix',
    '@/lib/outlook'                        => '@/infrastructure/outlook/outlook',
    '@/lib/google-drive'                   => '@/infrastructure/google-drive/google-drive',
    '@/lib/bookstack'                      => '@/infrastructure/bookstack/bookstack',
    '@/lib/tts'                            => '@/infrastructure/ai/tts',
    '@/lib/ai-providers'                   => '@/infrastructure/ai/ai-providers',
    '@/lib/ai'                             => '@/infrastructure/ai/ai',
    '@/lib/csat'                           => '@/modules/datalake/application/csat',
    '@/lib/datalake-semantics'             => '@/modules/datalake/application/datalake-semantics',
    '@/lib/dashboard-widget-intelligence' => '@/modules/datalake/application/dashboard-widget-intelligence',
    '@/lib/rag-agent'                      => '@/modules/rag/application/rag-agent',
    '@/lib/rag'                            => '@/modules/rag/application/rag',
    '@/lib/evolution-bot'                  => '@/modules/communication/application/evolution-bot',
    '@/lib/waMonitor'                      => '@/modules/communication/application/waMonitor',
    '@/lib/waGroups'                       => '@/modules/communication/application/waGroups',
    '@/lib/bot-registry'                   => '@/modules/communication/application/bot-registry',
    '@/lib/pending-audio'                  => '@/modules/communication/application/pending-audio',
    '@/lib/phone-email-registry'           => '@/modules/communication/application/phone-email-registry',
    '@/lib/netmeet-whatsapp'               => '@/modules/netmeet/application/netmeet-whatsapp',
    '@/modules/netmeet/storage'            => '@/modules/netmeet/application/storage',
    '@/modules/netmeet/insights'           => '@/modules/netmeet/application/insights',
  );
  our $re = join '|', map { quotemeta } sort { length($b) <=> length($a) } keys %m;
}
s/($main::re)(["'`])/$main::m{$1}$2/g;
