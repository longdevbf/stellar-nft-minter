'use client';

import { useEffect, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';

import { explorerTx, ipfsUrl, shortAddress } from '@/lib/config';
import { classifyError, type AppError } from '@/lib/errors';
import { pollMints, type MintEvent } from '@/lib/events';
import { CardBody, Eyebrow, LedgerDot, Notice } from './ui';

/**
 * Bang tin cac lan mint, doc thang tu event tren so cai.
 *
 * Du lieu KHONG lay tu state cua trang: NFT do nguoi khac mint tren may khac
 * cung hien o day. Do la khac biet giua "hien lai thu minh vua lam" va thuc su
 * doc trang thai chung cua blockchain.
 */
export default function LiveFeed({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<MintEvent[] | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    setError(null);
    const stop = pollMints(
      (list) => {
        setEvents(list);
        setError(null);
      },
      (e) => setError(classifyError(e))
    );
    return stop;
  }, [refreshKey]);

  return (
    <CardBody>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow>Truc tiep tu blockchain</Eyebrow>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.015em] text-ink">
            Cac lan mint gan day
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5">
          <LedgerDot />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            5 giay
          </span>
        </span>
      </div>

      <p className="mt-2 text-[14px] leading-6 text-muted">
        Doc event <code className="font-mono text-[12px]">minted</code> tu contract, ke ca NFT
        do nguoi khac mint.
      </p>

      {error ? (
        <div className="mt-5">
          <Notice tone="error" title={error.title}>
            {error.detail}
          </Notice>
        </div>
      ) : null}

      <div className="mt-5">
        {events === null ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-canvas" />
                <span className="flex-1 space-y-2 py-1">
                  <span className="block h-3 w-1/3 animate-pulse rounded bg-canvas" />
                  <span className="block h-3 w-1/2 animate-pulse rounded bg-canvas" />
                </span>
              </li>
            ))}
          </ul>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-8 text-center text-[13px] text-faint">
            Chua co NFT nao duoc mint. Ban co the la nguoi dau tien.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={`${e.txHash}-${e.tokenId}`} className="flex animate-rise gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ipfsUrl(e.cid)}
                  alt={e.name}
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-lg border border-line bg-canvas object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-[14px] font-medium text-ink">{e.name}</p>
                    <span className="shrink-0 font-mono text-[11px] text-faint">#{e.tokenId}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {shortAddress(e.minter, 6, 6)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {new Date(e.mintedAt * 1000).toLocaleString('vi-VN')}
                  </p>
                </div>
                {e.txHash ? (
                  <a
                    href={explorerTx(e.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Xem giao dich cua NFT ${e.name}`}
                    className="mt-1 h-8 w-8 shrink-0 rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
                  >
                    <span className="flex h-8 w-8 items-center justify-center">
                      <FiExternalLink size={13} />
                    </span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardBody>
  );
}
