# G4OS — Business OS (Hub NetTurbo)

Hub interno white-label da NetTurbo: um painel único que reúne assistente de IA, monitoramento (Zabbix/NOC), comunicação omnichannel (WhatsApp via Evolution API + Outlook), dashboards de BI sobre um DataLake MySQL, RAG sobre documentos e o NetMeet (atas de reunião por áudio de WhatsApp).

> `package.json` ainda usa o nome interno `hub-netturbo-reestruturacao`. A marca exibida (`G4OS` / `Business OS`) vem das envs `NEXT_PUBLIC_*` — ver [Marca / white-label](#marca--white-label).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Linguagem | TypeScript 5 |
| Autenticação | NextAuth v5 (beta) — Microsoft Entra ID |
| Banco operacional + BI | MySQL (`mysql2`) |
| Dados de runtime / sessões | Supabase |
| IA / LLM | LangChain + OpenAI, Google Gemini, Groq/NVIDIA/OpenRouter (cascata de provedores) |
| Vetorial / RAG | Pinecone, Google Drive, BookStack |
| Estado (cliente) | Redux Toolkit + React-Redux |
| UI | Tailwind CSS 4, Recharts, Framer Motion, lucide-react |
| Validação | Zod |
| Testes | Vitest |

## Como rodar

Pré-requisitos: Node 20+ e um arquivo `.env` (copie de `.env.example` e preencha).

```bash
npm install          # instala dependências
cp .env.example .env # configure as variáveis (ver abaixo)
npm run build        # build de produção (next build)
npm start            # sobe em http://localhost:4200
```

Para desenvolvimento, o padrão do Next é `next dev`. Veja a nota em [Scripts](#scripts) — alguns scripts atuais apontam para arquivos que não existem no repositório.

## Variáveis de ambiente

Todas estão documentadas em `.env.example`. As principais:

| Grupo | Variáveis | Para quê |
| --- | --- | --- |
| LLM | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY` | Cascata de provedores de IA |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`, `SUPERADMIN_EMAILS` | Login corporativo via Entra ID |
| MySQL | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Banco operacional + DataLake de BI |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Sessões, registros de runtime |
| Google Drive (RAG) | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Busca de documentos sob demanda |
| WhatsApp | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` | Integração via Evolution API |
| Outlook | `OUTLOOK_*` / Entra ID | E-mail omnichannel |
| Zabbix | `ZABBIX_*` | Monitoramento de infraestrutura |
| Marca | `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_SUBTITLE`, `NEXT_PUBLIC_BRAND_*` | White-label |

`.env*` está no `.gitignore` — **nunca** versione segredos.

## Scripts

```bash
npm run build       # next build              ✅ funciona
npm start           # next start -p 4200      ✅ funciona
npm run lint        # eslint                  ✅ funciona
npm run typecheck   # tsc --noEmit            ✅ funciona
npm test            # vitest run              ✅ funciona
npm run test:watch  # vitest                  ✅ funciona
```

> ⚠️ **Scripts quebrados.** Os seguintes apontam para arquivos que **não existem** em `scripts/` (ou para a pasta inexistente `08 - IA COMUNICACAO/`): `setup`, `dev`, `dev:wasm`, `build:wasm`, `smoke:parallel`, `wa-bridge`, `wa-bridge:install`, `wa-daily-summary`. Veja `docs/REORG-GUIDE.md` para a correção sugerida (incluindo trocar `dev` por `next dev -p 4200`).

## Arquitetura

Visão completa em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e o índice rota→módulo em [`docs/MODULES.md`](docs/MODULES.md).

Resumo do fluxo:

```
src/app/(rotas + api)  →  src/modules/<x>/application (casos de uso)
                              ├─ src/infrastructure  (clients externos: MySQL, AI, Supabase…)
                              ├─ src/lib             (config + utilitários: auth, env, marca)
                              └─ src/shared          (tipos + schemas compartilhados)
```

## Marca / white-label

Identidade visual e textual saem de `src/lib/brand.ts`, alimentado por envs `NEXT_PUBLIC_*`. Para revender com outra marca, basta sobrescrever essas variáveis — sem tocar no código. Cores podem ser regeradas com `node scripts/rebrand-colors.mjs`.
