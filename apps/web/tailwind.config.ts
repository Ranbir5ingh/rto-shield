import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17150f',
        canvas: '#fbfaf5',
        paper: '#fbfaf5',
        card: '#ffffff',
        raised: '#f1efe6',
        muted: '#6b6257',
        line: '#e8e4d8',
        accent: '#1e1efa',
        'accent-deep': '#1212b8',
        electric: '#1e1efa',
        low: '#16a34a',
        mid: '#d97706',
        high: '#e11d48',
        forest: '#16a34a',
        saffron: '#1e1efa',
        navy: '#17150f',
        danger: '#e11d48',
        warn: '#d97706',
        'pastel-pink': '#ffd9e8',
        'pastel-sky': '#d9e6ff',
        'pastel-butter': '#ffeba8',
        'pastel-mint': '#d8f5e3',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Geist', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', '"DM Serif Display"', 'Georgia', 'serif'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.9rem, 7vw, 5.75rem)', { lineHeight: '0.98', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-2': ['clamp(1.9rem, 3.4vw, 2.75rem)', { lineHeight: '1.02', letterSpacing: '-0.01em', fontWeight: '400' }],
      },
      boxShadow: {
        card: '0 2px 6px rgba(23, 21, 15, 0.06), 0 24px 48px -20px rgba(23, 21, 15, 0.18)',
        pop: '0 3px 0 rgba(23, 21, 15, 0.9)',
        glow: '0 0 0 rgba(0, 0, 0, 0)',
      },
      maxWidth: {
        page: '76rem',
      },
      borderRadius: {
        card: '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
