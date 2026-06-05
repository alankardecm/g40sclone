export type TimeBucket = 'none' | 'day' | 'month' | 'year';
export type FilterOperator = 'eq' | 'neq' | 'contains' | 'gte' | 'lte' | 'gt' | 'lt';

type TableSemantic = {
  label: string;
  description: string;
  focus: string[];
};

type ColumnSemantic = {
  label: string;
  description?: string;
  category?: 'metric' | 'dimension' | 'time' | 'identifier' | 'status';
};

const TABLE_SEMANTICS: Record<string, TableSemantic> = {
  crm_funter: {
    label: 'CRM Funter',
    description: 'Base comercial do CRM com contratos vendidos, vendedor, valor, status, produto e datas do ciclo.',
    focus: ['vendas', 'vendedor', 'valor', 'status', 'cadastro'],
  },
  crm_clientes: {
    label: 'Clientes',
    description: 'Cadastro de clientes com contato, cidade, status de ativacao e segmentacao.',
    focus: ['clientes', 'cadastro', 'cidade', 'status', 'segmentacao'],
  },
  crm_leads: {
    label: 'Leads',
    description: 'Pipeline de leads com origem, etapa, responsavel e conversao.',
    focus: ['leads', 'conversao', 'origem', 'vendedor', 'funil'],
  },
  crm_oportunidades: {
    label: 'Oportunidades',
    description: 'Oportunidades comerciais em aberto e fechadas com valor esperado e etapa do funil.',
    focus: ['oportunidades', 'valor', 'funil', 'fechamento', 'vendedor'],
  },
  fato_contratos: {
    label: 'Contratos',
    description: 'Base comercial para carteira, ativacoes, cancelamentos, valor e distribuicao geografica.',
    focus: ['carteira', 'ativacao', 'cancelamento', 'cidade', 'ticket'],
  },
  dim_contratos: {
    label: 'Dimensao Contratos',
    description: 'Atributos descritivos de contratos, planos, produtos e modalidades.',
    focus: ['plano', 'produto', 'modalidade', 'tipo', 'contrato'],
  },
  fato_receita: {
    label: 'Receita',
    description: 'Fatos de receita mensal, MRR, expansao, churn e variacoes por periodo.',
    focus: ['mrr', 'receita', 'expansao', 'churn', 'periodo'],
  },
  fato_faturamento: {
    label: 'Faturamento',
    description: 'Registros de faturamento, valores emitidos, inadimplencia e status de pagamento.',
    focus: ['faturamento', 'inadimplencia', 'pagamento', 'valor', 'vencimento'],
  },
  crm_solicitacoes: {
    label: 'Protocolos / Solicitacoes',
    description: 'Base operacional de protocolos e solicitacoes abertas: volume, status, tipo de chamado, fila e carga de atendimento. Use esta tabela para contar protocolos, ver distribuicao por tipo, status ou cidade.',
    focus: ['protocolo', 'solicitacao', 'volume', 'tipo', 'status', 'cliente', 'fila'],
  },
  fato_solicitacoes: {
    label: 'Atendimentos (Fato)',
    description: 'Base analitica de atendimentos para SLA, tempo medio de resolucao, backlog e performance da operacao. Use esta tabela para metricas de atendimento, SLA e evolucao temporal.',
    focus: ['atendimento', 'sla', 'tempo medio', 'backlog', 'status', 'evolucao'],
  },
  dim_solicitacoes: {
    label: 'Dimensao Solicitacoes',
    description: 'Atributos de solicitacoes como tipo, canal de entrada, departamento e prioridade.',
    focus: ['tipo', 'canal', 'departamento', 'prioridade', 'categoria'],
  },
  tickets: {
    label: 'Tickets',
    description: 'Chamados de suporte com historico de status, responsavel e tempo de resolucao.',
    focus: ['tickets', 'status', 'resolucao', 'responsavel', 'sla'],
  },
  noc_eventos: {
    label: 'Eventos NOC',
    description: 'Eventos de monitoramento de rede, alertas, falhas, duracao e host afetado.',
    focus: ['eventos', 'alertas', 'falhas', 'host', 'duracao'],
  },
  noc_alertas: {
    label: 'Alertas NOC',
    description: 'Alertas de infraestrutura com severidade, origem, status de resolucao e impacto.',
    focus: ['alertas', 'severidade', 'host', 'resolucao', 'impacto'],
  },
  zabbix_eventos: {
    label: 'Eventos Zabbix',
    description: 'Eventos coletados do Zabbix com host, trigger, severidade, duracao e status.',
    focus: ['zabbix', 'host', 'trigger', 'severidade', 'disponibilidade'],
  },
  dim_custos: {
    label: 'Custos',
    description: 'Custos por centro de custo, categoria e periodo de competencia.',
    focus: ['custos', 'centro de custo', 'categoria', 'orcamento', 'periodo'],
  },
  fato_custos: {
    label: 'Fato Custos',
    description: 'Custos realizados e orcados por area, periodo e fornecedor.',
    focus: ['custos', 'orcado', 'realizado', 'fornecedor', 'area'],
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Posicao financeira geral, contas a pagar, contas a receber, saldo e fluxo de caixa.',
    focus: ['financeiro', 'caixa', 'pagamentos', 'recebimentos', 'saldo'],
  },
  wa_mensagens: {
    label: 'Mensagens WhatsApp',
    description: 'Mensagens recebidas e enviadas via WhatsApp com grupo, autor e sentimento.',
    focus: ['mensagens', 'grupo', 'sentimento', 'volume', 'canal'],
  },
  wa_grupos: {
    label: 'Grupos WhatsApp',
    description: 'Grupos de WhatsApp monitorados com participantes, atividade e categorizacao.',
    focus: ['grupos', 'participantes', 'atividade', 'categoria', 'whatsapp'],
  },
  comunicacoes: {
    label: 'Comunicacoes',
    description: 'Registro de comunicacoes omnicanal como e-mail, chat, WhatsApp e telefone.',
    focus: ['comunicacoes', 'canal', 'volume', 'resposta', 'sentimento'],
  },
  produtos: {
    label: 'Produtos',
    description: 'Catalogo de produtos e ofertas comerciais disponiveis.',
    focus: ['produto', 'plano', 'preco', 'categoria', 'status'],
  },
  planos: {
    label: 'Planos',
    description: 'Planos comerciais, velocidades, valores e familias de produto.',
    focus: ['plano', 'valor', 'velocidade', 'produto', 'status'],
  },
};

const EXACT_COLUMN_SEMANTICS: Record<string, ColumnSemantic> = {
  id: { label: 'ID', description: 'Identificador tecnico do registro.', category: 'identifier' },
  uuid: { label: 'UUID', description: 'Identificador unico do registro.', category: 'identifier' },
  codigo: { label: 'Codigo', description: 'Codigo de referencia do registro.', category: 'identifier' },
  contrato: { label: 'Contrato', description: 'Identificador ou numero do contrato.', category: 'identifier' },
  id_contrato: { label: 'ID do contrato', description: 'Chave tecnica do contrato.', category: 'identifier' },
  cod_cliente: { label: 'Codigo do cliente', description: 'Identificador comercial do cliente.', category: 'identifier' },
  cod_vendedor: { label: 'Codigo do vendedor', description: 'Identificador comercial do vendedor.', category: 'identifier' },
  cliente: { label: 'Cliente', description: 'Nome ou identificador do cliente.', category: 'dimension' },
  nome: { label: 'Nome', description: 'Nome principal do registro.', category: 'dimension' },
  razao_social: { label: 'Razao social', description: 'Razao social do cliente ou fornecedor.', category: 'dimension' },
  cpf_cnpj: { label: 'CPF/CNPJ', description: 'Documento do cliente ou fornecedor.', category: 'identifier' },
  email: { label: 'E-mail', description: 'Endereco de contato.', category: 'dimension' },
  telefone: { label: 'Telefone', description: 'Numero de contato.', category: 'dimension' },
  cidade: { label: 'Cidade', description: 'Municipio relacionado ao registro.', category: 'dimension' },
  bairro: { label: 'Bairro', description: 'Bairro relacionado ao registro.', category: 'dimension' },
  uf: { label: 'UF', description: 'Estado relacionado ao registro.', category: 'dimension' },
  vendedor: { label: 'Vendedor', description: 'Responsavel comercial.', category: 'dimension' },
  vendedor_1: { label: 'Vendedor 1', description: 'Responsavel comercial principal da venda.', category: 'dimension' },
  responsavel: { label: 'Responsavel', description: 'Pessoa responsavel pelo registro.', category: 'dimension' },
  equipe: { label: 'Equipe', description: 'Equipe responsavel pelo atendimento ou operacao.', category: 'dimension' },
  fila: { label: 'Fila', description: 'Fila operacional de atendimento.', category: 'dimension' },
  departamento: { label: 'Departamento', description: 'Departamento relacionado ao registro.', category: 'dimension' },
  area: { label: 'Area', description: 'Area de negocio relacionada ao registro.', category: 'dimension' },
  status: { label: 'Status', description: 'Situacao atual do registro.', category: 'status' },
  situacao: { label: 'Situacao', description: 'Situacao atual do registro.', category: 'status' },
  estagio: { label: 'Estagio', description: 'Etapa comercial ou operacional.', category: 'status' },
  prioridade: { label: 'Prioridade', description: 'Prioridade de tratamento.', category: 'status' },
  severidade: { label: 'Severidade', description: 'Nivel de criticidade do evento.', category: 'status' },
  canal: { label: 'Canal', description: 'Canal de entrada ou atendimento.', category: 'dimension' },
  origem: { label: 'Origem', description: 'Origem do lead, contato ou evento.', category: 'dimension' },
  categoria: { label: 'Categoria', description: 'Categoria principal do registro.', category: 'dimension' },
  tipo: { label: 'Tipo', description: 'Classificacao principal do registro.', category: 'dimension' },
  servico: { label: 'Servico', description: 'Servico contratado ou solicitado.', category: 'dimension' },
  plano: { label: 'Plano', description: 'Plano comercial do contrato.', category: 'dimension' },
  produto: { label: 'Produto', description: 'Produto ou pacote comercial vendido.', category: 'dimension' },
  host: { label: 'Host', description: 'Equipamento ou host monitorado.', category: 'dimension' },
  trigger: { label: 'Trigger', description: 'Regra ou alerta que disparou o evento.', category: 'dimension' },
  grupo: { label: 'Grupo', description: 'Grupo ou comunidade relacionada.', category: 'dimension' },
  autor: { label: 'Autor', description: 'Pessoa que enviou ou criou o registro.', category: 'dimension' },
  sentimento: { label: 'Sentimento', description: 'Classificacao de sentimento da mensagem.', category: 'status' },
  valor: { label: 'Valor', description: 'Valor financeiro do registro.', category: 'metric' },
  valor_total: { label: 'Valor total', description: 'Valor financeiro total.', category: 'metric' },
  valor_formatado: { label: 'Valor formatado', description: 'Representacao textual do valor financeiro.', category: 'metric' },
  receita: { label: 'Receita', description: 'Valor monetario da operacao.', category: 'metric' },
  faturamento: { label: 'Faturamento', description: 'Valor faturado no periodo.', category: 'metric' },
  custo: { label: 'Custo', description: 'Valor de custo associado ao registro.', category: 'metric' },
  ticket: { label: 'Ticket', description: 'Ticket medio ou valor unitario.', category: 'metric' },
  preco: { label: 'Preco', description: 'Preco do produto, plano ou item.', category: 'metric' },
  quantidade: { label: 'Quantidade', description: 'Volume numerico.', category: 'metric' },
  qtd: { label: 'Quantidade', description: 'Volume numerico.', category: 'metric' },
  total: { label: 'Total', description: 'Total calculado do registro.', category: 'metric' },
  sla: { label: 'SLA', description: 'Indicador de acordo de nivel de servico.', category: 'metric' },
  tempo: { label: 'Tempo', description: 'Tempo medido no processo.', category: 'metric' },
  duracao: { label: 'Duracao', description: 'Duracao do evento ou atendimento.', category: 'metric' },
  data: { label: 'Data', description: 'Data principal do registro.', category: 'time' },
  dt_cadastro: { label: 'Data de cadastro', description: 'Data usada para medir entrada ou criacao.', category: 'time' },
  dt_termino: { label: 'Data de termino', description: 'Data final prevista ou contratual.', category: 'time' },
  data_inicio: { label: 'Data de inicio', description: 'Data em que o contrato ou processo comecou.', category: 'time' },
  data_fim: { label: 'Data de fim', description: 'Data final do processo.', category: 'time' },
  data_abertura: { label: 'Data de abertura', description: 'Quando o chamado foi aberto.', category: 'time' },
  data_fechamento: { label: 'Data de fechamento', description: 'Quando o chamado foi encerrado.', category: 'time' },
  created_at: { label: 'Criado em', description: 'Data de criacao do registro.', category: 'time' },
  updated_at: { label: 'Atualizado em', description: 'Data da ultima atualizacao.', category: 'time' },
  vencimento: { label: 'Vencimento', description: 'Data de vencimento.', category: 'time' },
  competencia: { label: 'Competencia', description: 'Periodo de competencia financeira.', category: 'time' },
  periodo: { label: 'Periodo', description: 'Periodo de referencia.', category: 'time' },
  mes: { label: 'Mes', description: 'Mes de referencia.', category: 'time' },
  ano: { label: 'Ano', description: 'Ano de referencia.', category: 'time' },
};

function titleCase(parts: string[]) {
  return parts
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function humanizeTechnicalName(name: string) {
  return titleCase(name.split('_').filter(Boolean));
}

function inferTableSemantic(table: string): TableSemantic {
  const normalized = table.toLowerCase();
  const label = humanizeTechnicalName(table);

  if (/(contrato|cliente|assinante|carteira)/.test(normalized)) {
    return {
      label,
      description: 'Tabela ligada a clientes, contratos, carteira, ativacao e cancelamento.',
      focus: ['clientes', 'contratos', 'carteira', 'status', 'periodo'],
    };
  }

  if (/(solicit|ticket|chamado|atendimento|suporte)/.test(normalized)) {
    return {
      label,
      description: 'Tabela operacional para chamados, atendimento, SLA, filas e resolucao.',
      focus: ['atendimento', 'sla', 'status', 'fila', 'tempo'],
    };
  }

  if (/(receita|fatur|financeiro|pagamento|cobranca|inadimpl|custo|despesa)/.test(normalized)) {
    return {
      label,
      description: 'Tabela financeira para valores, pagamentos, custos, vencimentos e competencia.',
      focus: ['valor', 'financeiro', 'pagamento', 'vencimento', 'periodo'],
    };
  }

  if (/(noc|zabbix|alert|evento|host|monitor)/.test(normalized)) {
    return {
      label,
      description: 'Tabela de monitoramento para eventos, alertas, hosts e disponibilidade.',
      focus: ['alertas', 'host', 'severidade', 'status', 'duracao'],
    };
  }

  if (/(lead|funil|venda|comercial|crm|oportunidade)/.test(normalized)) {
    return {
      label,
      description: 'Tabela comercial para funil, vendas, vendedores, oportunidades e conversao.',
      focus: ['vendas', 'funil', 'vendedor', 'valor', 'status'],
    };
  }

  if (/(wa|whatsapp|mensagem|chat|comunic)/.test(normalized)) {
    return {
      label,
      description: 'Tabela de comunicacao para mensagens, canais, grupos, autores e sentimento.',
      focus: ['mensagens', 'canal', 'grupo', 'autor', 'sentimento'],
    };
  }

  if (/(produto|plano|servico|catalogo|oferta)/.test(normalized)) {
    return {
      label,
      description: 'Tabela de catalogo para produtos, planos, servicos, precos e categorias.',
      focus: ['produto', 'plano', 'preco', 'categoria', 'status'],
    };
  }

  return {
    label,
    description: 'Tabela liberada para exploracao e leitura analitica dentro do Data Lake.',
    focus: ['exploracao geral', 'colunas', 'metricas', 'dimensoes'],
  };
}

export function getTableSemantic(table: string): TableSemantic {
  return TABLE_SEMANTICS[table.toLowerCase()] || inferTableSemantic(table);
}

export function getColumnSemantic(table: string, column: string): ColumnSemantic {
  const normalized = column.toLowerCase();
  const exact = EXACT_COLUMN_SEMANTICS[normalized];
  if (exact) return exact;

  if (/(^id_|_id$|^id$|uuid|codigo|cod_)/.test(normalized)) {
    return { label: humanizeTechnicalName(column), description: 'Identificador tecnico do registro.', category: 'identifier' };
  }

  if (/(data|dt_|_at$|mes|ano|periodo|competencia|vencimento|inicio|fim)/.test(normalized)) {
    return { label: humanizeTechnicalName(column), description: 'Campo temporal para recortes por periodo.', category: 'time' };
  }

  if (/(valor|total|receita|preco|ticket|sla|tempo|duracao|qtd|quantidade|custo|fatur|mrr|arr|churn|media|score)/.test(normalized)) {
    return { label: humanizeTechnicalName(column), description: 'Campo numerico util para metricas e agregacoes.', category: 'metric' };
  }

  if (/(status|situacao|estagio|prioridade|severidade|sentimento|ativo|cancelado)/.test(normalized)) {
    return { label: humanizeTechnicalName(column), description: 'Campo de status para recortes operacionais.', category: 'status' };
  }

  if (/(cidade|bairro|uf|tipo|categoria|canal|origem|plano|produto|cliente|vendedor|responsavel|equipe|fila|area|departamento|grupo|host)/.test(normalized)) {
    return { label: humanizeTechnicalName(column), description: 'Campo de classificacao para distribuicoes e comparativos.', category: 'dimension' };
  }

  return {
    label: humanizeTechnicalName(column),
    description: `Campo da tabela ${getTableSemantic(table).label}.`,
    category: 'dimension',
  };
}

export function getTimeBucketLabel(bucket: TimeBucket) {
  const labels: Record<TimeBucket, string> = {
    none: 'Sem agrupamento temporal',
    day: 'Por dia',
    month: 'Por mes',
    year: 'Por ano',
  };
  return labels[bucket];
}

export function getFilterOperatorLabel(operator: FilterOperator) {
  const labels: Record<FilterOperator, string> = {
    eq: 'Igual a',
    neq: 'Diferente de',
    contains: 'Contem',
    gte: 'Maior ou igual a',
    lte: 'Menor ou igual a',
    gt: 'Maior que',
    lt: 'Menor que',
  };
  return labels[operator];
}
