/**
 * Kiem tra tang doc event ma khong can trinh duyet hay vi.
 *
 * Dung dung bo loc topic nhu lib/events.ts. Chay:
 *   cd web && node scripts/check-events.mjs
 *
 * Huu ich khi bang tin trong tren giao dien: script nay tra loi cau hoi "loi o
 * khau doc event hay o khau hien thi".
 */

import { readFileSync } from 'node:fs';
import { nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';

// Doc .env.local thu cong - script chay ngoai Next.js nen khong co san env.
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const CONTRACT_ID = env.NEXT_PUBLIC_CONTRACT_ID;
const server = new rpc.Server(env.NEXT_PUBLIC_RPC_URL);

// Phai la "minted", khong phai "mint": OpenZeppelin dung "mint" cho event chuan.
const MINTED_TOPIC = nativeToScVal('minted', { type: 'symbol' }).toXDR('base64');

const { sequence } = await server.getLatestLedger();
const startLedger = Math.max(sequence - 8000, 1);

console.log(`contract   : ${CONTRACT_ID}`);
console.log(`ledger     : ${startLedger} -> ${sequence}`);
console.log(`topic loc  : ${MINTED_TOPIC}\n`);

const res = await server.getEvents({
  startLedger,
  limit: 200,
  filters: [{ type: 'contract', contractIds: [CONTRACT_ID], topics: [[MINTED_TOPIC, '*']] }],
});

if (res.events.length === 0) {
  console.log('Khong tim thay event "minted" nao.');
  process.exit(1);
}

for (const e of res.events) {
  const minter = scValToNative(e.topic[1]);
  const d = scValToNative(e.value);
  console.log(
    `#${d.token_id}  ${String(d.name).padEnd(18)} ${d.cid}  ${minter.slice(0, 6)}...  ledger ${e.ledger}`
  );
}
console.log(`\nTong: ${res.events.length} event.`);
