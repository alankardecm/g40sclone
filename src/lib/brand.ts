/**
 * AM OS — Fonte única da marca (white-label).
 * Tudo que é identidade visual/textual do produto vem daqui.
 * Para revender com outra marca, basta sobrescrever via env NEXT_PUBLIC_*.
 */
export const brand = {
  /** Empresa por trás do produto */
  company: process.env.NEXT_PUBLIC_BRAND_COMPANY || 'AM Consultoria',
  /** Nome do produto (wordmark) */
  name: process.env.NEXT_PUBLIC_APP_NAME || 'AM OS',
  /** Sigla / monograma */
  short: process.env.NEXT_PUBLIC_BRAND_SHORT || 'AM',
  /** Subtítulo curto exibido sob o logo */
  subtitle: process.env.NEXT_PUBLIC_APP_SUBTITLE || 'Business OS',
  /** Frase de posicionamento */
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    'O sistema operacional da sua empresa, com IA.',
  /** Descrição (metadata / SEO) */
  description:
    process.env.NEXT_PUBLIC_APP_DESC ||
    'Gestão, indicadores, CRM, metas e comunicação em um só lugar — potencializado por inteligência artificial.',
  /** Nome padrão de usuário (fallback de saudação) */
  defaultUser: process.env.NEXT_PUBLIC_APP_DEFAULT_USER || 'Gestor',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0',
} as const;

/** Paleta da marca (espelha os tokens de globals.css, para uso em JS quando necessário). */
export const brandColors = {
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primarySoft: '#15233F',
  accent: '#22D3EE',
  ink: '#E6EAF3',
  muted: '#8893A7',
  surface: '#101728',
  background: '#0A0F1E',
  border: '#1E2740',
} as const;
