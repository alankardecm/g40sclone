// NOTA: A configuração de grupos agora é prioritariamente DINÂMICA via banco de dados.
// As listas abaixo servem como fallback de segurança.
const DEFAULT_ALLOWED_GROUPS = [];

const DEFAULT_EXCLUDED_GROUPS = [
  'noc oculto',
  'evaneis',
  'gabriel correa-noc net turbo',
  'helio garcia noc netturbo',
  'henry souza -noc net turbo',
  'josiane soares',
  'murilo net turbo',
  'pett 😎',
  'vinicius machado',
  'weslley',
];

function normalizeGroupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  DEFAULT_ALLOWED_GROUPS,
  DEFAULT_EXCLUDED_GROUPS,
  normalizeGroupKey,
};
