import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f4f4f5',
        canvas: '#07080a',
        paper: '#07080a',
        card: '#121318',
        raised: '#1a1b20',
        muted: '#9a9aa3',
        line: '#2a2c33',
        accent: '#d6ff4a',
        low: '#3dd68c',
        mid: '#f5c16c',
        high: '#ff6b6b',
        forest: '#3dd68c',
        saffron: '#d6ff4a',
        navy: '#f4f4f5',
        danger: '#ff6b6b',
        warn: '#f5c16c',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Geist', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
        display: ['var(--font-geist-sans)', 'Geist', 'sans-serif'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.6rem, 6vw, 5.25rem)', { lineHeight: '0.96', letterSpacing: '-0.045em', fontWeight: '500' }],
        'display-2': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.035em', fontWeight: '500' }],
      },
      boxShadow: {
        card: '0 24px 80px rgba(0, 0, 0, 0.35)',
        glow: '0 0 80px rgba(214, 255, 74, 0.12)',
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
