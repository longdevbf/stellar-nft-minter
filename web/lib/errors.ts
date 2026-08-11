/**
 * Phan loai loi thanh ba tang.
 *
 * Ba tang nay khac nhau ve BAN CHAT, khong phai ba nhanh if cho du so luong:
 *
 *   contract - Contract tu choi theo dung luat nghiep vu. Loi cua du lieu nguoi
 *              dung nhap. Thu lai y het se that bai y het. Phai sua input.
 *   wallet   - Nguoi dung hoac phan mem vi tu choi/khong san sang. Khong co gi
 *              di den blockchain ca. Sua o phia vi roi bam lai.
 *   network  - Ha tang tam thoi khong nhat quan. Khong ai lam gi sai. Thu lai
 *              nguyen van sau vai giay la duoc.
 *
 * Chi tang `network` moi dat retryable = true. Tu dong thu lai loi contract se
 * chi dot phi vo ich, con thu lai loi vi thi spam popup vao mat nguoi dung.
 */

export type ErrorLayer = 'contract' | 'wallet' | 'network';

export interface AppError {
  layer: ErrorLayer;
  /** Ma ngan de hien thi va tra cuu, vi du "CONTRACT_3". */
  code: string;
  title: string;
  /** Cau van nguoi dung doc duoc va biet phai lam gi tiep. */
  detail: string;
  /** Co nen tu dong thu lai khong. Chi dung cho tang network. */
  retryable: boolean;
  /** Thong diep goc, giu lai de hien trong phan chi tiet ky thuat. */
  raw?: string;
}

// ---------------------------------------------------------------------------
// Tang 1: loi tu contract
// ---------------------------------------------------------------------------

/**
 * Cac ma loi nay phai khop voi enum `Error` trong contracts/nft-minter/src/lib.rs.
 * OpenZeppelin da chiem dai 200..=214, nen contract cua ta danh so tu 1.
 */
const CONTRACT_ERRORS: Record<number, { title: string; detail: string }> = {
  1: {
    title: 'Thong tin NFT khong hop le',
    detail:
      'Ten khong duoc de trong va toi da 64 ky tu, mo ta toi da 280 ky tu. Kiem tra lai form roi thu lai.',
  },
  2: {
    title: 'Bo suu tap da het cho',
    detail:
      'Da mint du so luong toi da cua bo suu tap nay. Khong the mint them - can deploy mot bo suu tap moi.',
  },
  3: {
    title: 'Anh nay da duoc mint roi',
    detail:
      'Moi anh chi mint duoc mot lan. Anh vua chon da co tren blockchain - hay chon anh khac.',
  },
  4: {
    title: 'Khong tim thay NFT',
    detail: 'Token ID nay chua duoc mint tren contract.',
  },
};

/** Loi cua OpenZeppelin (dai 200..=214) - hiem gap trong luong mint. */
const OZ_ERRORS: Record<number, string> = {
  200: 'Token khong ton tai',
  201: 'Khong phai chu so huu token',
  202: 'Chua duoc uy quyen du de thao tac',
  206: 'Da het ID de cap phat',
  210: 'Contract chua duoc dat metadata',
};

// ---------------------------------------------------------------------------
// Phan loai
// ---------------------------------------------------------------------------

/** Cac loi ha tang tam thoi, cung mot goc re: node RPC ingest lech nhau. */
const TRANSIENT_PATTERNS = [
  'Contract not found',
  'MissingValue',
  'TxBadSeq',
  'txBadSeq',
  'try again',
  'ECONNRESET',
  'ETIMEDOUT',
  'Failed to fetch',
  'NetworkError',
  'timeout',
  '502',
  '503',
  '504',
];

function textOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return `${e.message}`;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * Doc ma loi contract tu chuoi loi cua host.
 * Dang chuoi: `HostError: Error(Contract, #3)`.
 */
export function parseContractErrorCode(text: string): number | null {
  const m = text.match(/Error\(Contract,\s*#(\d+)\)/);
  return m ? Number(m[1]) : null;
}

export function classifyError(e: unknown): AppError {
  const raw = textOf(e);

  // --- Tang contract ---
  const code = parseContractErrorCode(raw);
  if (code !== null) {
    const known = CONTRACT_ERRORS[code];
    if (known) {
      return { layer: 'contract', code: `CONTRACT_${code}`, ...known, retryable: false, raw };
    }
    const oz = OZ_ERRORS[code];
    return {
      layer: 'contract',
      code: `CONTRACT_${code}`,
      title: oz ?? `Contract tu choi (ma #${code})`,
      detail: oz
        ? 'Loi nay den tu thu vien chuan NonFungibleToken cua OpenZeppelin.'
        : 'Contract tra ve mot ma loi chua duoc mo ta trong giao dien.',
      retryable: false,
      raw,
    };
  }

  // --- Tang wallet ---
  // Moi vi dung mot cau chu khac nhau cho cung mot hanh dong "nguoi dung bam Huy".
  if (/reject|declin|denied|cancel|User declined|refused/i.test(raw)) {
    return {
      layer: 'wallet',
      code: 'WALLET_REJECTED',
      title: 'Ban da tu choi ky',
      detail: 'Giao dich chua duoc gui di. Bam Mint lai va chon Approve trong vi neu muon tiep tuc.',
      retryable: false,
      raw,
    };
  }
  if (/locked|unlock|not authorized|no public key|not connected|No address/i.test(raw)) {
    return {
      layer: 'wallet',
      code: 'WALLET_LOCKED',
      title: 'Vi dang khoa hoac chua ket noi',
      detail: 'Mo tien ich vi, nhap mat khau de mo khoa, roi bam ket noi lai.',
      retryable: false,
      raw,
    };
  }
  if (/network|passphrase/i.test(raw) && /mismatch|wrong|invalid|different/i.test(raw)) {
    return {
      layer: 'wallet',
      code: 'WALLET_WRONG_NETWORK',
      title: 'Vi dang o sai mang',
      detail: 'Ung dung nay chay tren Testnet. Vao cai dat cua vi va chuyen sang Testnet.',
      retryable: false,
      raw,
    };
  }

  // --- Tang network ---
  if (TRANSIENT_PATTERNS.some((p) => raw.includes(p))) {
    return {
      layer: 'network',
      code: 'NETWORK_TRANSIENT',
      title: 'Mang chua kip dong bo',
      detail:
        'RPC cong cong cua testnet gom nhieu node ingest lech nhau, co the cham toi ~45 giay. Dang tu dong thu lai.',
      retryable: true,
      raw,
    };
  }
  if (/IPFS|Pinata|upload/i.test(raw)) {
    return {
      layer: 'network',
      code: 'NETWORK_IPFS',
      title: 'Khong tai duoc anh len IPFS',
      detail: 'Pinata khong phan hoi. Kiem tra ket noi mang roi thu lai.',
      retryable: true,
      raw,
    };
  }

  return {
    layer: 'network',
    code: 'UNKNOWN',
    title: 'Co loi khong xac dinh',
    detail: 'Xem phan chi tiet ky thuat ben duoi de biet them.',
    retryable: false,
    raw,
  };
}

export function isTransient(e: unknown): boolean {
  return classifyError(e).retryable;
}

/** Nhan hien thi cua tung tang, dung cho badge tren giao dien. */
export const LAYER_LABEL: Record<ErrorLayer, string> = {
  contract: 'Loi contract',
  wallet: 'Loi vi',
  network: 'Loi mang',
};
