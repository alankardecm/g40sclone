'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, RefreshCw, Wifi, WifiOff, Loader2, QrCode, Link2, Send,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Instance = {
  id: string;
  name: string;
  connectionStatus: string;
  profileName?: string | null;
  profilePicUrl?: string | null;
};

type InstanceDetail = {
  name: string;
  state: string;
  qrcode: string | null;
  pairingCode: string | null;
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [instances, setInstances]         = useState<Instance[]>([]);
  const [loading, setLoading]             = useState(true);
  const [newName, setNewName]             = useState('');
  const [creating, setCreating]           = useState(false);
  const [selected, setSelected]           = useState<InstanceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [sendTo, setSendTo]               = useState('');
  const [sendText, setSendText]           = useState('');
  const [sending, setSending]             = useState(false);
  const [feedback, setFeedback]           = useState('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4300';

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/evolution/instances');
      const data: Instance[] = await res.json();
      setInstances(Array.isArray(data) ? data : []);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  // Polling automático enquanto a instância estiver conectando
  useEffect(() => {
    if (!selected || selected.state === 'open') return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/evolution/instances/${selected.name}`);
      const data: InstanceDetail = await res.json();
      setSelected(data);
      if (data.state === 'open') {
        clearInterval(timer);
        fetchInstances();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [selected?.state, selected?.name, fetchInstances]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setNewName('');
      await fetchInstances();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Excluir instância "${name}"?`)) return;
    await fetch(`/api/evolution/instances/${name}`, { method: 'DELETE' });
    if (selected?.name === name) setSelected(null);
    await fetchInstances();
  }

  async function openDetail(name: string) {
    setLoadingDetail(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/evolution/instances/${name}`);
      const data: InstanceDetail = await res.json();
      setSelected(data);
      setWebhookUrl(`${appUrl}/api/evolution/webhook`);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleLogout() {
    if (!selected) return;
    await fetch(`/api/evolution/instances/${selected.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    await openDetail(selected.name);
  }

  async function handleSetWebhook() {
    if (!selected || !webhookUrl) return;
    await fetch(`/api/evolution/instances/${selected.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'webhook', webhookUrl }),
    });
    setFeedback('Webhook configurado com sucesso.');
    setTimeout(() => setFeedback(''), 3000);
  }

  function formatNumber(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    // Adiciona 55 se não começar com código de país
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  }

  async function handleSend() {
    if (!selected || !sendTo || !sendText) return;
    setSending(true);
    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: selected.name, to: formatNumber(sendTo), text: sendText }),
      });
      const data = await res.json();
      setFeedback(res.ok ? 'Mensagem enviada.' : `Erro: ${data.error}`);
      if (res.ok) { setSendTo(''); setSendText(''); }
    } finally {
      setSending(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  const stateColor = (s: string) =>
    s === 'open' ? 'text-emerald-600' : s === 'connecting' || s === 'qrcode' ? 'text-amber-500' : 'text-red-500';

  const stateLabel = (s: string) =>
    s === 'open' ? 'Conectado' : s === 'connecting' || s === 'qrcode' ? 'Conectando…' : 'Desconectado';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9fafb]">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#E6EAF3]/8 bg-card px-6 py-4">
          <div>
            <h1 className="text-base font-bold text-[#E6EAF3]">WhatsApp — Evolution API</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Gerencie instâncias e configure webhooks</p>
          </div>
          <button
            onClick={fetchInstances}
            className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6]/10 px-3 py-1.5 text-[11px] font-bold text-[#3B82F6] hover:bg-[#3B82F6]/20 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">

          {/* Lista de instâncias */}
          <aside className="w-72 flex-shrink-0 border-r border-[#E6EAF3]/8 bg-card flex flex-col">
            {/* Criar nova instância */}
            <div className="p-4 border-b border-[#E6EAF3]/8">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Nova instância</p>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="nome-da-instancia"
                  className="flex-1 rounded-lg border border-[#E6EAF3]/15 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex items-center gap-1 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2563EB] disabled:opacity-50 transition"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
                </div>
              )}
              {!loading && instances.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">Nenhuma instância criada.</p>
              )}
              {instances.map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => openDetail(inst.name)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition ${
                    selected?.name === inst.name
                      ? 'bg-[#3B82F6]/10 ring-1 ring-[#3B82F6]/30'
                      : 'hover:bg-background'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#E6EAF3] truncate">{inst.name}</p>
                    {inst.profileName && (
                      <p className="text-[10px] text-muted-foreground truncate">{inst.profileName}</p>
                    )}
                    <p className={`text-[10px] font-semibold mt-0.5 ${stateColor(inst.connectionStatus)}`}>
                      {stateLabel(inst.connectionStatus)}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(inst.name); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Painel de detalhes */}
          <section className="flex-1 overflow-y-auto p-6">
            {loadingDetail && (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-[#3B82F6]" />
              </div>
            )}

            {!loadingDetail && !selected && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <QrCode className="h-10 w-10 opacity-30" />
                <p className="text-sm">Selecione uma instância para ver os detalhes</p>
              </div>
            )}

            {!loadingDetail && selected && (
              <div className="max-w-xl flex flex-col gap-5">

                {/* Status */}
                <div className="rounded-2xl border border-[#E6EAF3]/8 bg-card p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Instância</p>
                    <p className="font-bold text-[#E6EAF3]">{selected.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${stateColor(selected.state)}`}>
                      {stateLabel(selected.state)}
                    </span>
                    {selected.state === 'open'
                      ? <Wifi className="h-4 w-4 text-emerald-500" />
                      : <WifiOff className="h-4 w-4 text-red-400" />}
                  </div>
                </div>

                {/* QR Code */}
                {selected.state !== 'open' && (
                  <div className="rounded-2xl border border-[#E6EAF3]/8 bg-card p-5 flex flex-col items-center gap-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Escanear QR Code</p>
                    {selected.qrcode ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.qrcode}
                        alt="QR Code WhatsApp"
                        className="w-52 h-52 rounded-xl"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">QR Code não disponível. Tente reconectar.</p>
                    )}
                    {selected.pairingCode && (
                      <p className="text-xs text-muted-foreground">
                        Código de pareamento: <span className="font-mono font-bold">{selected.pairingCode}</span>
                      </p>
                    )}
                    <button
                      onClick={() => openDetail(selected.name)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6]/10 px-4 py-2 text-xs font-bold text-[#3B82F6] hover:bg-[#3B82F6]/20 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Gerar novo QR
                    </button>
                  </div>
                )}

                {/* Logout se conectado */}
                {selected.state === 'open' && (
                  <button
                    onClick={handleLogout}
                    className="self-start flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition"
                  >
                    <WifiOff className="h-3.5 w-3.5" /> Desconectar
                  </button>
                )}

                {/* Webhook */}
                <div className="rounded-2xl border border-[#E6EAF3]/8 bg-card p-5 flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> Webhook
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      placeholder="https://seu-hub/api/evolution/webhook"
                      className="flex-1 rounded-lg border border-[#E6EAF3]/15 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    />
                    <button
                      onClick={handleSetWebhook}
                      className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:bg-[#2563EB] transition"
                    >
                      Salvar
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    URL que a Evolution API usará para enviar mensagens recebidas ao HUB.
                  </p>
                </div>

                {/* Enviar mensagem de teste */}
                <div className="rounded-2xl border border-[#E6EAF3]/8 bg-card p-5 flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Enviar mensagem de teste
                  </p>
                  <input
                    value={sendTo}
                    onChange={e => setSendTo(e.target.value.replace(/\D/g, ''))}
                    placeholder="19999999999 (só números, DDI 55 automático)"
                    className="rounded-lg border border-[#E6EAF3]/15 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                  />
                  <textarea
                    value={sendText}
                    onChange={e => setSendText(e.target.value)}
                    placeholder="Mensagem…"
                    rows={3}
                    className="rounded-lg border border-[#E6EAF3]/15 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !sendTo || !sendText}
                    className="self-start flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:bg-[#2563EB] disabled:opacity-50 transition"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Enviar
                  </button>
                </div>

                {/* Feedback */}
                {feedback && (
                  <div className="rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 px-4 py-3 text-xs font-semibold text-[#3B82F6]">
                    {feedback}
                  </div>
                )}

              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
