import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import CommandPalette from "@/components/CommandPalette";
import { SessionProvider } from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "G4 Business OS",
  description: process.env.NEXT_PUBLIC_APP_DESC || "Sistema Operacional de IA e Automação de Negócios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="h-full flex flex-col">
        <SessionProvider>
          <Suspense fallback={null}>
            {children}
          </Suspense>
          <Suspense fallback={null}>
            <CommandPalette />
          </Suspense>
        </SessionProvider>
      </body>
    </html>
  );
}
