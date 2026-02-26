'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { encodeFunctionData, parseAbi } from 'viem';

type Hex = `0x${string}`;

type Json = Record<string, unknown>;

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<any>;
}

interface ConfigResp {
  chainId: number;
  miningContract: string | null;
  coordinatorSigner: string | null;
  tokenMode: string;
}

interface Receipt {
  chainId: number;
  epochId: number;
  miner: Hex;
  challengeId: Hex;
  nonceHash: Hex;
  creditsAmount: number;
  artifactHash: Hex;
  issuedAt: number;
}

interface SubmitResp {
  pass: boolean;
  epochId: number;
  credits: number;
  artifact: string;
  receipt: Receipt;
  signature: Hex | null;
  signer: Hex | null;
  warning?: string;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const MINING_ABI = parseAbi([
  'function submitReceipt((uint256 chainId,uint256 epochId,address miner,bytes32 challengeId,bytes32 nonceHash,uint256 creditsAmount,bytes32 artifactHash,uint256 issuedAt) r, bytes sig)',
]);

function provider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  return ((window as any).ethereum as EthereumProvider | undefined) || null;
}

function isHexAddr(v: string): v is Hex {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

async function jsonFetch<T = Json>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const text = await res.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(payload)}`);
  }
  return payload as T;
}

function expectedArtifactFromChallenge(ch: any): string | null {
  const lines: string[] = [];
  if (Array.isArray(ch?.questions)) lines.push(...ch.questions.filter((x: unknown) => typeof x === 'string'));
  if (Array.isArray(ch?.constraints)) lines.push(...ch.constraints.filter((x: unknown) => typeof x === 'string'));

  for (const line of lines) {
    const m = line.match(/(?:Return exactly:|Artifact must equal:)\s*([^\s]+)/i);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export default function MinePage() {
  const [account, setAccount] = useState<string>('');
  const [config, setConfig] = useState<ConfigResp | null>(null);
  const [miningAddressInput, setMiningAddressInput] = useState<string>(ZERO_ADDR);
  const [leaseToken, setLeaseToken] = useState<string>('');
  const [submitResp, setSubmitResp] = useState<SubmitResp | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);

  const hasMM = useMemo(() => Boolean(provider()), []);

  function pushLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 40));
  }

  useEffect(() => {
    jsonFetch<ConfigResp>('/v1/config')
      .then((c) => {
        setConfig(c);
        setMiningAddressInput(c.miningContract || ZERO_ADDR);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem('claw_lease_token') || '';
    if (cached) setLeaseToken(cached);
  }, []);

  async function connect() {
    setErr('');
    const eth = provider();
    if (!eth) {
      setErr('MetaMask not detected');
      return;
    }
    try {
      const accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      setAccount((accs?.[0] || '').toLowerCase());
      pushLog('wallet connected');
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function startLease() {
    setErr('');
    setSubmitResp(null);
    setTxHash('');
    const eth = provider();
    if (!eth) {
      setErr('MetaMask not detected');
      return;
    }
    if (!window.isSecureContext) {
      setErr('Browser secure context required for agent key generation');
      return;
    }
    setBusy('leasing');
    try {
      const accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const miner = (accs?.[0] || '').toLowerCase();
      if (!isHexAddr(miner)) throw new Error('No wallet account connected');
      setAccount(miner);

      // Browser-side agent key for ed25519 lease proof.
      const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify']
      )) as CryptoKeyPair;
      const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      const agentPubKey = bytesToB64(new Uint8Array(spki));

      const reg = await jsonFetch<{
        serverNonce: string;
        messageToSign: string;
        registerToken: string;
      }>('/v1/agent/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ miner, agentPubKey }),
      });
      pushLog('register ok');

      const walletSig = (await eth.request({
        method: 'personal_sign',
        params: [reg.messageToSign, miner],
      })) as Hex;
      pushLog('wallet personal_sign ok');

      const agentSigBuf = await crypto.subtle.sign(
        'Ed25519',
        keyPair.privateKey,
        new TextEncoder().encode(reg.serverNonce)
      );
      const agentSig = bytesToB64(new Uint8Array(agentSigBuf));

      const prove = await jsonFetch<{ leaseToken: string; expiresInSeconds: number }>('/v1/agent/prove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          miner,
          walletSig,
          agentSig,
          registerToken: reg.registerToken,
        }),
      });

      setLeaseToken(prove.leaseToken);
      window.localStorage.setItem('claw_lease_token', prove.leaseToken);
      pushLog(`prove ok (lease ttl ${prove.expiresInSeconds}s)`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  async function mineOnce() {
    setErr('');
    setSubmitResp(null);
    setTxHash('');
    if (!leaseToken) {
      setErr('No lease token. Click "Start Agent Lease" first.');
      return;
    }

    setBusy('mining');
    try {
      const nonce = `web-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const ch = await jsonFetch<any>(`/v1/challenge?nonce=${encodeURIComponent(nonce)}`, {
        headers: { authorization: `Bearer ${leaseToken}` },
      });
      const artifact = expectedArtifactFromChallenge(ch);
      if (!artifact) throw new Error('Cannot parse expected artifact from challenge payload');
      pushLog(`challenge ok (${ch.challengeId})`);

      const sub = await jsonFetch<SubmitResp>('/v1/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${leaseToken}`,
        },
        body: JSON.stringify({ nonce, artifact }),
      });
      setSubmitResp(sub);
      pushLog(`submit ok (pass=${sub.pass ? 'true' : 'false'})`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  async function ensureBscMainnet(eth: EthereumProvider) {
    const cid = (await eth.request({ method: 'eth_chainId' })) as string;
    if (cid?.toLowerCase() === '0x38') return;
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x38' }],
    });
  }

  async function submitOnchain() {
    setErr('');
    if (!submitResp?.receipt || !submitResp.signature) {
      setErr('No signed receipt available. Run "Mine Once" first.');
      return;
    }
    const eth = provider();
    if (!eth) {
      setErr('MetaMask not detected');
      return;
    }
    if (!isHexAddr(account)) {
      setErr('Wallet not connected');
      return;
    }
    const to = miningAddressInput.trim();
    if (!isHexAddr(to) || to.toLowerCase() === ZERO_ADDR) {
      setErr('Invalid Mining contract address');
      return;
    }

    setBusy('onchain');
    try {
      await ensureBscMainnet(eth);
      const receiptArg = {
        chainId: BigInt(submitResp.receipt.chainId),
        epochId: BigInt(submitResp.receipt.epochId),
        miner: submitResp.receipt.miner,
        challengeId: submitResp.receipt.challengeId,
        nonceHash: submitResp.receipt.nonceHash,
        creditsAmount: BigInt(submitResp.receipt.creditsAmount),
        artifactHash: submitResp.receipt.artifactHash,
        issuedAt: BigInt(submitResp.receipt.issuedAt),
      };
      const data = encodeFunctionData({
        abi: MINING_ABI,
        functionName: 'submitReceipt',
        args: [receiptArg, submitResp.signature],
      });

      const hash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to, data }],
      })) as string;
      setTxHash(hash);
      pushLog(`on-chain tx submitted (${hash.slice(0, 12)}...)`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="container">
      <a className="pillLink" href="/">← back</a>
      <h1 style={{ marginTop: 18 }}>Web Miner (Agent in Browser)</h1>
      <p className="sub">Connect MetaMask, start lease, mine, and optionally submit receipt on BSC.</p>

      <div className="grid" style={{ marginTop: 14 }}>
        <section className="card">
          <p className="cardTitle">Controls</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="pillLink" onClick={connect} type="button" disabled={busy !== ''}>
              Connect Wallet
            </button>
            <button className="pillLink" onClick={startLease} type="button" disabled={busy !== '' || !hasMM}>
              Start Agent Lease
            </button>
            <button className="pillLink" onClick={mineOnce} type="button" disabled={busy !== '' || !leaseToken}>
              Mine Once
            </button>
            <button
              className="pillLink"
              onClick={submitOnchain}
              type="button"
              disabled={busy !== '' || !submitResp?.signature}
            >
              Submit On-Chain (BSC)
            </button>
          </div>

          <div className="hr" />

          <div className="row"><div className="rowKey">MetaMask</div><div className="rowVal">{hasMM ? 'detected' : 'missing'}</div></div>
          <div className="row"><div className="rowKey">Account</div><div className="rowVal">{account || '—'}</div></div>
          <div className="row"><div className="rowKey">Busy</div><div className="rowVal">{busy || 'idle'}</div></div>
          <div className="row"><div className="rowKey">Lease token</div><div className="rowVal">{leaseToken ? `${leaseToken.slice(0, 24)}…` : '—'}</div></div>

          <div className="hr" />
          <p className="cardTitle">BSC Contract</p>
          <input
            value={miningAddressInput}
            onChange={(e) => setMiningAddressInput(e.target.value)}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(0,0,0,.25)',
              color: 'var(--text)',
              padding: 10,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
            }}
          />
          <p className="sub" style={{ marginTop: 8 }}>
            Default from server config. Replace with your real BSC Mining contract before on-chain submit.
          </p>
        </section>

        <aside className="card">
          <p className="cardTitle">Status</p>
          <div className="row"><div className="rowKey">API chainId</div><div className="rowVal">{config?.chainId ?? '—'}</div></div>
          <div className="row"><div className="rowKey">API signer</div><div className="rowVal">{config?.coordinatorSigner || '—'}</div></div>
          <div className="row"><div className="rowKey">Token mode</div><div className="rowVal">{config?.tokenMode || '—'}</div></div>
          <div className="row"><div className="rowKey">Submit pass</div><div className="rowVal">{submitResp ? String(submitResp.pass) : '—'}</div></div>
          <div className="row"><div className="rowKey">Receipt signer</div><div className="rowVal">{submitResp?.signer || '—'}</div></div>
          <div className="row"><div className="rowKey">Tx hash</div><div className="rowVal">{txHash || '—'}</div></div>

          {err ? (
            <>
              <div className="hr" />
              <p className="cardTitle">Error</p>
              <p className="sub" style={{ color: '#ffb4b4', margin: 0 }}>{err}</p>
            </>
          ) : null}
        </aside>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <p className="cardTitle">Logs</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {log.length === 0 ? <p className="sub" style={{ margin: 0 }}>No logs yet.</p> : null}
          {log.map((line, i) => (
            <div key={`${i}-${line}`} className="row" style={{ padding: 0, borderTop: 'none' }}>
              <div className="rowVal">{line}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="sub" style={{ marginTop: 12 }}>
        Need signature helper? Use <Link className="pillLink" href="/sign">/sign</Link>.
      </p>
    </main>
  );
}
