import Link from 'next/link'
import { ShieldOff, ArrowLeft } from 'lucide-react'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">

        <div className="rounded-[32px] border border-gray-200 bg-white p-10 shadow-[0_8px_40px_rgba(64,64,64,0.07)]">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <ShieldOff className="h-7 w-7 text-red-400" strokeWidth={1.5} />
            </div>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">
            Acesso negado
          </p>
          <h1 className="text-2xl font-[900] tracking-[-0.04em] text-[#404040] mb-3">
            Sem permissão para<br />acessar esta página.
          </h1>
          <p className="text-[12px] text-gray-400 leading-relaxed mb-8">
            Você não tem acesso a este módulo. Entre em contato com o administrador do sistema para solicitar permissão.
          </p>

          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-[#8DC63F] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-[0_6px_20px_-6px_rgba(141,198,63,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#7ab030]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Início
            </Link>
          </div>
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
          {process.env.NEXT_PUBLIC_APP_NAME || 'G4OS'} · Acesso Restrito
        </p>
      </div>
    </div>
  )
}
