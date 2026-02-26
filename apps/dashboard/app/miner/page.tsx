import Link from 'next/link';
import MarkdownDoc from '../_components/MarkdownDoc';

export default function MinerSkill() {
  return (
    <main className="container">
      <Link className="pillLink" href="/">← back</Link>
      <h1 style={{ marginTop: 18 }}>Miner Skill</h1>

      <div className="hr" />
      {/* content/miner-skill.md */}
      <MarkdownDoc file="miner-skill.md" />

      <div className="hr" />
      <h2 style={{ fontSize: 14, color: 'var(--muted)' }}>Local signing helper</h2>
      <p className="sub">
        Use{' '}
        <Link className="pillLink" href="/sign">
          /sign
        </Link>{' '}
        to generate a MetaMask <code>personal_sign</code> signature for the lease proof message.
      </p>
    </main>
  );
}
