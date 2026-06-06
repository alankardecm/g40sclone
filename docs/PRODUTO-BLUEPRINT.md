# Blueprint de Produto — OS de IA para PMEs e Provedores (ISPs)

> Documento técnico-estratégico. Define posicionamento, arquitetura "dois produtos, uma base" e roadmap. Acompanha `ESTRATEGIA-MERCADO.docx` (versão executiva) e `PITCH-DECK.pptx` (apresentação).
> Última atualização: junho/2026.

## 1. Tese em uma frase

O G4 OS é um *wrapper* de produtividade genérico e **assistivo** (sugere). Nós construímos o **OS de IA operacional verticalizado** que se conecta à rede, ao billing e ao WhatsApp do provedor e **executa** — começando pelo nicho de ISPs (onde já temos NOC/Zabbix, WhatsApp e CSAT) e reaproveitando a mesma base para PMEs em geral.

## 2. Contexto: o que é o G4 OS (benchmark de referência)

O G4 (ex-G4 Educação, R$509 mi em 2025, mira R$750 mi em 2026) lançou em **23/03/2026** o **G4 OS**, em parceria com o Viver de IA (Rafael Milagre). É vendido dentro do pacote "G4 Implementação de IA" (estimado em **>R$15 mil**, acesso ao OS por 3 meses + mentoria + comunidade).

O que o G4 OS **é**: plataforma web proprietária, *wrapper* sobre modelos Microsoft/Azure OpenAI, com dashboards de gestão (linguagem natural), prompts guiados, **playbooks** (metodologias internas do G4 traduzidas em fluxos de IA: vendas, financeiro, RH, operações), 50+ soluções prontas, e uma IA alimentada com contexto de ~87 mil médias empresas brasileiras.

O que o G4 OS **não** faz (declarado): não executa código/deploy, não envia WhatsApp automaticamente, não cria sites/dashboards do zero, **não é agente autônomo**, e o acesso é limitado a 3 meses (lock-in/renovação).

Como o próprio G4 usa internamente: eficiência operacional — ex. time de audiovisual automatizando geração de centenas de variações de vídeo (transcrição Whisper, legendas, cortes) que antes consumiam horas; meta de **triplicar a empresa sem aumentar as 450 cadeiras** do escritório, via IA. Essa é a analogia central do nosso produto para o provedor: usar IA para escalar operação sem inflar custo.

## 3. Análise de mercado

### 3.1 O nicho de ouro: pequenos ISPs

Dados do setor (2026): há cerca de **11,8 mil ISPs ativos** (20 mil+ registrados) e **~90% têm menos de 5 mil clientes** — exatamente o público que nenhum produto "premium" atende bem. ISPs regionais já detêm **64,1% da banda larga fixa**; em 1.041 cidades passam de 80% de share. Cerca de **42% operam em um único município**, 40% em até 5 cidades, e dois terços atendem áreas rurais.

O mercado **desacelerou em 2026** (≈3% de crescimento YoY em janeiro, -1% no mês), o que desloca a prioridade de "captar" para **reter e operar com eficiência** — terreno ideal para um OS de IA.

Dores concretas e quantificadas:

| Dor | Magnitude | Onde a IA atua |
| --- | --- | --- |
| Churn (cancelamento) | >20%/ano em provedores regionais; causas: suporte ineficaz, atrito no atendimento, oferta concorrente | Previsão de churn, atendimento proativo, CSAT |
| Inadimplência | >8% em alguns períodos; recorde histórico em 2025-26 | Cobrança empática orientada a dados, régua automatizada |
| Produtividade de campo | Técnico faz ~4 visitas/dia podendo fazer 7 (agendamento, no-show, retrabalho) | Otimização de agenda, confirmação automática |
| Atendimento | WhatsApp é o canal central; alta demanda por suporte imediato | Agente de suporte/triagem no WhatsApp |
| Retenção | +5% de retenção ⇒ +25% a +95% de lucro | Tudo acima combinado |

### 3.2 Concorrência no software de ISP

Os ERPs do setor — **IXC Soft** (líder, ERP completo), **SGP**, **Voalle** (BI + vendas), **HubSoft** (web+mobile, foco PME) — resolvem billing, CRM, rede e OLTs. **Nenhum se posiciona como camada de IA operacional.** Essa é a lacuna: não competimos com o ERP, sentamos **em cima** dele.

### 3.3 Mercado de IA para PMEs

Validado pelo próprio G4: ao apostar todas as fichas em IA, sinalizou que a demanda é real. Mas a oferta dominante é cara, assistiva e genérica. Há espaço para uma alternativa **acessível, agêntica e verticalizada**.

## 4. Benchmark: G4 OS vs. nosso projeto

| Dimensão | G4 OS | Nosso OS (NetTurbo) |
| --- | --- | --- |
| Natureza | Wrapper assistivo (sugere) | Agêntico (executa, com aprovação) |
| Vertical | Genérico (qualquer PME) | Verticalizado em ISP, depois PME |
| Rede / NOC | — | Zabbix, correlação de eventos, copilot de NOC |
| WhatsApp | Não envia automaticamente | Evolution API: atende, responde, cobra |
| Dados operacionais | Não acessa o sistema do cliente | DataLake MySQL + billing + CSAT do próprio provedor |
| Modelo de IA | Wrapper Azure/OpenAI | Cascata multi-provedor (NVIDIA→Groq→Gemini→OpenRouter→OpenAI) |
| Comercial | Pacote >R$15k, OS por 3 meses | SaaS recorrente, white-label |
| Forças deles | Marca, distribuição, playbooks, comunidade, capital | — |
| Nossas forças | — | Verticalização, execução, dados próprios, custo, white-label |

Leitura honesta: o G4 ganha em **marca, distribuição e capital**; nós ganhamos em **profundidade vertical e execução**. Por isso a estratégia não é competir de frente pelo "PME genérico", e sim **dominar o ISP** e usar essa base para o PME.

## 5. Posicionamento

**"O OS de IA que opera o seu provedor."** Conectado à rede (Zabbix), ao billing (IXC/SGP/Voalle/HubSoft) e ao WhatsApp, ele não só mostra dashboards — ele tria alarmes de NOC, responde e cobra clientes, prevê churn e otimiza a agenda dos técnicos. Para a PME genérica, a mesma base entrega assistente, BI e omnichannel.

## 6. Arquitetura de produto: "dois produtos, uma base"

### 6.1 Núcleo compartilhado (a plataforma)

Camadas que servem aos dois produtos (já existentes no repositório, ver `docs/ARCHITECTURE.md`):

- **AI Gateway** — cascata multi-provedor + RAG + schemas (`infrastructure/ai`, `modules/rag`).
- **DataLake / BI** — ingestão e consulta MySQL, dashboards, assistente de dados (`modules/datalake`).
- **Omnichannel** — WhatsApp (Evolution) + Outlook, sessões, briefings, resumos (`modules/communication`).
- **Assistente conversacional** — `modules/chat`.
- **Identidade & multi-tenant / white-label** — `lib/auth`, `lib/brand`, permissões por página.
- **Camada de agentes** — orquestração de ações com aprovação humana (a evoluir).

### 6.2 Pacote A — OS para ISP (vertical, prioridade)

| Capacidade | Status no repo | Gap a construir |
| --- | --- | --- |
| Copilot de NOC (Zabbix, correlação) | ✅ `modules/monitoring`, `modules/zabbix` | Ações guiadas (abrir chamado, escalar) |
| Suporte/vendas no WhatsApp | ✅ `modules/communication` (Evolution, bot) | Playbooks de atendimento ISP |
| CSAT / pesquisa de satisfação | ✅ `lib/csat` (KPI replicado do Power BI) | Loop proativo de retenção |
| Protocolos / chamados | ✅ dashboard `protocolos` | Integração com ERP |
| Previsão de churn | ⚠️ dados existem (DataLake) | Modelo + alertas |
| Cobrança / inadimplência | ⚠️ parcial | Régua de cobrança empática automatizada |
| Otimização de agenda de campo | ❌ | Roteirização + confirmação automática |
| Conectores ERP ISP (IXC/SGP/Voalle/HubSoft) | ❌ | Integrações nativas |

### 6.3 Pacote B — OS para PME (horizontal)

Reaproveita o núcleo: assistente conversacional, dashboards de BI, RAG sobre documentos, omnichannel (WhatsApp/Outlook), produtividade (NetMeet — atas por áudio), e uma camada de **playbooks setoriais** (a construir, espelhando o conceito do G4: vendas, financeiro, RH, operações).

## 7. Gaps prioritários (o que falta para a visão)

1. **Conectores ERP de ISP** (IXC, SGP, Voalle, HubSoft) — sem isso não há dado de billing/cliente.
2. **Motor de churn + inadimplência** sobre o DataLake.
3. **Otimização de agenda de campo** (4→7 visitas/dia).
4. **Camada de playbooks** reutilizável (o ativo que dá ao G4 seu fosso).
5. **Multi-tenant + billing SaaS** robusto (white-label por provedor/PME).
6. **Framework de agentes com aprovação** (executar ações com trilha de auditoria).

## 8. Roadmap sugerido

- **Fase 1 — MVP ISP (0-3 meses):** 1 conector ERP (ex. IXC ou SGP) + copilot de NOC + agente de suporte WhatsApp + dashboard de churn/CSAT. Piloto com 1-3 provedores.
- **Fase 2 — Retenção & cobrança (3-6 meses):** motor de churn, régua de inadimplência, otimização de agenda. Métrica-norte: churn e inadimplência do piloto.
- **Fase 3 — Plataforma (6-9 meses):** multi-tenant white-label, billing SaaS, mais conectores ERP, camada de playbooks.
- **Fase 4 — Expansão PME (9-12 meses):** empacotar o núcleo como produto horizontal com playbooks setoriais.

## 9. Modelo de negócio

SaaS recorrente (mensal/anual) — contraponto ao pacote caro e de 3 meses do G4. Possível tier por número de clientes do ISP (alinha preço ao valor e ao porte). Onboarding assistido + comunidade de provedores como retenção. Para PME, planos por assento/uso.

## 10. Riscos e mitigação

- **Distribuição e marca** (vs. máquina de marketing do G4): mitigar com foco vertical, casos de ROI mensurável (churn/inadimplência) e parcerias no ecossistema ISP (eventos como ISP Meeting).
- **Dependência de LLMs de terceiros:** já mitigado pela cascata multi-provedor.
- **Integração com ERPs:** começar por 1-2 com API aberta; tratar como diferencial, não commodity.
- **Foco:** resistir a virar "PME genérico" cedo demais; o ISP é a cunha.

## 11. Fontes

Ver seção de fontes no documento executivo (`ESTRATEGIA-MERCADO.docx`) e nas mensagens da pesquisa: dados de mercado de ISP (NIC.br, TI Inside, VCX), dores (Alloyal, 2Safe, Evolux, Maxbot), e G4 OS (Agência Café Online, G4 Business, Startups, NeoFeed).
