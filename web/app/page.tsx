'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';

import LiveFeed from '@/components/LiveFeed';
import MintForm from '@/components/MintForm';
import TxStatus from '@/components/TxStatus';
import { WalletChip, WalletPanel } from '@/components/WalletBar';
import { Card, CardBody, Eyebrow, LedgerDot, Stat } from '@/components/ui';
import { CONTRACT_ID, explorerContract, shortAddress } from '@/lib/config';
import { getCollectionStats, type CollectionStats, type MintProgress } from '@/lib/contract';
import type { AppError } from '@/lib/errors';

/** Cac buoc nay coi la dang chay - khoa form de tranh gui hai lan. */
const BUSY: MintProgress['stage'][] = [
  'uploading',
  'building',
  'simulating',
  'signing',
  'submitting',
  'pending',
];

export default function Page() {
  const [address, setAddress] = useState<string | null>(null);
  const [progress, setProgress] = useState<MintProgress>({ stage: 'idle' });
  const [error, setError] = useState<AppError | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [feedKey, setFeedKey] = useState(0);

  const busy = BUSY.includes(progress.stage);

  const loadStats = useCallback(() => {
    void getCollectionStats()
      .then(setStats)
      // So lieu bo suu tap chi de tham khao; hong thi de trong con hon chen mot
      // thong bao loi che mat luong mint chinh.
      .catch(() => setStats(null));
  }, []);

  useEffect(loadStats, [loadStats]);

  const handleMinted = useCallback(() => {
    loadStats();
    // Doi mot nhip cho RPC ingest xong roi hay bat feed doc lai.
    setTimeout(() => setFeedKey((k) => k + 1), 2000);
  }, [loadStats]);

  const dismiss = useCallback(() => {
    setProgress({ stage: 'idle' });
    setError(null);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Dau trang */}
      <header className="animate-rise">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LedgerDot />
              <Eyebrow>Stellar Testnet</Eyebrow>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
              NFT Minter
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-7 text-muted">
              Mint NFT co metadata len Stellar. Anh luu tren IPFS, thong tin ghi thang vao
              contract Soroban, va bang tin ben duoi doc truc tiep tu so cai.
            </p>
          </div>

          {address ? <WalletChip address={address} onDisconnect={() => setAddress(null)} /> : null}
        </div>

        {/* So lieu bo suu tap */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Bo suu tap" value={stats?.name ?? '—'} />
          <Stat label="Ma" value={stats?.symbol ?? '—'} />
          <Stat
            label="Da mint"
            value={stats ? `${stats.totalMinted} / ${stats.maxSupply}` : '—'}
          />
          <div className="rounded-xl border border-line bg-canvas px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Contract</p>
            <a
              href={explorerContract()}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              {shortAddress(CONTRACT_ID, 4, 4)}
              <FiExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Cot trai: ket noi + mint + trang thai */}
        <div className="space-y-6">
          <Card className="animate-rise rise-1">
            {address ? (
              <MintForm
                address={address}
                busy={busy}
                onProgress={setProgress}
                onError={setError}
                onMinted={handleMinted}
              />
            ) : (
              <WalletPanel onConnect={setAddress} />
            )}
          </Card>

          {progress.stage !== 'idle' || error ? (
            <Card className="animate-rise">
              <CardBody>
                <Eyebrow>Trang thai giao dich</Eyebrow>
                <div className="mt-4">
                  <TxStatus progress={progress} error={error} onDismiss={dismiss} />
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Cot phai: bang tin */}
        <Card className="animate-rise rise-2 self-start">
          <LiveFeed refreshKey={feedKey} />
        </Card>
      </div>

      <footer className="mt-12 border-t border-line pt-6">
        <p className="text-[12px] leading-6 text-faint">
          Chay tren Stellar testnet - XLM o day khong co gia tri that. Contract dung
          OpenZeppelin stellar-tokens 0.7.2.
        </p>
      </footer>
    </main>
  );
}
