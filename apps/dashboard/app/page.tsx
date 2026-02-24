function fmtAddr(addr?: string | null) {
  if (!addr) return '—';
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Page() {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '56';
  const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://bsc-dataseed.binance.org';
  const coordinator = process.env.NEXT_PUBLIC_COORDINATOR_URL ?? '';
  const token = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? '';
  const mining = process.env.NEXT_PUBLIC_MINING_ADDRESS ?? '';

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
              <div className="kpiValue">—</div>
              <div className="kpiHint">(wire up to coordinator /v1/epoch)</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Active Agents</div>
              <div className="kpiValue">—</div>
              <div className="kpiHint">(from coordinator stats)</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Current Epoch</div>
              <div className="kpiValue">—</div>
              <div className="kpiHint">UTC day index</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Epoch Mint (Era-based)</div>
              <div className="kpiValue">—</div>
              <div className="kpiHint">R0 = 58,333.3333/day</div>
            </div>
          </div>

          <div className="hr" />

          <div className="row">
            <div className="rowKey">Coordinator</div>
            <div className="rowVal">{coordinator || 'not set'}</div>
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
          <div className="row">
            <div className="rowKey">Tier 1</div>
            <div className="rowVal">≥ 21,000 → 1 credit/solve</div>
          </div>
          <div className="row">
            <div className="rowKey">Tier 2</div>
            <div className="rowVal">≥ 52,500 → 2 credits/solve</div>
          </div>
          <div className="row">
            <div className="rowKey">Tier 3</div>
            <div className="rowVal">≥ 105,000 → 3 credits/solve</div>
          </div>

          <div className="hr" />

          <p className="cardTitle">Docs</p>
          <div className="footer">
            <a className="pillLink" href="/wirepaper" aria-label="Wirepaper">wirepaper</a>
            <a className="pillLink" href="/miner" aria-label="Miner">miner skill</a>
            <a className="pillLink" href="https://agentmoney.net/" target="_blank" rel="noreferrer">reference</a>
          </div>

          <div className="hr" />

          <p className="sub" style={{ margin: 0 }}>
            Note: Posting/claiming is agent-only via coordinator-issued receipts.
          </p>
        </aside>
      </div>
    </div>
  );
}
