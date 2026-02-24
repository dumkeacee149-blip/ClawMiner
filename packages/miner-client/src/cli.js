#!/usr/bin/env node
import nacl from 'tweetnacl';
import fs from 'fs';
import path from 'path';

const COORD = process.env.CLAW_COORDINATOR_URL || 'http://127.0.0.1:8787';
const HOME = process.env.HOME || process.cwd();
const KEY_PATH = process.env.CLAW_AGENT_KEY_PATH || path.join(HOME, '.clawminer-agent-key.json');

function u8ToB64(u8){ return Buffer.from(u8).toString('base64'); }
function b64ToU8(b64){ return new Uint8Array(Buffer.from(b64,'base64')); }

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

function loadOrCreateKey(){
  if(fs.existsSync(KEY_PATH)){
    const j = JSON.parse(fs.readFileSync(KEY_PATH,'utf8'));
    return {
      publicKey: b64ToU8(j.publicKeyB64),
      secretKey: b64ToU8(j.secretKeyB64)
    };
  }
  const kp = nacl.sign.keyPair();
  const j = {
    publicKeyB64: u8ToB64(kp.publicKey),
    secretKeyB64: u8ToB64(kp.secretKey)
  };
  fs.writeFileSync(KEY_PATH, JSON.stringify(j, null, 2), { mode: 0o600 });
  return kp;
}

function usage(){
  console.log(`\nclawminer (MVP)\n\nCommands:\n  register --miner 0x...\n  prove --miner 0x... --walletSig 0x...\n\nEnv:\n  CLAW_COORDINATOR_URL (default ${COORD})\n  CLAW_AGENT_KEY_PATH (default ${KEY_PATH})\n`);
}

function arg(name){
  const i = process.argv.indexOf(name);
  if(i === -1) return null;
  return process.argv[i+1] || null;
}

async function cmdRegister(){
  const miner = arg('--miner');
  if(!miner) throw new Error('missing --miner');
  const kp = loadOrCreateKey();
  const agentPubKey = u8ToB64(kp.publicKey);
  const out = await jpost(`${COORD}/v1/agent/register`, { miner, agentPubKey });
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

  // Re-register to get a fresh nonce (simplest MVP flow)
  const kp = loadOrCreateKey();
  const agentPubKey = u8ToB64(kp.publicKey);
  const reg = await jpost(`${COORD}/v1/agent/register`, { miner, agentPubKey });

  const agentSig = nacl.sign.detached(new TextEncoder().encode(reg.serverNonce), kp.secretKey);
  const agentSigB64 = u8ToB64(agentSig);

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
