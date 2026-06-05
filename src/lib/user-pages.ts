// Tipos e defaults — sem imports de Node.js (Edge Runtime safe)

export interface UserPages {
  chat: boolean
  dashboards: false | 'view' | 'edit'
  dashboardTables: string[]          // tabelas liberadas no dashboard ([] = nenhuma)
  monitoring: boolean
  zabbix: boolean
  whatsapp: boolean
  datalake: boolean
  rag: boolean
  netmeet: boolean
  custos: boolean
}

export const DEFAULT_PAGES: UserPages = {
  chat: true,
  dashboards: false,
  dashboardTables: [],
  monitoring: false,
  zabbix: false,
  whatsapp: false,
  datalake: false,
  rag: false,
  netmeet: true,
  custos: false,
}

export const SUPERADMIN_PAGES: UserPages = {
  chat: true,
  dashboards: 'edit',
  dashboardTables: [],               // superadmin usa 'all' via role, não precisa listar
  monitoring: true,
  zabbix: true,
  whatsapp: true,
  datalake: true,
  rag: true,
  netmeet: true,
  custos: true,
}

export function checkPagePermission(pathname: string, pages: UserPages): boolean {
  if (pathname.startsWith('/chat'))                   return pages.chat
  if (pathname.startsWith('/dashboards'))             return !!pages.dashboards
  if (pathname.startsWith('/dashboard/whatsapp'))     return pages.whatsapp
  if (pathname.startsWith('/dashboard/comunicacao'))  return pages.whatsapp
  if (pathname.startsWith('/dashboard/netmeet'))      return pages.netmeet
  if (pathname.startsWith('/dashboard/noc'))          return pages.monitoring
  if (pathname.startsWith('/dashboard/alertas'))      return pages.monitoring
  if (pathname.startsWith('/dashboard/status'))       return pages.monitoring
  if (pathname.startsWith('/dashboard/custos'))       return pages.custos
  if (pathname.startsWith('/monitoring/zabbix'))      return pages.zabbix
  if (pathname.startsWith('/monitoring'))             return pages.monitoring
  if (pathname.startsWith('/datalake'))               return pages.datalake
  if (pathname.startsWith('/rag'))                    return pages.rag
  return true
}
