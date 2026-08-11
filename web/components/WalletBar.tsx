'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiCopy, FiLogOut } from 'react-icons/fi';

import { shortAddress } from '@/lib/config';
import { classifyError, type AppError } from '@/lib/errors';
import { SUPPORTED_WALLETS, connectWallet, disconnectWallet, restoreWallet } from '@/lib/wallet';
import { Button, CardBody, Eyebrow, Notice, Spinner } from './ui';

export function WalletPanel({ onConnect }: { onConnect: (address: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Neu lan truoc da ket noi thi noi lai im lang, khong bat nguoi dung bam lai.
  useEffect(() => {
    let cancelled = false;
    void restoreWallet().then((addr) => {
      if (!cancelled && addr) onConnect(addr);
    });
    return () => {
      cancelled = true;
    };
  }, [onConnect]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      onConnect(await connectWallet());
    } catch (e) {
      setError(classifyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardBody>
      <Eyebrow>Buoc 1</Eyebrow>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.015em] text-ink">
        Ket noi vi
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-muted">
        Chon vi trong danh sach hien ra. Khong co gi duoc gui di cho toi khi ban ky.
      </p>

      <div className="mt-6">
        <Button onClick={handleConnect} disabled={loading} fullWidth>
          {loading ? (
            <>
              <Spinner /> Dang cho vi
            </>
          ) : (
            'Ket noi vi'
          )}
        </Button>
      </div>

      {error ? (
        <div className="mt-4">
          <Notice tone="error" title={error.title} onDismiss={() => setError(null)}>
            {error.detail}
          </Notice>
        </div>
      ) : null}

      <div className="mt-7 border-t border-line pt-5">
        <Eyebrow>Ho tro</Eyebrow>
        <ul className="mt-3 grid grid-cols-2 gap-x-6">
          {SUPPORTED_WALLETS.map((w) => (
            <li
              key={w}
              className="border-b border-line py-2 font-mono text-[12px] text-ink-soft last:border-b-0 [&:nth-last-child(2)]:border-b-0"
            >
              {w}
            </li>
          ))}
        </ul>
      </div>
    </CardBody>
  );
}

export function WalletChip({
  address,
  onDisconnect,
}: {
  address: string;
  onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Mot so trinh duyet chan clipboard khi khong o https - bo qua im lang.
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-paper p-1 pl-3">
      <span className="font-mono text-[12px] tracking-[0.04em] text-ink-soft">
        {shortAddress(address)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Da chep dia chi' : 'Chep dia chi'}
        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        {copied ? <FiCheck className="text-jade" /> : <FiCopy />}
      </button>
      <button
        type="button"
        onClick={() => {
          disconnectWallet();
          onDisconnect();
        }}
        aria-label="Ngat ket noi vi"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-clay-soft hover:text-clay"
      >
        <FiLogOut />
      </button>
    </div>
  );
}
