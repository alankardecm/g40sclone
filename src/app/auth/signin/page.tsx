import { signIn } from "@/lib/auth"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect("/")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "BOM DIA" : hour < 18 ? "BOA TARDE" : "BOA NOITE"

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: "#000D00" }}
    >
      {/* Grade cyberpunk de fundo */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(172,208,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(172,208,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow central */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(54,80,3,0.4) 0%, transparent 70%)",
        }}
      />

      {/* Scanlines */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, #ACD000, #ACD000 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative w-full max-w-sm z-10">

        {/* Card principal */}
        <div
          className="rounded-2xl p-px"
          style={{
            background: "linear-gradient(135deg, #749202 0%, #365003 50%, #749202 100%)",
            boxShadow: "0 0 40px rgba(172,208,0,0.12), 0 0 80px rgba(172,208,0,0.06)",
          }}
        >
          <div
            className="rounded-2xl p-8 flex flex-col gap-7"
            style={{ backgroundColor: "#001B00" }}
          >

            {/* Logo */}
            <div className="flex items-center justify-between">
              <span className="text-xl font-[1000] tracking-[-0.04em] uppercase" style={{ color: "#ACD000", textShadow: "0 0 10px rgba(172,208,0,0.3)" }}>
                {process.env.NEXT_PUBLIC_APP_NAME || "G4OS"}
              </span>

              {/* Status pill */}
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: "#000D00", border: "1px solid #365003" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "#ACD000", boxShadow: "0 0 6px #ACD000" }}
                />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: "#749202" }}>
                  Online
                </span>
              </div>
            </div>

            {/* Divisor */}
            <div className="h-px w-full" style={{ backgroundColor: "#365003" }} />

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: "#365003" }}>
                {greeting} — AUTENTICAÇÃO SEGURA
              </p>
              <h1
                className="text-[28px] font-[900] tracking-[-0.03em] leading-tight"
                style={{ color: "#ACD000", textShadow: "0 0 20px rgba(172,208,0,0.3)" }}
              >
                Acesse o<br />{process.env.NEXT_PUBLIC_APP_NAME || "G4OS"}.
              </h1>
            </div>

            {/* Botão */}
            <form
              action={async () => {
                "use server"
                await signIn("microsoft-entra-id", { redirectTo: "/" })
              }}
            >
              <button
                type="submit"
                className="signin-btn group w-full flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: "#000D00",
                  border: "1px solid #749202",
                }}
              >
                {/* Ícone Microsoft */}
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#001B00", border: "1px solid #365003" }}
                >
                  <svg viewBox="0 0 21 21" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h10v10H0z" fill="#F25022"/>
                    <path d="M11 0h10v10H11z" fill="#7FBA00"/>
                    <path d="M0 11h10v10H0z" fill="#00A4EF"/>
                    <path d="M11 11h10v10H11z" fill="#FFB900"/>
                  </svg>
                </span>

                <span className="flex-1 text-left">
                  <span
                    className="block text-[11px] font-black uppercase tracking-[0.18em]"
                    style={{ color: "#ACD000" }}
                  >
                    Entrar com Microsoft
                  </span>
                  <span
                    className="block text-[9px] font-semibold mt-0.5 uppercase tracking-[0.1em]"
                    style={{ color: "#749202" }}
                  >
                    Conta corporativa autorizada
                  </span>
                </span>

                <svg
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  style={{ color: "#749202" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>

            {/* Divisor */}
            <div className="h-px w-full" style={{ backgroundColor: "#365003" }} />

            {/* Rodapé */}
            <p
              className="text-center text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "#365003" }}
            >
              Acesso restrito · Área Autorizada
            </p>
          </div>
        </div>

        {/* Versão */}
        <p
          className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.25em]"
          style={{ color: "#365003" }}
        >
          {process.env.NEXT_PUBLIC_APP_NAME || "G4OS"} v1.0 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
