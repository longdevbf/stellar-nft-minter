'use client';

import { useRef, useState } from 'react';
import { FiImage, FiUploadCloud } from 'react-icons/fi';

import { mintNft, type MintProgress } from '@/lib/contract';
import { classifyError, type AppError } from '@/lib/errors';
import { Button, CardBody, Eyebrow, Field, Notice, Spinner, inputClass } from './ui';

// Phai khop voi kiem tra trong contract (contracts/nft-minter/src/lib.rs).
// Kiem o client de bao loi tuc thi; contract van kiem lai vi client khong dang
// tin - bat ky ai cung co the goi contract truc tiep khong qua trang nay.
const MAX_NAME = 64;
const MAX_DESC = 280;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface Props {
  address: string;
  onProgress: (p: MintProgress) => void;
  onError: (e: AppError | null) => void;
  onMinted: () => void;
  busy: boolean;
}

export default function MintForm({ address, onProgress, onError, onMinted, busy }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; image?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setFieldErrors((s) => ({ ...s, image: 'Chi nhan file anh.' }));
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setFieldErrors((s) => ({
        ...s,
        image: `Anh toi da 5 MB, file nay ${(f.size / 1024 / 1024).toFixed(1)} MB.`,
      }));
      return;
    }
    setFieldErrors((s) => ({ ...s, image: undefined }));
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = 'Ten khong duoc de trong.';
    else if (name.length > MAX_NAME) next.name = `Toi da ${MAX_NAME} ky tu.`;
    if (!file) next.image = 'Chon mot anh truoc da.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (!validate() || !file) return;

    try {
      // --- Buoc 1: anh len IPFS ---
      onProgress({ stage: 'uploading' });

      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/ipfs', { method: 'POST', body });
      const json = (await res.json()) as { cid?: string; error?: string };

      if (!res.ok || !json.cid) {
        throw new Error(json.error ?? `Upload IPFS that bai (HTTP ${res.status})`);
      }

      // --- Buoc 2: mint on-chain ---
      await mintNft(
        { to: address, name: name.trim(), description: description.trim(), cid: json.cid },
        onProgress
      );

      // Xoa form de lan mint sau khong vo tinh dung lai CID cu -> DuplicateCid.
      setName('');
      setDescription('');
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';

      onMinted();
    } catch (err) {
      onProgress({ stage: 'error' });
      onError(classifyError(err));
    }
  };

  return (
    <CardBody>
      <Eyebrow>Buoc 2</Eyebrow>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.015em] text-ink">
        Tao NFT
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-muted">
        Anh duoc ghim len IPFS, con ten va mo ta ghi thang vao contract.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Anh */}
        <div>
          <span className="text-[13px] font-medium text-ink-soft">Anh</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-1.5 flex w-full items-center gap-4 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-left transition-colors hover:border-ink-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Anh xem truoc"
                className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-faint">
                <FiImage size={20} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">
                {file ? file.name : 'Chon anh tu may'}
              </span>
              <span className="block text-[12px] text-faint">
                {file ? `${(file.size / 1024).toFixed(0)} KB` : 'PNG, JPG, GIF - toi da 5 MB'}
              </span>
            </span>
            <span className="ml-auto shrink-0 text-muted">
              <FiUploadCloud />
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {fieldErrors.image ? (
            <span className="mt-1.5 block text-[12px] text-clay">{fieldErrors.image}</span>
          ) : null}
        </div>

        <Field
          label="Ten"
          error={fieldErrors.name}
          hint={`${name.length}/${MAX_NAME} ky tu`}
        >
          <input
            className={inputClass}
            value={name}
            maxLength={MAX_NAME}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sao Bac Dau"
          />
        </Field>

        <Field label="Mo ta" hint={`${description.length}/${MAX_DESC} ky tu - co the de trong`}>
          <textarea
            className={`${inputClass} min-h-[84px] resize-y`}
            value={description}
            maxLength={MAX_DESC}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Vai dong ve tac pham nay"
          />
        </Field>

        <Button type="submit" disabled={busy} fullWidth>
          {busy ? (
            <>
              <Spinner /> Dang mint
            </>
          ) : (
            'Mint NFT'
          )}
        </Button>

        <Notice tone="info" title="Moi anh chi mint duoc mot lan">
          Contract luu CID cua anh va tu choi neu anh do da co tren chain, nen khong the
          mint trung.
        </Notice>
      </form>
    </CardBody>
  );
}
