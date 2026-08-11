'use client';

import { FiAlertTriangle, FiCheck, FiExternalLink } from 'react-icons/fi';

import { explorerTx, shortAddress } from '@/lib/config';
import { LAYER_LABEL, type AppError } from '@/lib/errors';
import type { MintProgress, MintStage } from '@/lib/contract';
import { Notice, Spinner } from './ui';

/**
 * Trang thai giao dich, hien tung buoc mot.
 *
 * Cac buoc duoc liet ke day du ngay tu dau chu khong hien dan: nguoi dung thay
 * truoc con bao nhieu buoc nua, va quan trong hon la thay ro buoc nao dang
 * cho HO thao tac (ky trong vi) thay vi cho may.
 */

const STEPS: { stage: MintStage; label: string; note: string }[] = [
  { stage: 'uploading', label: 'Tai anh len IPFS', note: 'Anh duoc ghim qua Pinata' },
  { stage: 'building', label: 'Dung giao dich', note: 'Doc sequence cua tai khoan' },
  { stage: 'simulating', label: 'Mo phong', note: 'Bat loi truoc khi ton phi' },
  { stage: 'signing', label: 'Cho ban ky', note: 'Mo vi va bam Approve' },
  { stage: 'submitting', label: 'Gui len mang', note: 'Day giao dich toi RPC' },
  { stage: 'pending', label: 'Cho vao ledger', note: 'Stellar dong ledger moi ~5 giay' },
];

const ORDER: MintStage[] = [
  'idle',
  'uploading',
  'building',
  'simulating',
  'signing',
  'submitting',
  'pending',
  'success',
];

function rank(stage: MintStage): number {
  const i = ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

export default function TxStatus({
  progress,
  error,
  onDismiss,
}: {
  progress: MintProgress;
  error: AppError | null;
  onDismiss: () => void;
}) {
  if (progress.stage === 'idle' && !error) return null;

  const current = rank(progress.stage);
  const done = progress.stage === 'success';

  return (
    <div className="space-y-4">
      {/* Danh sach buoc */}
      {progress.stage !== 'idle' ? (
        <ol className="space-y-0">
          {STEPS.map((step) => {
            const r = rank(step.stage);
            const isDone = done || r < current;
            const isActive = !done && !error && r === current;
            const isFailed = !!error && r === current;

            return (
              <li key={step.stage} className="flex gap-3 py-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-jade text-paper">
                      <FiCheck size={12} />
                    </span>
                  ) : isFailed ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-paper">
                      <FiAlertTriangle size={11} />
                    </span>
                  ) : isActive ? (
                    <span className="text-iris">
                      <Spinner />
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-line-strong" />
                  )}
                </span>

                <span className="min-w-0">
                  <span
                    className={`block text-[13px] ${
                      isActive
                        ? 'font-semibold text-ink'
                        : isFailed
                          ? 'font-semibold text-clay'
                          : isDone
                            ? 'text-ink-soft'
                            : 'text-faint'
                    }`}
                  >
                    {step.label}
                    {isActive && progress.retryAttempt ? (
                      <span className="ml-2 font-mono text-[11px] font-normal text-gold">
                        thu lai lan {progress.retryAttempt}
                      </span>
                    ) : null}
                  </span>
                  {(isActive || isFailed) && (
                    <span className="block text-[12px] text-faint">{step.note}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* Ma giao dich - hien ngay khi co, truoc ca khi biet ket qua */}
      {progress.txHash ? (
        <div className="rounded-xl border border-line bg-canvas px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            Ma giao dich
          </p>
          <a
            href={explorerTx(progress.txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 font-mono text-[12px] text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {shortAddress(progress.txHash, 10, 10)}
            <FiExternalLink size={12} />
          </a>
        </div>
      ) : null}

      {/* Ket qua */}
      {done ? (
        <Notice tone="success" title={`Mint thanh cong - token #${progress.tokenId}`} onDismiss={onDismiss}>
          NFT da nam tren Stellar testnet va se xuat hien trong bang tin ben duoi.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="error" title={error.title} onDismiss={onDismiss}>
          <p>{error.detail}</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] opacity-70">
            {LAYER_LABEL[error.layer]} &middot; {error.code}
          </p>
          {error.raw ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] opacity-70">Chi tiet ky thuat</summary>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-paper/60 p-2 font-mono text-[11px] leading-5">
                {error.raw}
              </pre>
            </details>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}
