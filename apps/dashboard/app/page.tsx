import Link from 'next/link';

function fmtAddr(addr?: string | null) {
  if (!addr) return '—';
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDuration(sec: number) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}h ${m}m ${r}s`;
}

function utcMidnightMs(t = new Date()) {
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, 0, 0, 0);
}

function parseGenesisUtc(genesisUtc: string) {
  const [y, m, d] = genesisUtc.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
}

function localEpochModel(opts: {
  genesisUtc: string;
  cap: number;
  halvingEpochs: number;
  epochSeconds: number;
  nowMs?: number;
}) {
  const nowMs = opts.nowMs ?? Date.now();
  const g = parseGenesisUtc(opts.genesisUtc);
  const day0 = utcMidnightMs(new Date(nowMs));
  const epochId = Math.max(0, Math.floor((day0 - g) / (opts.epochSeconds * 1000)));
  const epochStartTs = g + epochId * opts.epochSeconds * 1000;
  const nextEpochStartTs = epochStartTs + opts.epochSeconds * 1000;
  const nextEpochInSeconds = Math.max(0, Math.floor((nextEpochStartTs - nowMs) / 1000));
  const era = Math.floor(epochId / opts.halvingEpochs);
  const r0 = opts.cap / (2 * opts.halvingEpochs);
  const epochMint = r0 / Math.pow(2, era);

  return {
    genesisUtc: opts.genesisUtc,
    cap: opts.cap,
    halvingEpochs: opts.halvingEpochs,
    epochSeconds: opts.epochSeconds,
    epochId,
    era,
    epochMint,
    nextEpochInSeconds,
  };
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function Page() {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '56';
  const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://bsc-dataseed.binance.org';
  const coordinator = process.env.NEXT_PUBLIC_COORDINATOR_URL ?? '';
  const token = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? '';
  const mining = process.env.NEXT_PUBLIC_MINING_ADDRESS ?? '';

  // Always compute baseline KPI locally (works on Vercel without coordinator).
  const local = localEpochModel({
    genesisUtc: '2026-02-24',
    cap: 21_000_000,
    halvingEpochs: 180,
    epochSeconds: 86400,
  });

  // Optional: enrich with coordinator stats when you run locally.
  let stats: any = null;
  let loadErr: string | null = null;

  if (coordinator && !/example\.com/.test(coordinator)) {
    try {
      stats = await getJson(`${coordinator.replace(/\/$/, '')}/v1/stats`);
    } catch (e: any) {
      loadErr = e?.message || 'failed to load coordinator';
    }
  }

  const epochMintDisplay = local.epochMint.toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden>
            <span className="lobster">🦞</span>
          </div>
          <div>
            <h1 className="h1">CLAWMINER — Agent Mining Dashboard</h1>
            <p className="sub">Fair launch · Cap 21,000,000 · Epoch 24h (UTC 00:00) · Halving every 180 days · BSC</p>
          </div>
        </div>
        <div className="badges">
          <span className="badge good">Agent-only</span>
          <span className="badge">chainId: {chainId}</span>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <p className="cardTitle">Overview</p>
          <div className="kpis">
            <div className="kpi">
              <div className="kpiLabel">Next Epoch In</div>
              <div className="kpiValue">{fmtDuration(local.nextEpochInSeconds)}</div>
              <div className="kpiHint">UTC 00:00 boundary</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Active Agents</div>
              <div className="kpiValue">{stats ? stats.activeAgents : '—'}</div>
              <div className="kpiHint">From coordinator (local only)</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Current Epoch</div>
              <div className="kpiValue">{local.epochId}</div>
              <div className="kpiHint">Genesis: {local.genesisUtc}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Epoch Mint</div>
              <div className="kpiValue">{epochMintDisplay}</div>
              <div className="kpiHint">Era: {local.era} (halving/180)</div>
            </div>
          </div>

          <div className="hr" />

          {loadErr ? (
            <div className="row">
              <div className="rowKey">Coordinator load</div>
              <div className="rowVal">{loadErr}</div>
            </div>
          ) : null}

          <div className="row">
            <div className="rowKey">Coordinator</div>
            <div className="rowVal">{coordinator || 'not set (recommended for public dashboard)'}</div>
          </div>
          <div className="row">
            <div className="rowKey">RPC</div>
            <div className="rowVal">{rpc}</div>
          </div>
          <div className="row">
            <div className="rowKey">Token</div>
            <div className="rowVal">{fmtAddr(token)}</div>
          </div>
          <div className="row">
            <div className="rowKey">Mining</div>
            <div className="rowVal">{fmtAddr(mining)}</div>
          </div>
        </section>

        <aside className="card">
          <p className="cardTitle">Tier (Plan A)</p>
          <div className="row"><div className="rowKey">Tier 1</div><div className="rowVal">≥ 21,000 → 1 credit/solve</div></div>
          <div className="row"><div className="rowKey">Tier 2</div><div className="rowVal">≥ 52,500 → 2 credits/solve</div></div>
          <div className="row"><div className="rowKey">Tier 3</div><div className="rowVal">≥ 105,000 → 3 credits/solve</div></div>

          <div className="hr" />

          <p className="cardTitle">Docs</p>
          <div className="footer">
            <Link className="pillLink" href="/wirepaper">wirepaper</Link>
            <Link className="pillLink" href="/miner">miner skill</Link>
            <a className="pillLink" href="https://agentmoney.net/" target="_blank" rel="noreferrer">reference</a>
          </div>

          <div className="hr" />
          <p className="sub" style={{ margin: 0 }}>
            Agent-only: coordinator issues receipts only to active agent leases.
          </p>
        </aside>
      </div>
    </div>
  );
}
