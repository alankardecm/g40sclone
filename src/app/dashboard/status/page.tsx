'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ServiceStatus {
  status: 'ok' | 'error' | 'unknown';
  message: string | null;
}

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    supabase: ServiceStatus;
    mysql: ServiceStatus;
    openai: ServiceStatus;
  };
}

export default function StatusPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health/full');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const StatusCard = ({ title, status, message }: { title: string; status: string; message: string | null }) => (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#143230]">{title}</h3>
        {status === 'ok' ? (
          <CheckCircle2 className="text-emerald-500" size={24} />
        ) : (
          <XCircle className="text-rose-500" size={24} />
        )}
      </div>
      <div className="mt-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {status === 'ok' ? 'Conectado' : 'Erro de Conexão'}
        </span>
        {message && <p className="mt-2 text-xs text-rose-600 line-clamp-2">{message}</p>}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-[#379890] transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar para Home
            </Link>
            <h1 className="mt-2 text-3xl font-black text-[#143230] uppercase">Status do Sistema</h1>
            <p className="text-muted-foreground text-sm">Monitoramento em tempo real das conexões do Hub</p>
          </div>
          <button 
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center rounded-full bg-card px-4 py-2 text-sm font-bold border border-border shadow-sm hover:bg-background disabled:opacity-50 transition-all"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </header>

        {loading && !data ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : data && (
          <div className="grid gap-6 md:grid-cols-3">
            <StatusCard title="Supabase" status={data.services.supabase.status} message={data.services.supabase.message} />
            <StatusCard title="MySQL Data Lake" status={data.services.mysql.status} message={data.services.mysql.message} />
            <StatusCard title="OpenAI" status={data.services.openai.status} message={data.services.openai.message} />
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Última verificação: {data ? new Date(data.timestamp).toLocaleString('pt-BR') : '-'}
        </footer>
      </div>
    </main>
  );
}
