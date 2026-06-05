'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Activity,
  Bot,
  Building2,
  Database,
  MonitorSmartphone,
  Layers3,
  LayoutGrid,
  BarChart2,
  Bell,
  Smartphone,
  TriangleAlert,
  MessageSquare,
  Settings,
} from 'lucide-react';

const modules = [
  {
    title: 'Dashboard',
    href: '/dashboards',
    icon: BarChart2,
    description: 'Builder e visões do hub para montar dashboards sob demanda.',
  },
  {
    title: 'Monitoramento',
    href: '/dashboard/noc',
    icon: Activity,
    description: 'Saúde dos serviços-base do HUB, incluindo Zabbix, DataLake e sustentação operacional.',
  },
  {
    title: 'Zabbix',
    href: '/monitoring/zabbix',
    icon: Bell,
    description: 'Monitoramento de alarmes e eventos operacionais em tempo real.',
  },
  {
    title: 'IA Comunicação',
    href: '/dashboard/comunicacao',
    icon: Bot,
    description: 'Dashboard de sentimento, palavras-chave e canais de comunicação.',
  },
  {
    title: 'WhatsApp',
    href: '/dashboard/whatsapp',
    icon: Smartphone,
    description: 'Gestão de instâncias WhatsApp e bot via Evolution API.',
  },
  {
    title: 'Alertas',
    href: '/dashboard/alertas',
    icon: TriangleAlert,
    description: 'Central de alertas operacionais, notificações e eventos críticos.',
  },
  {
    title: 'DataLake',
    href: '/datalake',
    icon: Database,
    description: 'Fontes, ingestão e consolidação de dados para as futuras dashboards.',
  },
  {
    title: 'Chat',
    href: '/chat',
    icon: MessageSquare,
    description: 'Assistente interno com IA e consulta à base de conhecimento TurboDocs.',
  },
  {
    title: 'Diagnóstico',
    href: '/settings',
    icon: Settings,
    description: 'Saúde dos serviços, logs e configurações operacionais do HUB.',
  },
];

const lanes = [
  'Cada usuário terá sua visão personalizada.',
  'Sem KPI global fixo nesta tela.',
  'A página funciona como seletor de módulos.',
  'Indicadores futuros virão do perfil do usuário.',
];

export default function DashboardHub() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-screen">
        <div className="px-8 py-8 lg:px-12 lg:py-10 flex flex-col gap-10">

          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[40px] border border-[#404040]/8 bg-white p-10 shadow-[0_8px_40px_rgba(64,64,64,0.08)]"
          >
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">
              <span className="px-3 py-1 rounded-full border border-gray-200 bg-gray-50">Workspace</span>
              <span className="px-3 py-1 rounded-full border border-gray-200 bg-gray-50">Hub</span>
              <span className="px-3 py-1 rounded-full border border-gray-200 bg-gray-50">Multiusuário</span>
            </div>

            <div className="mt-6 grid gap-10 xl:grid-cols-12 items-start">
              <div className="xl:col-span-7 space-y-5">
                <h1 className="text-4xl lg:text-5xl font-[1000] tracking-[-0.06em] leading-[1] text-[#404040] uppercase">
                  Selecione sua<br />
                  <span className="text-[#8DC63F]">área de trabalho</span>
                </h1>
                <p className="max-w-2xl text-base text-gray-500 leading-relaxed">
                  Esta página existe para cada usuário entrar no módulo certo e, no futuro,
                  receber apenas os indicadores que forem dele.
                </p>
              </div>

              <div className="xl:col-span-5 rounded-[32px] border border-gray-200 bg-gray-50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Layers3 className="w-5 h-5 text-[#8DC63F]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                    Regra da tela
                  </p>
                </div>
                <div className="space-y-3">
                  {lanes.map((lane) => (
                    <div key={lane} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                      {lane}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Cards */}
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {modules.map((module, index) => (
              <motion.div
                key={module.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.06 * index }}
                className="group rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_4px_20px_rgba(64,64,64,0.06)] hover:border-[#8DC63F]/40 hover:shadow-[0_8px_30px_rgba(141,198,63,0.12)] transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8DC63F]/10 group-hover:bg-[#8DC63F]/20 transition-colors">
                    <module.icon className="w-5 h-5 text-[#8DC63F]" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <h2 className="mt-5 text-lg font-[950] tracking-[-0.03em] uppercase text-[#404040]">{module.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{module.description}</p>

                <Link
                  href={module.href}
                  className="mt-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-[#8DC63F] transition-transform group-hover:translate-x-1"
                >
                  Abrir módulo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </section>

          {/* Footer info */}
          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr] pb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="rounded-[34px] border border-gray-200 bg-white p-8 shadow-[0_4px_20px_rgba(64,64,64,0.06)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Fluxo</p>
                  <h3 className="mt-2 text-xl font-[950] tracking-[-0.04em] uppercase text-[#404040]">Como usar a tela</h3>
                </div>
                <MonitorSmartphone className="w-6 h-6 text-[#8DC63F]" />
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-4 h-4 text-[#8DC63F]" />
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#404040]">Escolher módulo</h4>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">
                    Cada área abre uma função específica do hub. Nada de KPI fixo aqui.
                  </p>
                </div>

                <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-[#f59e0b]" />
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#404040]">Entradas por usuário</h4>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">
                    A personalização real pode vir depois via perfil, permissão ou regra de negócio.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="rounded-[34px] border border-[#8DC63F]/20 bg-[#8DC63F]/5 p-8"
            >
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-[#8DC63F]" />
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">
                  Próxima evolução
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[22px] border border-[#8DC63F]/15 bg-white p-5">
                  <p className="text-sm leading-relaxed text-gray-500">
                    Quando quiser, a tela pode virar apenas um launcher ou ser substituída por visões
                    individuais de usuário.
                  </p>
                </div>

                <div className="rounded-[22px] border border-[#8DC63F]/15 bg-white p-5">
                  <p className="text-sm leading-relaxed text-gray-500">
                    O importante agora é evitar um dashboard que sugere um indicador único para todo mundo.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>
        </div>
      </main>
    </div>
  );
}
