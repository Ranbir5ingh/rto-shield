import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1814',
        canvas: '#faf6ec',
        paper: '#faf6ec',
        card: '#ffffff',
        raised: '#f1eada',
        muted: '#6e6357',
        line: '#e3d9c2',
        accent: '#c0392b',
        'accent-deep': '#96281b',
        low: '#1e7a4c',
        mid: '#a86f14',
        high: '#c0392b',
        forest: '#1e7a4c',
        saffron: '#c0392b',
        navy: '#1c1814',
        danger: '#c0392b',
        warn: '#a86f14',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Geist', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.75rem, 6.5vw, 5.5rem)', { lineHeight: '0.98', letterSpacing: '-0.015em', fontWeight: '560' }],
        'display-2': ['clamp(1.8rem, 3.2vw, 2.6rem)', { lineHeight: '1.04', letterSpacing: '-0.01em', fontWeight: '560' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 24, 20, 0.05), 0 16px 40px -16px rgba(28, 24, 20, 0.14)',
        glow: '0 0 0 rgba(0, 0, 0, 0)',
      },
      maxWidth: {
        page: '76rem',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
