'use client';

import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from './config';
import { classifyError, isTransient } from './errors';
import { signTransaction } from './wallet';

export const server = new rpc.Server(RPC_URL);

/**
 * Tai khoan dung lam nguon cho cac lenh CHI DOC.
 *
 * Simulate van doi mot tai khoan co that de lay sequence, nhung khong he ky hay
 * gui gi len mang. Dung dia chi nguoi deploy o day de trang co the hien so lieu
 * bo suu tap ngay ca khi khach chua ket noi vi.
 */
const READ_SOURCE = 'GC6DYXYXKHFS55WSDFYE4QWM2NXHTB7BLXU56LCMELCXA6PCWLUFYNS5';

const contract = new Contract(CONTRACT_ID);

// ---------------------------------------------------------------------------
// Thu lai cho loi ha tang
// ---------------------------------------------------------------------------

/**
 * Thu lai CHI voi loi tang network. Loi contract va loi vi khong bao gio duoc
 * thu lai: chung se that bai y het, chi ton them phi va lam nguoi dung roi tri.
 */
async function withRetry<T>(
  action: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number; onRetry?: (attempt: number) => void } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 8;
  const delayMs = opts.delayMs ?? 3000;

  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await action();
    } catch (e) {
      last = e;
      if (!isTransient(e) || i === attempts) throw e;
      opts.onRetry?.(i);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// Doc trang thai (chi simulate, khong ton phi)
// ---------------------------------------------------------------------------

async function simulateRead(method: string, ...args: xdr.ScVal[]): Promise<any> {
  const account = await server.getAccount(READ_SOURCE);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    // Nem nguyen van chuoi loi cua host de classifyError doc duoc ma
    // "Error(Contract, #N)" nam trong do.
    throw new Error(sim.error);
  }
  if (!sim.result?.retval) {
    throw new Error(`Ham ${method} khong tra ve gia tri nao`);
  }
  return scValToNative(sim.result.retval);
}

export interface CollectionStats {
  name: string;
  symbol: string;
  totalMinted: number;
  maxSupply: number;
}

export async function getCollectionStats(): Promise<CollectionStats> {
  return withRetry(async () => {
    const [name, symbol, totalMinted, maxSupply] = await Promise.all([
      simulateRead('name'),
      simulateRead('symbol'),
      simulateRead('total_minted'),
      simulateRead('max_supply'),
    ]);
    return {
      name: String(name),
      symbol: String(symbol),
      totalMinted: Number(totalMinted),
      maxSupply: Number(maxSupply),
    };
  });
}

export interface NftMeta {
  name: string;
  description: string;
  cid: string;
  minter: string;
  mintedAt: number;
}

export async function getNftMeta(tokenId: number): Promise<NftMeta> {
  const raw = await simulateRead('get_meta', nativeToScVal(tokenId, { type: 'u32' }));
  return {
    name: String(raw.name),
    description: String(raw.description),
    cid: String(raw.cid),
    minter: String(raw.minter),
    // minted_at la u64 -> scValToNative tra ve BigInt.
    mintedAt: Number(raw.minted_at),
  };
}

// ---------------------------------------------------------------------------
// Mint
// ---------------------------------------------------------------------------

/** Cac buoc cua mot lan mint, theo dung thu tu xay ra. */
export type MintStage =
  | 'idle'
  | 'uploading'
  | 'building'
  | 'simulating'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'success'
  | 'error';

export interface MintProgress {
  stage: MintStage;
  /** Co ngay khi giao dich duoc mang chap nhan, truoc khi biet ket qua. */
  txHash?: string;
  tokenId?: number;
  cid?: string;
  /** Dang thu lai lan thu may, chi xuat hien voi loi tang network. */
  retryAttempt?: number;
}

export interface MintInput {
  to: string;
  name: string;
  description: string;
  cid: string;
}

/**
 * Mint mot NFT. Bao tien do qua `onProgress` de giao dien hien tung buoc.
 *
 * Nem AppError da phan loai; phia goi chi viec hien thi.
 */
export async function mintNft(
  input: MintInput,
  onProgress: (p: MintProgress) => void
): Promise<{ txHash: string; tokenId: number }> {
  const report = (p: MintProgress) => onProgress(p);

  // --- Dung giao dich ---
  report({ stage: 'building', cid: input.cid });

  const account = await withRetry(() => server.getAccount(input.to), {
    onRetry: (n) => report({ stage: 'building', cid: input.cid, retryAttempt: n }),
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'mint',
        new Address(input.to).toScVal(),
        nativeToScVal(input.name, { type: 'string' }),
        nativeToScVal(input.description, { type: 'string' }),
        nativeToScVal(input.cid, { type: 'string' })
      )
    )
    .setTimeout(180)
    .build();

  // --- Simulate ---
  // Day la noi bat duoc loi nghiep vu cua contract TRUOC khi ton bat ky dong
  // phi nao va truoc khi lam phien nguoi dung ky.
  report({ stage: 'simulating', cid: input.cid });

  const sim = await withRetry(() => server.simulateTransaction(tx), {
    onRetry: (n) => report({ stage: 'simulating', cid: input.cid, retryAttempt: n }),
  });

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();

  // --- Ky ---
  report({ stage: 'signing', cid: input.cid });
  const signedXdr = await signTransaction(prepared.toXDR(), input.to);
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // --- Gui ---
  report({ stage: 'submitting', cid: input.cid });
  const sent = await withRetry(() => server.sendTransaction(signed as any), {
    onRetry: (n) => report({ stage: 'submitting', cid: input.cid, retryAttempt: n }),
  });

  if (sent.status === 'ERROR') {
    throw new Error(
      `Mang tu choi giao dich: ${JSON.stringify(sent.errorResult ?? sent.status)}`
    );
  }

  const txHash = sent.hash;

  // --- Cho len ledger ---
  report({ stage: 'pending', txHash, cid: input.cid });

  const final = await server.pollTransaction(txHash, {
    attempts: 30,
    sleepStrategy: rpc.BasicSleepStrategy,
  });

  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      `Giao dich that bai tren ledger: ${JSON.stringify(
        (final as any).resultXdr?.toXDR?.('base64') ?? final.status
      )}`
    );
  }

  const tokenId = final.returnValue ? Number(scValToNative(final.returnValue)) : -1;

  report({ stage: 'success', txHash, tokenId, cid: input.cid });
  return { txHash, tokenId };
}

export { classifyError };
