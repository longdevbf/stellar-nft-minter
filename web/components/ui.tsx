'use client';

import type { ReactNode } from 'react';

/** Cac manh giao dien dung lai nhieu noi. Khong chua logic nghiep vu. */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-paper shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-6 sm:p-7 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{children}</p>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  type = 'button',
  variant = 'primary',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost';
  fullWidth?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45';
  const styles =
    variant === 'primary'
      ? 'bg-ink text-paper hover:bg-ink-soft'
      : 'border border-line bg-paper text-ink hover:bg-canvas';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
    />
  );
}

/** Cham nhip theo chu ky dong ledger cua Stellar (~5 giay). */
export function LedgerDot() {
  return <span aria-hidden className="inline-block h-2 w-2 animate-ledger rounded-full bg-gold-dot" />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] text-clay">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-ink-soft focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';

export function Notice({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: 'error' | 'success' | 'info';
  title: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    error: 'border-clay/25 bg-clay-soft text-clay',
    success: 'border-jade/25 bg-jade-soft text-jade',
    info: 'border-iris/25 bg-iris-soft text-iris',
  } as const;

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold">{title}</p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dong thong bao"
            className="-mt-0.5 text-[16px] leading-none opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        ) : null}
      </div>
      {children ? <div className="mt-1.5 text-[13px] leading-6 opacity-90">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-canvas px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1 font-display text-[18px] font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
