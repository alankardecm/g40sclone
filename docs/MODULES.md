# Índice de Módulos e Rotas — G4OS

Mapa de "onde está o quê". Para cada área do produto: a rota de UI, os endpoints de API e o módulo de domínio que concentra a lógica.

## Páginas (UI)

| Rota | Área |
| --- | --- |
| `/` | Home / landing do hub |
| `/auth/signin` | Login (Entra ID) |
| `/access-denied` | Bloqueio de acesso |
| `/chat` | Assistente de IA |
| `/dashboard` + `/dashboard/{alertas,commercial,comunicacao,custos,funter,netmeet,noc,protocolos,status,whatsapp}` | Dashboards operacionais |
| `/dashboards`, `/dashboards/avancado`, `/dashboards/[id]` | Dashboards de BI (DataLake) |
| `/datalake` | Explorador do DataLake |
| `/monitoring`, `/monitoring/{clientes,noc,zabbix}` | Monitoramento / NOC |
| `/rag` | Busca em documentos (RAG) |
| `/settings`, `/settings/users` | Configurações e gestão de usuários |
| `/em-breve/[modulo]` | Placeholder de módulos futuros |

## Endpoints de API → Módulo de domínio

| Endpoint (`src/app/api/...`) | Módulo / lógica |
| --- | --- |
| `auth/*` | `lib/auth*` (NextAuth + Entra ID) |
| `admin/users/*`, `admin/tables/*` | `lib/user-registry`, `lib/user-pages` (permissões) |
| `chat/*`, `chat-geral/*` | `modules/chat/application/*` |
| `communications/*` (inbound, omnichannel, outlook) | `modules/communication/application/*` + `infrastructure` (Outlook, Evolution) |
| `evolution/*` | WhatsApp via Evolution API → `modules/communication` |
| `wa-monitor/*` | `modules/communication` (monitor de grupos/sentimento) |
| `netmeet/*` | `modules/netmeet/*` |
| `datalake/*`, `dashboards/*` | `modules/datalake/application/*` + `infrastructure/datalake/mysql-client` |
| `monitoring/*` | `modules/monitoring/application/*` |
| `zabbix/*` | `modules/zabbix/application/*` |
| `costs/*` | Custos de IA (relacionado a `lib/ai-providers`) |
| `rag/*` (via `/rag`) | `modules/rag/application/*` |
| `health/*` | Healthcheck |
| `proxy-image/*` | Proxy de imagens do BookStack |

## Componentes principais (`src/components`)

| Componente | Uso |
| --- | --- |
| `Sidebar.tsx` | Navegação (alimentada por `lib/modules.ts`) |
| `CommandPalette.tsx`, `CommandCenter/` | Paleta de comandos |
| `EnvironmentBanner.tsx` | Indicador de ambiente |
| `SignOutButton.tsx` | Logout |
| `admin/`, `brand/`, `datalake/`, `netmeet/`, `providers/` | Componentes por área |

## Onde fica a lógica de cada domínio

```
modules/chat/application/
  assistant-prompt.ts        → monta o prompt do assistente
  assistant-response.ts      → orquestra a resposta (RAG + Zabbix + LLM)
  conversation-context.ts    → contexto da conversa
  operational-answer.ts      → respostas operacionais
  procedure-answer.ts        → respostas de procedimento

modules/communication/application/
  conversation-brief.ts            persist-inbound-communication.ts
  daily-summary.ts                 wa-conversation-sessions.ts
  load-conversation-cockpit.ts     load-wa-conversation-sessions.ts
  message-analysis.ts

modules/datalake/application/
  overview.ts  dashboard-suggestions.ts  smart-assistant.ts

modules/monitoring/application/  correlation-engine.ts
modules/netmeet/                 insights.ts  storage.ts
modules/rag/application/         build-rag-context.ts
modules/zabbix/application/      build-zabbix-context.ts  build-zabbix-decision-context.ts
```
