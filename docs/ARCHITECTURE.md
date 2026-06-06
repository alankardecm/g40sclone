# Arquitetura — G4OS

## Visão geral

O projeto é um app Next.js 16 (App Router) organizado em camadas inspiradas em arquitetura limpa. A ideia central: **as rotas não contêm regra de negócio** — elas orquestram casos de uso (`modules`), que por sua vez falam com serviços externos (`infrastructure`) e usam tipos/utilitários compartilhados (`shared`, `lib`).

```
┌─────────────────────────────────────────────────────────────┐
│  src/app            Rotas (UI) + src/app/api (endpoints HTTP) │
│                     Camada fina: valida entrada, chama caso   │
│                     de uso, devolve resposta.                 │
├─────────────────────────────────────────────────────────────┤
│  src/modules/<x>/   Casos de uso por domínio (application).   │
│   application       Onde vive a regra de negócio.             │
├──────────────┬────────────────────┬───────────────────────────┤
│ infrastructure│       lib          │         shared            │
│ clients de    │ config + utils     │ tipos + schemas (zod)     │
│ serviços      │ transversais       │ compartilhados            │
│ externos      │ (auth, env, marca) │                           │
└──────────────┴────────────────────┴───────────────────────────┘
```

Alias de import: `@/*` → `src/*` (definido em `tsconfig.json`). Todos os imports internos usam `@/...`.

## Camadas

### `src/app`
Rotas do App Router. Páginas em `src/app/<rota>/page.tsx`; endpoints em `src/app/api/<recurso>/route.ts`. Devem ser finas: autenticação, validação de input (Zod), chamada ao caso de uso correspondente em `modules`, e formatação da resposta. `src/proxy.ts` (Edge) cuida de middleware/roteamento protegido usando `lib/auth.config.ts` (Edge-safe).

### `src/modules/<dominio>/application`
O coração da regra de negócio, um diretório por domínio. Cada arquivo é um caso de uso coeso (ex.: `daily-summary.ts`, `build-rag-context.ts`, `correlation-engine.ts`). Pode depender de `infrastructure`, `shared` e `lib`, mas **não** de `app`.

### `src/infrastructure`
Clients de serviços externos — o "como" técnico, isolado do domínio. Hoje contém:
- `infrastructure/ai/chat-clients.ts` — clients dos LLMs.
- `infrastructure/datalake/mysql-client.ts` — pool MySQL (BI + operacional).

> ⚠️ Vários outros clients de infra ainda moram em `src/lib` (Supabase, Evolution/WhatsApp, Zabbix, Outlook, Google Drive, BookStack, TTS). Ver [Inconsistências conhecidas](#inconsistências-conhecidas).

### `src/lib`
Config e utilitários transversais que não pertencem a um único domínio:
`env.ts` (validação de env com Zod), `auth.ts` / `auth.config.ts` / `user-pages.ts` / `user-registry.ts` (autenticação e permissões), `brand.ts` (white-label), `modules.ts` (navegação), `dashboard-cors.ts` (CORS).

### `src/shared`
Contratos compartilhados entre camadas: `shared/types/*` (tipos de domínio: chat, communication, dashboard, datalake, omnichannel, rag) e `shared/schemas/*` (schemas Zod de IA).

## Domínios (módulos)

| Módulo | Responsabilidade |
| --- | --- |
| `chat` | Assistente de IA: monta prompt, contexto de conversa, respostas operacionais e de procedimento. |
| `communication` | Omnichannel: WhatsApp (Evolution) + Outlook. Briefings de conversa, resumos diários, análise de mensagens, persistência de mensagens inbound, sessões de conversa. |
| `datalake` | BI sobre MySQL: visão geral, sugestões de dashboard, assistente inteligente de dados. |
| `monitoring` | NOC / correlação de eventos de infraestrutura. |
| `netmeet` | Atas de reunião a partir de áudios de WhatsApp (transcrição + insights). |
| `rag` | Contexto de recuperação sobre documentos (Google Drive / BookStack). |
| `zabbix` | Contexto e decisões a partir do Zabbix (problemas, hosts, severidade). |

## Fluxo de uma requisição (exemplo: chat)

```
POST /api/chat                       (src/app/api/chat/route.ts)
   └─ generateAssistantResponse()    (modules/chat/application/assistant-response.ts)
        ├─ buildRagContext()         (modules/rag/...)        → Google Drive / BookStack
        ├─ buildZabbixContext()      (modules/zabbix/...)     → infra Zabbix
        └─ chat-clients              (infrastructure/ai)      → LLM
```

## Convenção de arquitetura (regra para novos arquivos)

1. **`infrastructure/<provider>/`** — qualquer client de serviço externo (DB, API de terceiros, LLM, fila). Sem regra de negócio.
2. **`modules/<dominio>/application/`** — casos de uso. Toda lógica de negócio entra aqui, nomeada pela ação (`load-...`, `build-...`, `summarize-...`).
3. **`shared/`** — tipos e schemas usados por mais de uma camada/módulo. Um único lugar para tipos (não criar `src/types`).
4. **`lib/`** — só config e utilitário puro e transversal (env, auth, marca, helpers HTTP). **Não** colocar client de serviço externo nem regra de domínio aqui.
5. **`app/`** — fino. Sem regra de negócio; delega para `modules`.

## Inconsistências conhecidas

Estado atual que diverge da convenção acima (plano de correção em `docs/REORG-GUIDE.md`):

- **`src/lib` está sobrecarregado**: mistura clients de infra (`supabase`, `evolution-api`, `zabbix`, `outlook`, `google-drive`, `bookstack`, `tts`, `ai`, `ai-providers`) e regra de domínio (`csat`, `rag`, `rag-agent`, `evolution-bot`, `bot-registry`, `pending-audio`, `phone-email-registry`, `waMonitor`, `waGroups`, `datalake-semantics`, `dashboard-widget-intelligence`) junto com a config legítima.
- **`infrastructure` está quase vazio** (2 arquivos) enquanto os demais clients estão no `lib`.
- **`netmeet` quebra o padrão**: `insights.ts`/`storage.ts` na raiz do módulo em vez de `application/`.
- **Dois lugares para tipos**: `src/shared/types` e `src/types`.
- **`src/lib/bookstack.ts` é código morto** (não importado em lugar nenhum).
