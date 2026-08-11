/** @type {import('tailwindcss').Config} */
// Bang mau lay tu stellar-frontend-challenge de hai bai cung mot bo nhan dien.
// Cac ti le tuong phan ghi kem la do tren nen trang, deu dat >= 4.5:1 (WCAG AA).
module.exports = {
  content: ['./components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F6F8',
        paper: '#FFFFFF',
        ink: {
          DEFAULT: '#0B0E14', // 16.9:1
          soft: '#2A3040', // 12.4:1
        },
        muted: '#4E5768', // 7.3:1
        faint: '#6B7385', // 4.8:1
        line: {
          DEFAULT: '#E6E9EF',
          strong: '#D6DBE5',
        },
        jade: {
          DEFAULT: '#0B7A53', // 5.4:1
          soft: '#EAF6F1',
        },
        clay: {
          DEFAULT: '#B03B36', // 6.0:1
          soft: '#FBEEED',
        },
        gold: {
          DEFAULT: '#8A6500', // 5.3:1
          dot: '#F2B705',
          soft: '#FCF6E6',
        },
        // Rieng cho app nay: mau cua trang thai "dang chay".
        iris: {
          DEFAULT: '#4C4FBF', // 6.2:1
          soft: '#EEEEFB',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 14, 20, 0.04), 0 8px 24px -14px rgba(11, 14, 20, 0.14)',
        lift: '0 2px 4px rgba(11, 14, 20, 0.05), 0 18px 44px -18px rgba(11, 14, 20, 0.22)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        ledger: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(0.72)' },
        },
      },
      animation: {
        rise: 'rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        // Stellar dong mot ledger khoang 5 giay
        ledger: 'ledger 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
