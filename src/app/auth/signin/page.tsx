import { signIn } from "@/lib/auth"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LogoMark } from "@/components/brand/Logo"
import { brand } from "@/lib/brand"

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect("/")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      {/* Fundo premium dark */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px circle at 20% 0%, rgba(59,130,246,0.20), transparent 45%)," +
            "radial-gradient(700px circle at 100% 100%, rgba(34,211,238,0.12), transparent 40%)," +
            "#0a0f1e",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,160,255,0.05) 1px, transparent 1px),linear-gradient(90deg, rgba(120,160,255,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="surface overflow-hidden p-8">
          {/* Marca */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size={42} className="shadow-[0_8px_22px_-8px_rgba(79,70,229,0.6)]" />
              <div className="leading-none">
                <p className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">{brand.name}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-primary">{brand.subtitle}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Online</span>
            </span>
          </div>

          <div className="my-7 h-px w-full bg-border" />

          {/* Heading */}
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
            {greeting} — Acesso seguro
          </p>
          <h1 className="mt-2 text-[26px] font-[900] leading-tight tracking-[-0.03em] text-foreground">
            Entre no <span className="brand-text-gradient">{brand.name}</span>.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {brand.tagline}
          </p>

          {/* Botão de login */}
          <form
            action={async () => {
              "use server"
              await signIn("microsoft-entra-id", { redirectTo: "/" })
            }}
            className="mt-7"
          >
            <button
              type="submit"
              className="signin-btn group flex w-full items-center gap-4 rounded-xl border border-border bg-white/[0.03] px-5 py-4 transition-all duration-200 cursor-pointer"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <svg viewBox="0 0 21 21" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 0h10v10H0z" fill="#F25022" />
                  <path d="M11 0h10v10H11z" fill="#7FBA00" />
                  <path d="M0 11h10v10H0z" fill="#00A4EF" />
                  <path d="M11 11h10v10H11z" fill="#FFB900" />
                </svg>
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[12px] font-extrabold tracking-[0.01em] text-foreground">
                  Entrar com Microsoft
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground">
                  Conta corporativa autorizada
                </span>
              </span>
              <svg
                className="h-4 w-4 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </form>

          <p className="mt-7 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Acesso restrito · Área autorizada
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          {brand.company} · {brand.name} v{brand.version} · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
