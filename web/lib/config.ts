/**
 * Cau hinh doc tu bien moi truong.
 *
 * Phai viet `process.env.NEXT_PUBLIC_X` day du tung chu: Next.js thay the chuoi
 * nay luc build bang cach quet ma nguon, nen `process.env[name]` dong se khong
 * duoc thay the va tra ve undefined trong trinh duyet.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Thieu bien moi truong ${name}. Copy web/.env.example thanh web/.env.local roi dien gia tri.`
    );
  }
  return value;
}

export const CONTRACT_ID = required(
  process.env.NEXT_PUBLIC_CONTRACT_ID,
  'NEXT_PUBLIC_CONTRACT_ID'
);

export const RPC_URL = required(process.env.NEXT_PUBLIC_RPC_URL, 'NEXT_PUBLIC_RPC_URL');

export const NETWORK_PASSPHRASE = required(
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
  'NEXT_PUBLIC_NETWORK_PASSPHRASE'
);

export const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';

/** Ten mang dung trong URL cua stellar.expert. */
export const EXPLORER_NETWORK = NETWORK_PASSPHRASE.includes('Test') ? 'testnet' : 'public';

export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${hash}`;
}

export function explorerContract(id: string = CONTRACT_ID): string {
  return `https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${id}`;
}

export function ipfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}${cid}`;
}

/** Rut gon dia chi G... hoac C... cho vua mot dong. */
export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}
