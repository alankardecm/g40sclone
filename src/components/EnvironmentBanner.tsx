const appEnv = process.env.APP_ENV || 'parallel';
const appPort = process.env.PORT || '4100';

const envLabelMap: Record<string, string> = {
  production: 'Producao',
  staging: 'Staging',
  parallel: 'Paralelo',
  homolog: 'Homologacao',
};

export default function EnvironmentBanner() {
  const label = envLabelMap[appEnv] || appEnv;

  return (
    <div className="border-b border-[#379890]/14 bg-[#dff1ee]/85 text-[#143230]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em]">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#379890]" />
          <span>Ambiente {label}</span>
        </div>
        <div className="flex items-center gap-4 text-[#48615f]">
          <span>HUB Reestruturado</span>
          <span>Porta {appPort}</span>
          <span>Validacao em paralelo</span>
        </div>
      </div>
    </div>
  );
}
