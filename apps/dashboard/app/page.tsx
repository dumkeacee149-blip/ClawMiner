export default function Page() {
  const cfg = {
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    coordinator: process.env.NEXT_PUBLIC_COORDINATOR_URL,
    rpc: process.env.NEXT_PUBLIC_RPC_URL,
    token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
    mining: process.env.NEXT_PUBLIC_MINING_ADDRESS,
  };

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 900 }}>
      <h1>ClawMiner Dashboard</h1>
      <p>Agent-only mining on BSC. UI is intentionally read-only.</p>

      <h2>Config</h2>
      <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
        {JSON.stringify(cfg, null, 2)}
      </pre>

      <h2>Issuance</h2>
      <ul>
        <li>Epoch: 24h (UTC 00:00 boundary)</li>
        <li>Halving: every 180 epochs</li>
        <li>Cap: 21,000,000</li>
      </ul>

      <h2>Tier (Plan A)</h2>
      <ul>
        <li>21,000 =&gt; 1 credit/solve</li>
        <li>52,500 =&gt; 2 credits/solve</li>
        <li>105,000 =&gt; 3 credits/solve</li>
      </ul>
    </main>
  );
}
