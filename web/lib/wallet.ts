'use client';

import {
  AlbedoModule,
  FreighterModule,
  HanaModule,
  HotWalletModule,
  KleverModule,
  LobstrModule,
  RabetModule,
  StellarWalletsKit,
  WalletNetwork,
  xBullModule,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit';

import { NETWORK_PASSPHRASE } from './config';

/**
 * Khai bao tung module vi mot cach tuong minh, KHONG dung allowAllModules().
 *
 * allowAllModules() keo them Ledger, Trezor va WalletConnect. Rieng Trezor keo
 * theo @trezor/blockchain-link -> @solana/web3.js va cac wallet-adapter cua
 * Solana, mang theo hang chuc canh bao bao mat va hang MB vao bundle - toan bo
 * deu vo dung voi mot dapp Stellar chi ky bang vi tien ich mo rong.
 *
 * Tam module duoi day van du de goi la "multi-wallet" theo yeu cau de bai.
 */
const MODULES = [
  new FreighterModule(),
  new xBullModule(),
  new AlbedoModule(),
  new RabetModule(),
  new LobstrModule(),
  new HanaModule(),
  new HotWalletModule(),
  new KleverModule(),
];

export const SUPPORTED_WALLETS = [
  'Freighter',
  'xBull',
  'Albedo',
  'Rabet',
  'Lobstr',
  'Hana',
  'HOT Wallet',
  'Klever',
];

const network = NETWORK_PASSPHRASE.includes('Test')
  ? WalletNetwork.TESTNET
  : WalletNetwork.PUBLIC;

let kit: StellarWalletsKit | null = null;

/**
 * Kit dung `window` nen chi duoc tao trong trinh duyet. Tao san o module scope
 * se lam vo buoc prerender cua Next.js tren server.
 */
export function getKit(): StellarWalletsKit {
  if (typeof window === 'undefined') {
    throw new Error('Wallet kit chi chay duoc trong trinh duyet');
  }
  if (!kit) {
    kit = new StellarWalletsKit({
      network,
      selectedWalletId: FREIGHTER_ID,
      modules: MODULES,
    });
  }
  return kit;
}

const STORAGE_KEY = 'nft-minter:wallet-id';

/**
 * Mo modal chon vi, tra ve dia chi cong khai da ket noi.
 *
 * `openModal()` tra ve Promise<void> va giai quyet NGAY KHI modal hien ra, chu
 * khong doi nguoi dung chon xong vi. Neu goi `getAddress()` sau `await
 * openModal(...)` thi no chay khi chua co vi nao duoc chon, nem loi, va nguoi
 * dung thay bao loi do sau lung modal truoc ca khi kip bam - do la bug that,
 * do duoc bang Playwright: modal mo luc 0s, loi hien luc ~3s.
 *
 * Vi vay dia chi phai duoc lay TRONG callback `onWalletSelected`.
 */
export function connectWallet(): Promise<string> {
  const k = getKit();

  return new Promise<string>((resolve, reject) => {
    void k.openModal({
      onWalletSelected: (option) => {
        void (async () => {
          try {
            k.setWallet(option.id);
            const { address } = await k.getAddress();
            if (!address) {
              // Mot so vi dong modal ma khong tra dia chi thay vi nem loi.
              throw new Error('No address returned from wallet');
            }
            window.localStorage.setItem(STORAGE_KEY, option.id);
            resolve(address);
          } catch (e) {
            reject(e);
          }
        })();
      },
      onClosed: (err) => {
        // Nguoi dung bam X hoac bam ra ngoai: khong phai su co, chi la doi y.
        reject(err ?? new Error('User cancelled wallet selection'));
      },
    });
  });
}

/**
 * Ket noi lai im lang khi tai lai trang, dung vi da chon lan truoc.
 * Tra ve null neu chua tung ket noi hoac vi khong con mo khoa - day la
 * truong hop binh thuong, khong phai loi.
 */
export async function restoreWallet(): Promise<string | null> {
  const saved =
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (!saved) return null;

  try {
    const k = getKit();
    k.setWallet(saved);
    const { address } = await k.getAddress();
    return address || null;
  } catch {
    return null;
  }
}

export async function signTransaction(xdr: string, address: string): Promise<string> {
  const { signedTxXdr } = await getKit().signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  return signedTxXdr;
}

export function disconnectWallet(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  kit = null;
}
