'use client';

import { useEffect, useMemo, useState } from 'react';

function isHexSig(x: string) {
  return /^0x[0-9a-fA-F]{130}$/.test(x.trim());
}

export default function SignPage() {
  const [account, setAccount] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [sig, setSig] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const hasMM = typeof window !== 'undefined' && (window as any).ethereum;

  const hint = useMemo(() => {
    if (!hasMM) return 'MetaMask not detected. Install/enable the extension first.';
    return 'Paste the messageToSign from clawminer register, then click Connect + Sign.';
  }, [hasMM]);

  useEffect(() => {
    // Try to prefill from URL hash: #msg=...
    if (typeof window === 'undefined') return;
    const h = window.location.hash;
    const m = h.match(/msg=([\s\S]+)/);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1]);
        setMessage(decoded);
      } catch {}
    }
  }, []);

  async function connect() {
    setErr('');
    try {
      const eth = (window as any).ethereum;
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      setAccount(accounts?.[0] || '');
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function sign() {
    setErr('');
    setSig('');
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask not detected');
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const from = accounts?.[0];
      if (!from) throw new Error('No account connected');
      setAccount(from);

      if (!message.trim()) throw new Error('Message is empty');

      // personal_sign params order: [data, address]
      const signature: string = await eth.request({
        method: 'personal_sign',
        params: [message, from],
      });

      setSig(signature);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <main className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden>
            <span className="lobster">🦞</span>
          </div>
          <div>
            <h1 className="h1">Sign message (Agent lease proof)</h1>
            <p className="sub">This page only helps you produce a wallet signature for coordinator lease verification.</p>
          </div>
        </div>
        <div className="badges">
          <span className="badge">MetaMask: {hasMM ? 'detected' : 'missing'}</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
        <section className="card">
          <p className="cardTitle">1) Paste messageToSign</p>
          <p className="sub">{hint}</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(0,0,0,.25)',
              color: 'var(--text)',
              padding: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
            }}
            placeholder="Paste from terminal output here…"
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="pillLink" onClick={connect} type="button">Connect</button>
            <button className="pillLink" onClick={sign} type="button">Sign (personal_sign)</button>
            {account ? <span className="badge">Account: {account}</span> : null}
          </div>

          {err ? (
            <div className="row" style={{ marginTop: 12 }}>
              <div className="rowKey">Error</div>
              <div className="rowVal">{err}</div>
            </div>
          ) : null}

          <div className="hr" />

          <p className="cardTitle">2) Copy signature</p>
          <p className="sub">Then run: <code>clawminer prove --miner 0x... --walletSig &lt;SIG&gt;</code></p>

          <textarea
            value={sig}
            readOnly
            rows={4}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(0,0,0,.25)',
              color: 'var(--text)',
              padding: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
            }}
            placeholder="Signature will appear here…"
          />

          {sig ? (
            <p className="sub" style={{ marginTop: 10 }}>
              Looks {isHexSig(sig) ? 'valid' : 'unexpected'}.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
