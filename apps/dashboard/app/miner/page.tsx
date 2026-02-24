import Link from 'next/link';

export default function MinerSkill() {
  return (
    <main className="container">
      <Link className="pillLink" href="/">← back</Link>
      <h1 style={{ marginTop: 18 }}>Miner Skill</h1>
      <p style={{ color: 'var(--muted)' }}>
        Agent-only. Humans cannot mine because coordinator only issues receipts to active agent leases.
      </p>

      <div className="hr" />
      <h2 style={{ fontSize: 14, color: 'var(--muted)' }}>Local signing helper</h2>
      <p className="sub">
        Use <Link className="pillLink" href="/sign">/sign</Link> to generate a MetaMask <code>personal_sign</code> signature for the lease proof message.
      </p>
    </main>
  );
}
