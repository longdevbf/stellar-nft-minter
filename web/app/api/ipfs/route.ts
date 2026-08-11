import { NextResponse } from 'next/server';

/**
 * Tai anh len IPFS qua Pinata.
 *
 * Route nay ton tai chi vi mot ly do: giu PINATA_JWT o phia server. Neu goi
 * Pinata thang tu trinh duyet thi JWT phai nam trong bundle, tuc la bat ky ai
 * mo DevTools cung lay duoc va dung het han muc cua tai khoan.
 *
 * Trinh duyet chi thay: gui file len -> nhan ve CID.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const PINATA_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: 'Server chua cau hinh PINATA_JWT. Xem web/.env.example.' },
      { status: 500 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: 'Body khong phai multipart form-data.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'Thieu truong "file".' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: `Chi nhan file anh, file gui len co kieu "${file.type || 'khong ro'}".` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Anh toi da 5 MB, file nay ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
      { status: 413 }
    );
  }

  const upstream = new FormData();
  upstream.append('file', file, file.name || 'nft-image');

  let res: Response;
  try {
    res = await fetch(PINATA_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: upstream,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Khong ket noi duoc toi Pinata (IPFS): ${(e as Error).message}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Khong tra nguyen van body cua Pinata ra ngoai - no co the chua thong tin
    // ve tai khoan. Chi giu ma trang thai va phan dau cua thong diep.
    return NextResponse.json(
      { error: `Pinata tu choi upload (HTTP ${res.status}). ${detail.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const json = (await res.json()) as { IpfsHash?: string };
  if (!json.IpfsHash) {
    return NextResponse.json({ error: 'Pinata khong tra ve CID.' }, { status: 502 });
  }

  return NextResponse.json({ cid: json.IpfsHash });
}
