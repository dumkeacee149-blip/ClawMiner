#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';

const COORD = process.env.CLAW_COORDINATOR_URL || 'http://127.0.0.1:8787';
const HOME = process.env.HOME || process.cwd();
const KEY_PATH = process.env.CLAW_AGENT_KEY_PATH || path.join(HOME, '.clawminer-agent-key.json');
const STATE_PATH = process.env.CLAW_AGENT_STATE_PATH || path.join(HOME, '.clawminer-agent-state.json');

async function jpost(url, body){
  const res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); } catch { json = { raw:text }; }
  if(!res.ok){
    throw new Error(`${res.status} ${url} -> ${text}`);
  }
  return json;
}

function usage(){
  console.log(`\nclawminer (MVP)\n\nCommands:\n  register --miner 0x...\n  prove --miner 0x... --walletSig 0x...\n\nEnv:\n  CLAW_COORDINATOR_URL (default ${COORD})\n  CLAW_AGENT_KEY_PATH (default ${KEY_PATH})\n  CLAW_AGENT_STATE_PATH (default ${STATE_PATH})\n`);
}

function arg(name){
  const i = process.argv.indexOf(name);
  if(i === -1) return null;
  return process.argv[i+1] || null;
}

function loadOrCreateKey(){
  if(fs.existsSync(KEY_PATH)){
    const j = JSON.parse(fs.readFileSync(KEY_PATH,'utf8'));
    const privDer = Buffer.from(j.privateKeyPkcs8DerB64, 'base64');
    const pubDer = Buffer.from(j.publicKeySpkiDerB64, 'base64');
    return {
      privateKey: crypto.createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' }),
      publicKey: crypto.createPublicKey({ key: pubDer, format: 'der', type: 'spki' }),
      publicKeySpkiDerB64: j.publicKeySpkiDerB64,
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ format: 'der', type: 'spki' });
  const privDer = privateKey.export({ format: 'der', type: 'pkcs8' });
  const j = {
    publicKeySpkiDerB64: Buffer.from(pubDer).toString('base64'),
    privateKeyPkcs8DerB64: Buffer.from(privDer).toString('base64'),
  };
  fs.writeFileSync(KEY_PATH, JSON.stringify(j, null, 2), { mode: 0o600 });
  return {
    privateKey,
    publicKey,
    publicKeySpkiDerB64: j.publicKeySpkiDerB64,
  };
}

function saveState(state){
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function loadState(){
  if(!fs.existsSync(STATE_PATH)) return null;
  return JSON.parse(fs.readFileSync(STATE_PATH,'utf8'));
}

async function cmdRegister(){
  const miner = arg('--miner');
  if(!miner) throw new Error('missing --miner');
  const kp = loadOrCreateKey();
  const out = await jpost(`${COORD}/v1/agent/register`, { miner, agentPubKey: kp.publicKeySpkiDerB64 });

  saveState({
    miner,
    serverNonce: out.serverNonce,
    messageToSign: out.messageToSign,
    createdAt: new Date().toISOString(),
  });

  console.log('\n[REGISTER] ok');
  console.log('serverNonce:', out.serverNonce);
  console.log('\nMessage to sign in MetaMask/OKX (personal_sign):\n');
  console.log(out.messageToSign);
  console.log('\nNext: run:');
  console.log(`  clawminer prove --miner ${miner} --walletSig <PASTE_SIG_HERE>`);
}

async function cmdProve(){
  const miner = arg('--miner');
  const walletSig = arg('--walletSig');
  if(!miner) throw new Error('missing --miner');
  if(!walletSig) throw new Error('missing --walletSig');

  const st = loadState();
  if(!st || !st.serverNonce || !st.messageToSign){
    throw new Error(`missing state at ${STATE_PATH}. Run: clawminer register --miner ${miner}`);
  }
  if((st.miner || '').toLowerCase() !== miner.toLowerCase()){
    throw new Error(`state miner mismatch. State has ${st.miner}, args has ${miner}. Re-run register.`);
  }

  const kp = loadOrCreateKey();
  const msg = Buffer.from(st.serverNonce, 'utf8');
  const sig = crypto.sign(null, msg, kp.privateKey);
  const agentSigB64 = Buffer.from(sig).toString('base64');

  const out = await jpost(`${COORD}/v1/agent/prove`, { miner, walletSig, agentSig: agentSigB64 });
  console.log('\n[PROVE] ok');
  console.log('leaseToken:', out.leaseToken);
  console.log('expiresInSeconds:', out.expiresInSeconds);
  console.log('\nTry challenge (curl):');
  console.log(`  curl -s ${COORD}/v1/challenge -H "Authorization: Bearer ${out.leaseToken}"`);
}

async function main(){
  const cmd = process.argv[2];
  if(!cmd || cmd === '--help' || cmd === '-h'){ usage(); return; }
  if(cmd === 'register') return cmdRegister();
  if(cmd === 'prove') return cmdProve();
  usage();
  process.exit(1);
}

main().catch((e)=>{ console.error('\nERR:', e.message); process.exit(1); });
