const DEFAULT_CONTRACTS_CSV = 'contratos-20260311121947.csv';
const DEFAULT_ITEMS_CSV = 'itens_contratos-20260311130114.csv';
const DEFAULT_CONNECTIONS_CSV = 'Março_2026/conexoes-20260320111419.csv';

let map = null;
let markersGroup = null;

const state = {
  rawContracts: [],
  rawItems: [],
  rawConnections: [],
  rows: [],
  filteredRows: [],
  selectedContractKey: null,
  datasets: {
    contractsName: 'Aguardando CSV',
    itemsName: 'Aguardando CSV',
    connectionsName: 'Aguardando CSV'
  },
  filters: {
    seller: 'all',
    status: 'all',
    situation: 'all',
    service: 'all',
    city: 'all',
    district: 'all',
    search: '',
    createdFrom: '',
    createdTo: '',
    endFrom: '',
    endTo: ''
  }
};

const elements = {
  contractsFileInput: document.querySelector('#contractsFileInput'),
  itemsFileInput: document.querySelector('#itemsFileInput'),
  connectionsFileInput: document.querySelector('#connectionsFileInput'),
  exportFilteredBtn: document.querySelector('#exportFilteredBtn'),
  printPdfBtn: document.querySelector('#printPdfBtn'),
  resetFiltersBtn: document.querySelector('#resetFiltersBtn'),
  contractsDatasetName: document.querySelector('#contractsDatasetName'),
  itemsDatasetName: document.querySelector('#itemsDatasetName'),
  connectionsDatasetName: document.querySelector('#connectionsDatasetName'),
  datasetCount: document.querySelector('#datasetCount'),
  lastLoadedAt: document.querySelector('#lastLoadedAt'),
  sellerFilter: document.querySelector('#sellerFilter'),
  statusFilter: document.querySelector('#statusFilter'),
  situationFilter: document.querySelector('#situationFilter'),
  serviceFilter: document.querySelector('#serviceFilter'),
  cityFilter: document.querySelector('#cityFilter'),
  districtFilter: document.querySelector('#districtFilter'),
  searchFilter: document.querySelector('#searchFilter'),
  createdFromFilter: document.querySelector('#createdFromFilter'),
  createdToFilter: document.querySelector('#createdToFilter'),
  endFromFilter: document.querySelector('#endFromFilter'),
  endToFilter: document.querySelector('#endToFilter'),
  metricClients: document.querySelector('#metricClients'),
  metricContracts: document.querySelector('#metricContracts'),
  metricValue: document.querySelector('#metricValue'),
  metricAvg: document.querySelector('#metricAvg'),
  metricConnections: document.querySelector('#metricConnections'),
  leadSeller: document.querySelector('#leadSeller'),
  leadSellerMeta: document.querySelector('#leadSellerMeta'),
  dominantStatus: document.querySelector('#dominantStatus'),
  dominantStatusMeta: document.querySelector('#dominantStatusMeta'),
  nextExpiry: document.querySelector('#nextExpiry'),
  nextExpiryMeta: document.querySelector('#nextExpiryMeta'),
  sellerRanking: document.querySelector('#sellerRanking'),
  sellerRankingCaption: document.querySelector('#sellerRankingCaption'),
  statusDistribution: document.querySelector('#statusDistribution'),
  serviceRanking: document.querySelector('#serviceRanking'),
  cityRanking: document.querySelector('#cityRanking'),
  districtRanking: document.querySelector('#districtRanking'),
  mapContainer: document.querySelector('#mapContainer'),
  mapCaption: document.querySelector('#mapCaption'),
  expiringTable: document.querySelector('#expiringTable'),
  clientsTable: document.querySelector('#clientsTable'),
  clientsTableCaption: document.querySelector('#clientsTableCaption'),
  contractsTable: document.querySelector('#contractsTable'),
  contractsTableCaption: document.querySelector('#contractsTableCaption'),
  contractDetail: document.querySelector('#contractDetail'),
  detailCaption: document.querySelector('#detailCaption'),
  emptyStateTemplate: document.querySelector('#emptyStateTemplate')
};

function parseCsv(text, delimiter = ';') {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...values] = rows;
  return values.map((valueRow) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = valueRow[index] ?? '';
    });
    return item;
  });
}

function parseCurrency(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

function formatDate(date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeContractKey(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const withoutZeros = digits.replace(/^0+/, '');
  return withoutZeros || digits || '';
}

function normalizeBadgeClass(status) {
  const value = normalizeText(status).replace(/\s+/g, '-');
  if (value.includes('aprovacao')) return 'em-aprovacao';
  if (value.includes('aprovado')) return 'aprovado';
  if (value.includes('cancelado')) return 'cancelado';
  return '';
}

function uniqueSorted(items, useNormalized = false) {
  const filtered = items.filter(Boolean);
  if (!useNormalized) {
    return [...new Set(filtered)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  const normalizedMap = new Map();
  filtered.forEach((item) => {
    const key = normalizeText(item);
    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, item);
    }
  });
  return [...normalizedMap.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function summarizeTop(values, limit = 3) {
  const filtered = uniqueSorted(values).slice(0, limit);
  if (!filtered.length) return '-';
  return filtered.join(', ');
}

function updateSelectOptions(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = [`<option value="all">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join('');
  select.value = values.includes(current) ? current : 'all';
}

function aggregateBy(rows, getKey, getValue = () => 1) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row) || 'Nao informado';
    map.set(key, (map.get(key) || 0) + getValue(row));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function normalizeContractRow(row) {
  return {
    contractCode: row['Código do Contrato'] || row['Codigo do Contrato'] || '',
    contractKey: normalizeContractKey(row['Nº Contrato'] || row['NÂº Contrato'] || row['Código do Contrato'] || row['Codigo do Contrato']),
    clientCode: row['Cod. Cliente'] || '',
    clientName: row.Cliente || '',
    contractNumber: row['Nº Contrato'] || row['NÂº Contrato'] || '',
    description: row.Descrição || row.Descricao || '',
    type: row.Tipo || '',
    createdAt: parseDate(row['Dt. Cadastro']),
    startAt: parseDate(row['Vigência de'] || row['Vigencia de']),
    endAt: parseDate(row['Dt. Térm.'] || row['Dt. Term.']),
    seller: row['Vendedor 1'] || 'Sem vendedor',
    seller2: row['Vendedor 2'] || '',
    value: parseCurrency(row.Valor),
    status: row.Status || 'Sem status',
    situation: row['Situação'] || row['Situacao'] || 'Sem situacao',
    city: row['Cidade do Cliente'] || 'Sem cidade',
    district: row['Bairro do Cliente'] || '',
    raw: row
  };
}

function normalizeItemRow(row) {
  return {
    contractKey: normalizeContractKey(row['Nº Contrato'] || row['NÂº Contrato']),
    contractNumber: row['Nº Contrato'] || row['NÂº Contrato'] || '',
    clientName: row.Cliente || '',
    description: row.Descrição || row.Descricao || '',
    service: row['Serviço'] || row['Servico'] || '',
    units: Number(row.Unidades || 0) || 0,
    unitValue: parseCurrency(row['Valor Unitário'] || row['Valor Unitario']),
    totalValue: parseCurrency(row['Valor Total']),
    contractSituation: row['Situação do Contrato'] || row['Situacao do Contrato'] || '',
    contractStatus: row['Status do Contrato'] || '',
    city: row['Cidade do Cliente'] || '',
    district: row['Bairro do Cliente'] || '',
    raw: row
  };
}

function normalizeConnectionRow(row) {
  return {
    contractKey: normalizeContractKey(row['Código do Contrato'] || row['Codigo do Contrato']),
    contractCode: row['Código do Contrato'] || '',
    connectionCode: row['Código da Conexão'] || '',
    description: row['Descrição do Contrato'] || '',
    serviceCode: row['Código do Serviço'] || '',
    service: row['Serviço'] || '',
    username: row['Usuário'] || '',
    mac: row['MAC'] || '',
    ip: row['IP'] || '',
    concentrator: row['Concentrador'] || '',
    accessPoint: row['Ponto de Acesso'] || '',
    equipmentType: row['Tipo de Equipamento'] || '',
    street: row['Rua'] || '',
    number: row['Número'] || row['Numero'] || '',
    complement: row['Complemento'] || '',
    cep: row['CEP'] || '',
    district: row['Bairro'] || '',
    city: row['Cidade'] || '',
    state: row['Estado'] || '',
    latitude: row['Latitude'] || '',
    longitude: row['Longitude'] || '',
    connectionType: row['Tipo de Conexão'] || '',
    active: row['Ativo'] || '',
    raw: row
  };
}

function buildItemsIndex(items) {
  const map = new Map();
  items.forEach((item) => {
    if (!item.contractKey) return;
    if (!map.has(item.contractKey)) map.set(item.contractKey, []);
    map.get(item.contractKey).push(item);
  });
  return map;
}

function buildConnectionsIndex(connections) {
  const map = new Map();
  connections.forEach((conn) => {
    if (!conn.contractKey) return;
    if (!map.has(conn.contractKey)) map.set(conn.contractKey, []);
    map.get(conn.contractKey).push(conn);
  });
  return map;
}

function formatAddress(conn) {
  const parts = [];
  if (conn.street) parts.push(conn.street);
  if (conn.number) parts.push(`Nº ${conn.number}`);
  if (conn.complement) parts.push(conn.complement);
  return parts.join(', ');
}

function formatFullAddress(conn) {
  const parts = [];
  if (conn.street) parts.push(conn.street);
  if (conn.number) parts.push(`Nº ${conn.number}`);
  if (conn.complement) parts.push(conn.complement);
  if (conn.cep) parts.push(`CEP: ${conn.cep}`);
  if (conn.district) parts.push(conn.district);
  if (conn.city) parts.push(conn.city);
  if (conn.state) parts.push(conn.state);
  return parts.join(', ');
}

function consolidateRows() {
  const itemsIndex = buildItemsIndex(state.rawItems);
  const connectionsIndex = buildConnectionsIndex(state.rawConnections);

  state.rows = state.rawContracts.map((contract) => {
    const items = itemsIndex.get(contract.contractKey) || [];
    const connections = connectionsIndex.get(contract.contractKey) || [];
    
    const serviceNames = uniqueSorted(items.map((item) => item.service));
    const itemStatuses = uniqueSorted(items.map((item) => item.contractStatus));
    const itemSituations = uniqueSorted(items.map((item) => item.contractSituation));
    const itemsTotalValue = items.reduce((sum, item) => sum + item.totalValue, 0);

    const connectionAddresses = [];
    const connectionDistricts = new Set();
    const connectionCities = new Set();
    
    connections.forEach((conn) => {
      const addr = formatAddress(conn);
      if (addr) connectionAddresses.push(addr);
      if (conn.district) connectionDistricts.add(conn.district);
      if (conn.city) connectionCities.add(conn.city);
    });

    const mainConnection = connections[0] || {};

    return {
      ...contract,
      serviceNames,
      serviceSummary: summarizeTop(serviceNames, 2),
      itemStatus: itemStatuses[0] || contract.status,
      itemSituation: itemSituations[0] || contract.situation,
      itemCount: items.length,
      itemsTotalValue,
      displayValue: itemsTotalValue > 0 ? itemsTotalValue : contract.value,
      items,
      connections,
      connectionCount: connections.length,
      connectionAddresses: uniqueSorted(connectionAddresses),
      district: contract.district || [...connectionDistricts][0] || '',
      city: contract.city || [...connectionCities][0] || '',
      connectionStreet: mainConnection.street || '',
      connectionNumber: mainConnection.number || '',
      connectionComplement: mainConnection.complement || '',
      connectionCep: mainConnection.cep || '',
      connectionDistrict: mainConnection.district || '',
      connectionCity: mainConnection.city || '',
      connectionState: mainConnection.state || '',
      connectionLat: mainConnection.latitude || '',
      connectionLng: mainConnection.longitude || '',
      connectionIp: mainConnection.ip || '',
      connectionMac: mainConnection.mac || '',
      connectionType: mainConnection.connectionType || '',
      connectionActive: mainConnection.active || ''
    };
  });
}

function updateDatasetStatus() {
  elements.contractsDatasetName.textContent = `${state.datasets.contractsName} (${state.rawContracts.length})`;
  elements.itemsDatasetName.textContent = `${state.datasets.itemsName} (${state.rawItems.length})`;
  elements.connectionsDatasetName.textContent = `${state.datasets.connectionsName} (${state.rawConnections.length})`;
  elements.lastLoadedAt.textContent = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date());
}

function applyFilters() {
  const search = state.filters.search.trim().toLowerCase();
  const createdFrom = state.filters.createdFrom ? new Date(`${state.filters.createdFrom}T00:00:00`) : null;
  const createdTo = state.filters.createdTo ? new Date(`${state.filters.createdTo}T23:59:59`) : null;
  const endFrom = state.filters.endFrom ? new Date(`${state.filters.endFrom}T00:00:00`) : null;
  const endTo = state.filters.endTo ? new Date(`${state.filters.endTo}T23:59:59`) : null;

  const filtroVendedor = state.filters.seller;
  const filtroVendedorNorm = normalizeText(filtroVendedor);

  state.filteredRows = state.rows.filter((row) => {
    const haystack = [
      row.clientName,
      row.contractCode,
      row.description,
      row.city,
      row.district,
      row.type,
      row.serviceSummary,
      row.itemStatus,
      row.itemSituation,
      row.connectionStreet,
      row.connectionAddresses.join(' ')
    ].join(' ').toLowerCase();

    const sellerMatch = filtroVendedor === 'all' || 
      normalizeText(row.seller) === filtroVendedorNorm;
    
    const statusMatch = state.filters.status === 'all' || 
      normalizeText(row.itemStatus || row.status) === normalizeText(state.filters.status);
    const situationMatch = state.filters.situation === 'all' || 
      normalizeText(row.itemSituation || row.situation) === normalizeText(state.filters.situation);
    const serviceMatch = state.filters.service === 'all' || 
      row.serviceNames.some(s => normalizeText(s) === normalizeText(state.filters.service));
    const cityMatch = state.filters.city === 'all' || 
      normalizeText(row.city) === normalizeText(state.filters.city);
    const districtMatch = state.filters.district === 'all' || 
      normalizeText(row.district) === normalizeText(state.filters.district);

    return (
      sellerMatch &&
      statusMatch &&
      situationMatch &&
      serviceMatch &&
      cityMatch &&
      districtMatch &&
      (!search || haystack.includes(search)) &&
      (!createdFrom || (row.createdAt && row.createdAt >= createdFrom)) &&
      (!createdTo || (row.createdAt && row.createdAt <= createdTo)) &&
      (!endFrom || (row.endAt && row.endAt >= endFrom)) &&
      (!endTo || (row.endAt && row.endAt <= endTo))
    );
  });

  render();
}

function renderSummary(rows) {
  const activeRows = rows.filter((row) => normalizeText(row.itemSituation || row.situation) !== 'cancelado');
  const uniqueClients = new Set(activeRows.map((row) => row.clientCode || row.clientName).filter(Boolean));
  const totalValue = activeRows.reduce((sum, row) => sum + row.displayValue, 0);
  const avgTicket = activeRows.length ? totalValue / activeRows.length : 0;
  const totalConnections = activeRows.reduce((sum, row) => sum + (row.connectionCount || 0), 0);

  elements.metricClients.textContent = String(uniqueClients.size);
  elements.metricContracts.textContent = String(activeRows.length);
  elements.metricValue.textContent = formatCurrency(totalValue);
  elements.metricAvg.textContent = formatCurrency(avgTicket);
  elements.metricConnections.textContent = String(totalConnections);

  const sellerRanking = aggregateBy(activeRows, (row) => row.seller, (row) => row.displayValue);
  const statusRanking = aggregateBy(rows, (row) => row.itemStatus || row.status);
  const nextExpiry = [...activeRows].filter((row) => row.endAt).sort((a, b) => a.endAt - b.endAt)[0];
  const dueSoonCount = activeRows.filter((row) => row.endAt && getDueBucket(row.endAt) === 'soon').length;
  const overdueCount = activeRows.filter((row) => row.endAt && getDueBucket(row.endAt) === 'overdue').length;

  if (sellerRanking.length) {
    const [seller, value] = sellerRanking[0];
    const share = totalValue ? (value / totalValue) * 100 : 0;
    elements.leadSeller.textContent = seller;
    elements.leadSellerMeta.textContent = `${formatCurrency(value)} | ${share.toFixed(1)}% da carteira ativa`;
  } else {
    elements.leadSeller.textContent = '-';
    elements.leadSellerMeta.textContent = 'Sem dados';
  }

  if (statusRanking.length) {
    const [status, count] = statusRanking[0];
    const share = rows.length ? (count / rows.length) * 100 : 0;
    elements.dominantStatus.textContent = status;
    elements.dominantStatusMeta.textContent = `${count} contrato(s) | ${share.toFixed(1)}% da base filtrada | ${overdueCount} vencido(s) | ${dueSoonCount} ate 30 dias`;
  } else {
    elements.dominantStatus.textContent = '-';
    elements.dominantStatusMeta.textContent = 'Sem dados';
  }

  if (nextExpiry) {
    elements.nextExpiry.textContent = formatDate(nextExpiry.endAt);
    elements.nextExpiryMeta.textContent = `${nextExpiry.clientName} | ${formatCurrency(nextExpiry.displayValue)}`;
  } else {
    elements.nextExpiry.textContent = '-';
    elements.nextExpiryMeta.textContent = 'Sem vencimentos na base filtrada';
  }
}

function renderEmptyState(container) {
  container.innerHTML = '';
  container.appendChild(elements.emptyStateTemplate.content.firstElementChild.cloneNode(true));
}

function renderEmptyRows(container, columns) {
  container.innerHTML = `
    <tr>
      <td colspan="${columns}">
        <div class="empty-state">
          <strong>Nenhum resultado</strong>
          <span>Ajuste os filtros ou carregue outro CSV.</span>
        </div>
      </td>
    </tr>
  `;
}

function renderRanking(container, data, formatter = (value) => value, compact = false) {
  if (!data.length) {
    renderEmptyState(container);
    return;
  }

  const max = data[0][1] || 1;
  container.innerHTML = data.map(([label, value]) => `
    <div class="rank-item ${compact ? 'compact' : ''}">
      <span class="rank-label">${escapeHtml(label)}</span>
      <div class="track"><div class="fill" style="width:${Math.max((value / max) * 100, 4)}%"></div></div>
      <strong>${formatter(value)}</strong>
    </div>
  `).join('');
}

function renderDistribution(rows) {
  const grouped = aggregateBy(rows, (row) => row.itemStatus || row.status);
  if (!grouped.length) {
    renderEmptyState(elements.statusDistribution);
    return;
  }

  elements.statusDistribution.innerHTML = grouped.map(([label, value]) => `
    <div class="distribution-item">
      <div><div class="badge ${normalizeBadgeClass(label)}">${escapeHtml(label)}</div></div>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function renderExpiring(rows) {
  const expiring = rows
    .filter((row) => row.endAt && normalizeText(row.itemSituation || row.situation) !== 'cancelado')
    .sort((a, b) => a.endAt - b.endAt)
    .slice(0, 12);

  if (!expiring.length) {
    renderEmptyRows(elements.expiringTable, 5);
    return;
  }

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  elements.expiringTable.innerHTML = expiring.map((row) => `
    <tr>
      <td>${escapeHtml(row.contractCode)}</td>
      <td><span class="truncate md" title="${escapeHtml(row.clientName)}">${escapeHtml(row.clientName)}</span></td>
      <td><span class="badge ${getDueBadgeClass(row.endAt, startToday)}">${getDaysUntil(row.endAt, startToday)}</span></td>
      <td>${formatDate(row.endAt)}</td>
      <td>${formatCurrency(row.displayValue)}</td>
    </tr>
  `).join('');
}

function renderClients(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.clientCode || row.clientName;
    if (!map.has(key)) {
      map.set(key, {
        clientCode: row.clientCode,
        clientName: row.clientName,
        city: row.city,
        district: row.district,
        seller: row.seller,
        contracts: 0,
        connections: 0,
        value: 0
      });
    }

    const item = map.get(key);
    item.contracts += 1;
    item.connections += row.connectionCount || 0;
    item.value += row.displayValue;
  });

  const clients = [...map.values()].sort((a, b) => b.value - a.value).slice(0, 50);
  elements.clientsTableCaption.textContent = `${map.size} cliente(s) encontrado(s)`;

  if (!clients.length) {
    renderEmptyRows(elements.clientsTable, 8);
    return;
  }

  elements.clientsTable.innerHTML = clients.map((client) => `
    <tr>
      <td>${escapeHtml(client.clientCode)}</td>
      <td><span class="truncate md" title="${escapeHtml(client.clientName)}">${escapeHtml(client.clientName)}</span></td>
      <td>${escapeHtml(client.city)}</td>
      <td>${escapeHtml(client.district)}</td>
      <td><span class="truncate sm" title="${escapeHtml(client.seller)}">${escapeHtml(client.seller)}</span></td>
      <td>${client.contracts}</td>
      <td>${client.connections}</td>
      <td>${formatCurrency(client.value)}</td>
    </tr>
  `).join('');
}

function renderContracts(rows) {
  const contracts = [...rows].sort((a, b) => b.displayValue - a.displayValue).slice(0, 80);
  elements.contractsTableCaption.textContent = `${rows.length} contrato(s) filtrado(s)`;
  elements.datasetCount.textContent = String(rows.length);

  if (!contracts.length) {
    renderEmptyRows(elements.contractsTable, 10);
    renderContractDetail(null);
    return;
  }

  elements.contractsTable.innerHTML = contracts.map((row) => `
    <tr class="contract-row ${state.selectedContractKey === row.contractKey ? 'is-selected' : ''}" data-contract-key="${escapeHtml(row.contractKey)}">
      <td>${escapeHtml(row.contractCode)}</td>
      <td><span class="truncate md" title="${escapeHtml(row.clientName)}">${escapeHtml(row.clientName)}</span></td>
      <td><span class="truncate md" title="${escapeHtml(row.serviceNames.join(', '))}">${escapeHtml(row.serviceSummary)}</span></td>
      <td><span class="truncate sm" title="${escapeHtml(row.type)}">${escapeHtml(row.type)}</span></td>
      <td><span class="badge ${normalizeBadgeClass(row.itemSituation || row.situation)}">${escapeHtml(row.itemSituation || row.situation)}</span></td>
      <td><span class="badge ${normalizeBadgeClass(row.itemStatus || row.status)}">${escapeHtml(row.itemStatus || row.status)}</span></td>
      <td><span class="truncate sm" title="${escapeHtml(row.seller)}">${escapeHtml(row.seller)}</span></td>
      <td>${escapeHtml(row.city)}</td>
      <td>${formatDate(row.endAt)}</td>
      <td>${formatCurrency(row.displayValue)}</td>
    </tr>
  `).join('');

  if (!state.selectedContractKey || !contracts.some((row) => row.contractKey === state.selectedContractKey)) {
    state.selectedContractKey = contracts[0].contractKey;
  }

  elements.contractsTable.querySelectorAll('.contract-row').forEach((rowElement) => {
    rowElement.addEventListener('click', () => {
      state.selectedContractKey = rowElement.dataset.contractKey;
      renderContracts(state.filteredRows);
      renderContractDetail(state.filteredRows.find((item) => item.contractKey === state.selectedContractKey) || null);
    });
  });

  renderContractDetail(state.filteredRows.find((item) => item.contractKey === state.selectedContractKey) || contracts[0]);
}

function renderContractDetail(row) {
  if (!row) {
    elements.detailCaption.textContent = 'Selecione um contrato na tabela';
    renderEmptyState(elements.contractDetail);
    return;
  }

  const servicesRows = row.items.length
    ? row.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.service || '-')}</td>
        <td>${item.units}</td>
        <td>${formatCurrency(item.unitValue)}</td>
        <td>${formatCurrency(item.totalValue)}</td>
        <td>${escapeHtml(item.contractSituation || row.itemSituation || '-')}</td>
        <td>${escapeHtml(item.contractStatus || row.itemStatus || '-')}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <strong>Sem itens detalhados</strong>
            <span>Esse contrato nao teve correspondencia na base de itens.</span>
          </div>
        </td>
      </tr>
    `;

  const connectionsRows = row.connections.length
    ? row.connections.map((conn, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(conn.service || '-')}</td>
        <td>${escapeHtml(conn.connectionType || '-')}</td>
        <td>${escapeHtml(conn.ip || '-')}</td>
        <td>${escapeHtml(conn.mac || '-')}</td>
        <td>${escapeHtml(conn.accessPoint || '-')}</td>
        <td><span class="badge ${conn.active === 'Sim' || conn.active === 'Ativo' ? 'aprovado' : ''}">${escapeHtml(conn.active || '-')}</span></td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <strong>Sem conexoes</strong>
            <span>Esse contrato nao tem conexoes na base de conexoes.</span>
          </div>
        </td>
      </tr>
    `;

  const addressText = row.connectionStreet 
    ? `${row.connectionStreet}${row.connectionNumber ? ', ' + row.connectionNumber : ''}${row.connectionComplement ? ' - ' + row.connectionComplement : ''}`
    : '-';
  
  const fullAddressText = [
    addressText !== '-' ? addressText : '',
    row.connectionCep ? `CEP: ${row.connectionCep}` : '',
    row.connectionDistrict || '',
    row.connectionCity || '',
    row.connectionState || ''
  ].filter(Boolean).join(', ');

  const googleMapsUrl = (row.connectionLat && row.connectionLng) 
    ? `https://www.google.com/maps?q=${row.connectionLat},${row.connectionLng}` 
    : (row.connectionStreet ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressText)}` : null);

  elements.detailCaption.textContent = `${row.clientName} | Contrato ${row.contractCode}`;
  const serviceChips = row.serviceNames.length
    ? row.serviceNames.slice(0, 8).map((service) => `<span class="service-chip" title="${escapeHtml(service)}">${escapeHtml(service)}</span>`).join('')
    : '<span class="service-chip muted">Sem servicos detalhados</span>';

  const mapsButton = googleMapsUrl 
    ? `<a href="${googleMapsUrl}" target="_blank" class="maps-button">📍 Ver no Google Maps</a>` 
    : '';

  elements.contractDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <span class="metric-label">Cliente</span>
        <strong><span class="truncate lg" title="${escapeHtml(row.clientName)}">${escapeHtml(row.clientName)}</span></strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Vendedor</span>
        <strong><span class="truncate md" title="${escapeHtml(row.seller)}">${escapeHtml(row.seller)}</span></strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Status / Situacao</span>
        <strong><span class="truncate lg" title="${escapeHtml(row.itemStatus || row.status)} / ${escapeHtml(row.itemSituation || row.situation)}">${escapeHtml(row.itemStatus || row.status)} / ${escapeHtml(row.itemSituation || row.situation)}</span></strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Valor consolidado</span>
        <strong>${formatCurrency(row.displayValue)}</strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Cadastro</span>
        <strong>${formatDate(row.createdAt)}</strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Termino</span>
        <strong>${formatDate(row.endAt)}</strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Cidade / Bairro</span>
        <strong><span class="truncate lg" title="${escapeHtml(row.city)}${row.district ? ` / ${escapeHtml(row.district)}` : ''}">${escapeHtml(row.city)}${row.district ? ` / ${escapeHtml(row.district)}` : ''}</span></strong>
      </div>
      <div class="detail-card">
        <span class="metric-label">Itens / Conexoes</span>
        <strong>${row.itemCount} / ${row.connectionCount}</strong>
      </div>
    </div>

    <div class="address-section">
      <h3>Endereco de Instalacao</h3>
      <div class="address-grid">
        <div class="address-card full-width">
          <span class="metric-label">Endereco completo</span>
          <strong>${fullAddressText || '-'}</strong>
          ${mapsButton}
        </div>
        <div class="address-card">
          <span class="metric-label">Rua</span>
          <strong>${escapeHtml(row.connectionStreet) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Numero</span>
          <strong>${escapeHtml(row.connectionNumber) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Complemento</span>
          <strong>${escapeHtml(row.connectionComplement) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">CEP</span>
          <strong>${escapeHtml(row.connectionCep) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Bairro</span>
          <strong>${escapeHtml(row.connectionDistrict) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Cidade</span>
          <strong>${escapeHtml(row.connectionCity) || '-'}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Estado</span>
          <strong>${escapeHtml(row.connectionState) || '-'}</strong>
        </div>
        ${(row.connectionLat && row.connectionLng) ? `
        <div class="address-card">
          <span class="metric-label">Latitude</span>
          <strong>${escapeHtml(row.connectionLat)}</strong>
        </div>
        <div class="address-card">
          <span class="metric-label">Longitude</span>
          <strong>${escapeHtml(row.connectionLng)}</strong>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="service-chip-row">${serviceChips}</div>
    
    <h3 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; color: var(--text);">Itens do Contrato</h3>
    <div class="detail-services">
      <table>
        <thead>
          <tr>
            <th>Servico</th>
            <th>Unidades</th>
            <th>Valor unitario</th>
            <th>Valor total</th>
            <th>Situacao</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${servicesRows}</tbody>
      </table>
    </div>

    <h3 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; color: var(--text);">Conexoes Vinculadas</h3>
    <div class="detail-services">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Servico</th>
            <th>Tipo Conexao</th>
            <th>IP</th>
            <th>MAC</th>
            <th>Ponto de Acesso</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${connectionsRows}</tbody>
      </table>
    </div>
  `;
}

function renderMap(rows) {
  const points = [];
  rows.forEach((row) => {
    (row.connections || []).forEach((conn) => {
      const lat = parseFloat(conn.latitude);
      const lng = parseFloat(conn.longitude);
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        points.push({
          lat,
          lng,
          clientName: row.clientName,
          contractCode: row.contractCode,
          address: formatFullAddress(conn),
          ip: conn.ip,
          active: conn.active
        });
      }
    });
  });

  elements.mapCaption.textContent = `${points.length} ponto(s) geolocalizado(s)`;

  if (!map) {
    map = L.map('mapContainer').setView([-23.5, -46.6], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    markersGroup = L.featureGroup().addTo(map);
  }

  markersGroup.clearLayers();

  if (points.length === 0) return;

  points.forEach((point) => {
    const color = point.active === 'Sim' || point.active === 'Ativo' ? '#2e8b57' : '#c58a1a';
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    const marker = L.marker([point.lat, point.lng], { icon });
    marker.bindPopup(`<strong>${escapeHtml(point.clientName)}</strong><br>${escapeHtml(point.contractCode)}<br>${escapeHtml(point.address)}<br>IP: ${escapeHtml(point.ip || '-')}`);
    markersGroup.addLayer(marker);
  });

  const bounds = markersGroup.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function render() {
  const rows = state.filteredRows;
  renderSummary(rows);
  renderMap(rows);
  const activeRows = rows.filter((row) => normalizeText(row.itemSituation || row.situation) !== 'cancelado');
  
  renderRanking(
    elements.sellerRanking,
    aggregateBy(activeRows, (row) => row.seller, (row) => row.displayValue).slice(0, 8),
    formatCurrency
  );
  elements.sellerRankingCaption.textContent = 'Ordenado por valor da carteira ativa';
  
  renderDistribution(rows);
  
  renderRanking(
    elements.serviceRanking,
    aggregateBy(
      rows.flatMap((row) => row.serviceNames.length ? row.serviceNames.map((service) => ({ service })) : [{ service: 'Sem servico detalhado' }]),
      (item) => item.service
    ).slice(0, 8),
    (value) => `${value}`,
    true
  );

  renderRanking(
    elements.cityRanking,
    aggregateBy(rows, (row) => row.city || 'Nao informado'),
    (value) => `${value}`,
    true
  );

  renderExpiring(rows);
  renderClients(rows);
  renderContracts(rows);
}

function getDaysUntil(date, referenceDate) {
  if (!date) return '-';
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = target - referenceDate;
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 0) return `${Math.abs(diffDays)} dia(s) atrasado`;
  if (diffDays === 0) return 'Hoje';
  return `${diffDays} dia(s)`;
}

function getDueBadgeClass(date, referenceDate) {
  const bucket = getDueBucket(date, referenceDate);
  if (bucket === 'overdue') return 'due-overdue';
  if (bucket === 'soon') return 'due-soon';
  return 'due-ok';
}

function getDueBucket(date, referenceDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) {
  if (!date) return 'ok';
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target - referenceDate) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'soon';
  return 'ok';
}

function toCsvValue(value) {
  const stringValue = String(value ?? '');
  if (/[;"\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function exportFilteredRows() {
  if (!state.filteredRows.length) return;

  const headers = [
    'Codigo do Contrato',
    'Cod Cliente',
    'Cliente',
    'Servico',
    'Tipo',
    'Situacao',
    'Status',
    'Vendedor 1',
    'Cidade',
    'Bairro',
    'Endereco',
    'CEP',
    'Dt Cadastro',
    'Dt Termino',
    'Valor',
    'Qtd Itens',
    'Qtd Conexoes'
  ];

  const lines = [
    headers.join(';'),
    ...state.filteredRows.map((row) => [
      row.contractCode,
      row.clientCode,
      row.clientName,
      row.serviceNames.join(' | '),
      row.type,
      row.itemSituation || row.situation,
      row.itemStatus || row.status,
      row.seller,
      row.city,
      row.district,
      row.connectionStreet ? `${row.connectionStreet}${row.connectionNumber ? ', ' + row.connectionNumber : ''}` : '',
      row.connectionCep || '',
      formatDate(row.createdAt),
      formatDate(row.endAt),
      row.displayValue.toFixed(2).replace('.', ','),
      row.itemCount,
      row.connectionCount
    ].map(toCsvValue).join(';'))
  ];

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `dash-funter-v2-filtrado-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateFiltersFromData() {
  updateSelectOptions(elements.sellerFilter, uniqueSorted(state.rows.map((row) => row.seller), true), 'Todos os vendedores');
  updateSelectOptions(elements.statusFilter, uniqueSorted(state.rows.map((row) => row.itemStatus || row.status)), 'Todos os status');
  updateSelectOptions(elements.situationFilter, uniqueSorted(state.rows.map((row) => row.itemSituation || row.situation)), 'Todas as situacoes');
  updateSelectOptions(elements.serviceFilter, uniqueSorted(state.rows.flatMap((row) => row.serviceNames)), 'Todos os servicos');
  updateSelectOptions(elements.cityFilter, uniqueSorted(state.rows.map((row) => row.city)), 'Todas as cidades');
  updateSelectOptions(elements.districtFilter, uniqueSorted(state.rows.map((row) => row.district).filter(Boolean)), 'Todos os bairros');
}

function refreshMergedData() {
  consolidateRows();
  updateDatasetStatus();
  updateFiltersFromData();
  applyFilters();
}

async function readCsvSource(source) {
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  return source.text();
}

async function loadCsvInto(kind, source, displayName) {
  const text = await readCsvSource(source);
  const parsed = parseCsv(await text);

  if (kind === 'contracts') {
    state.rawContracts = parsed.map(normalizeContractRow);
    state.datasets.contractsName = displayName;
  } else if (kind === 'items') {
    state.rawItems = parsed.map(normalizeItemRow);
    state.datasets.itemsName = displayName;
  } else if (kind === 'connections') {
    state.rawConnections = parsed.map(normalizeConnectionRow);
    state.datasets.connectionsName = displayName;
  }

  refreshMergedData();
}

async function loadDefaults() {
  try {
    await loadCsvInto('contracts', DEFAULT_CONTRACTS_CSV, DEFAULT_CONTRACTS_CSV);
  } catch (error) {
    state.datasets.contractsName = 'Carregue contratos manualmente';
    updateDatasetStatus();
  }

  try {
    await loadCsvInto('items', DEFAULT_ITEMS_CSV, DEFAULT_ITEMS_CSV);
  } catch (error) {
    state.datasets.itemsName = 'Carregue itens manualmente';
    updateDatasetStatus();
  }

  try {
    await loadCsvInto('connections', DEFAULT_CONNECTIONS_CSV, DEFAULT_CONNECTIONS_CSV);
  } catch (error) {
    state.datasets.connectionsName = 'Carregue conexoes manualmente';
    updateDatasetStatus();
  }
}

function bindEvents() {
  elements.contractsFileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await loadCsvInto('contracts', file, file.name);
  });

  elements.itemsFileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await loadCsvInto('items', file, file.name);
  });

  elements.connectionsFileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await loadCsvInto('connections', file, file.name);
  });

  elements.resetFiltersBtn.addEventListener('click', () => {
    state.filters = {
      seller: 'all',
      status: 'all',
      situation: 'all',
      service: 'all',
      city: 'all',
      district: 'all',
      search: '',
      createdFrom: '',
      createdTo: '',
      endFrom: '',
      endTo: ''
    };
    elements.sellerFilter.value = 'all';
    elements.statusFilter.value = 'all';
    elements.situationFilter.value = 'all';
    elements.serviceFilter.value = 'all';
    elements.cityFilter.value = 'all';
    elements.districtFilter.value = 'all';
    elements.searchFilter.value = '';
    elements.createdFromFilter.value = '';
    elements.createdToFilter.value = '';
    elements.endFromFilter.value = '';
    elements.endToFilter.value = '';
    applyFilters();
  });

  elements.exportFilteredBtn.addEventListener('click', exportFilteredRows);
  elements.printPdfBtn.addEventListener('click', () => window.print());

  elements.sellerFilter.addEventListener('change', (event) => {
    state.filters.seller = event.target.value;
    applyFilters();
  });

  elements.statusFilter.addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    applyFilters();
  });

  elements.situationFilter.addEventListener('change', (event) => {
    state.filters.situation = event.target.value;
    applyFilters();
  });

  elements.serviceFilter.addEventListener('change', (event) => {
    state.filters.service = event.target.value;
    applyFilters();
  });

  elements.cityFilter.addEventListener('change', (event) => {
    state.filters.city = event.target.value;
    applyFilters();
  });

  elements.districtFilter.addEventListener('change', (event) => {
    state.filters.district = event.target.value;
    applyFilters();
  });

  elements.searchFilter.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    applyFilters();
  });

  elements.createdFromFilter.addEventListener('change', (event) => {
    state.filters.createdFrom = event.target.value;
    applyFilters();
  });

  elements.createdToFilter.addEventListener('change', (event) => {
    state.filters.createdTo = event.target.value;
    applyFilters();
  });

  elements.endFromFilter.addEventListener('change', (event) => {
    state.filters.endFrom = event.target.value;
    applyFilters();
  });

  elements.endToFilter.addEventListener('change', (event) => {
    state.filters.endTo = event.target.value;
    applyFilters();
  });
}

bindEvents();
updateSelectOptions(elements.sellerFilter, [], 'Todos os vendedores');
updateSelectOptions(elements.statusFilter, [], 'Todos os status');
updateSelectOptions(elements.situationFilter, [], 'Todas as situacoes');
updateSelectOptions(elements.serviceFilter, [], 'Todos os servicos');
updateSelectOptions(elements.cityFilter, [], 'Todas as cidades');
updateSelectOptions(elements.districtFilter, [], 'Todos os bairros');
render();
updateDatasetStatus();
loadDefaults();
