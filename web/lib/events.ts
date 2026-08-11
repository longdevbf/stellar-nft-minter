'use client';

import { nativeToScVal, scValToNative } from '@stellar/stellar-sdk';

import { CONTRACT_ID } from './config';
import { server } from './contract';
import { isTransient } from './errors';

/**
 * Doc event `Minted` truc tiep tu so cai - day la "real-time event integration".
 *
 * Loc theo topic dau tien la symbol "minted". Rat quan trong: KHONG duoc loc
 * theo "mint", vi OpenZeppelin phat event chuan cua no voi dung topic do va ta
 * se nhan nham event thieu metadata. Contract co doi ten topic thanh "minted"
 * chinh vi ly do nay.
 */
const MINTED_TOPIC = nativeToScVal('minted', { type: 'symbol' }).toXDR('base64');

/** So ledger nhin lai. Ledger ~5s nen 8000 ledger ~ 11 gio. */
const LOOKBACK_LEDGERS = 8000;

export interface MintEvent {
  tokenId: number;
  name: string;
  cid: string;
  /** Dia chi vi da mint, lay tu topic thu hai. */
  minter: string;
  /** Giay Unix, do contract ghi. */
  mintedAt: number;
  ledger: number;
  txHash: string;
}

function decode(raw: any): MintEvent | null {
  try {
    // topic = [Symbol("minted"), Address]
    const minter = String(scValToNative(raw.topic[1]));
    // data = map { token_id, name, cid, minted_at }
    const data = scValToNative(raw.value) as Record<string, unknown>;

    return {
      tokenId: Number(data.token_id),
      name: String(data.name ?? ''),
      cid: String(data.cid ?? ''),
      minter,
      mintedAt: Number(data.minted_at),
      ledger: Number(raw.ledger),
      txHash: String(raw.txHash ?? ''),
    };
  } catch {
    // Mot event hong khong duoc lam sap ca feed.
    return null;
  }
}

/** Lay cac lan mint gan day, moi nhat truoc. */
export async function fetchRecentMints(limit = 24): Promise<MintEvent[]> {
  const { sequence } = await server.getLatestLedger();
  const startLedger = Math.max(sequence - LOOKBACK_LEDGERS, 1);

  const res = await server.getEvents({
    startLedger,
    limit: 200,
    filters: [
      {
        type: 'contract',
        contractIds: [CONTRACT_ID],
        // '*' o vi tri thu hai: khop moi dia chi nguoi nhan.
        topics: [[MINTED_TOPIC, '*']],
      },
    ],
  });

  return res.events
    .map(decode)
    .filter((e): e is MintEvent => e !== null)
    .sort((a, b) => b.ledger - a.ledger || b.tokenId - a.tokenId)
    .slice(0, limit);
}

/**
 * Poll dinh ky. Tra ve ham de huy.
 *
 * Nuot loi tang network mot cach co chu dich: RPC testnet tut nhip lien tuc,
 * neu de moi lan lo nhip deu hien bao loi thi feed se nhap nhay do lien tuc
 * trong khi khong co gi thuc su hong. Loi khac van bao ra ngoai.
 */
export function pollMints(
  onData: (events: MintEvent[]) => void,
  onError: (e: unknown) => void,
  intervalMs = 5000
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const tick = async () => {
    if (stopped) return;
    try {
      onData(await fetchRecentMints());
    } catch (e) {
      if (!isTransient(e)) onError(e);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  void tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
