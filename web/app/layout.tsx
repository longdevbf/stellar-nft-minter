import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';

import './globals.css';

// Ba vai tro ro rang: Sora cho tieu de, Inter cho van ban, JetBrains Mono cho
// dia chi va ma bam - nhung chuoi ma nguoi doc phai doi chieu tung ky tu.
const display = Sora({ subsets: ['latin'], weight: ['600'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'NFT Minter - Stellar Testnet',
  description:
    'Mint NFT co metadata len Stellar testnet. Contract Soroban dung OpenZeppelin, anh luu tren IPFS, event doc truc tiep tu so cai.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
