import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0a0a0f',
        panel: '#121218',
        panel2: '#1a1a22',
        ink: '#f4f1ea',
        muted: '#9a958a',
        line: '#26262f',
        gold: '#e8b34a',
        goldlight: '#f5c65c',
        signal: '#ff5252',
        // legacy aliases
        canvas: '#0a0a0f',
        paper: '#0a0a0f',
        card: '#121218',
        raised: '#1a1a22',
        accent: '#e8b34a',
        'accent-deep': '#c9962f',
        electric: '#e8b34a',
        lime: '#e8b34a',
        pink: '#e8b34a',
        cyan: '#8ecae6',
        yellow: '#f5c65c',
        danger: '#ff5252',
        warn: '#f5c65c',
        low: '#7ddf9a',
        mid: '#f5c65c',
        high: '#ff5252',
        forest: '#7ddf9a',
        saffron: '#e8b34a',
        navy: '#f4f1ea',
        'pastel-pink': '#e8b34a',
        'pastel-sky': '#8ecae6',
        'pastel-butter': '#f5c65c',
        'pastel-mint': '#7ddf9a',
      },
      fontFamily: {
        sans: ['var(--font-grotesk)', '"Space Grotesk"', 'sans-serif'],
        mono: ['var(--font-jbmono)', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['var(--font-syne)', '"Syne"', 'sans-serif'],
        serifit: ['var(--font-instr)', '"Instrument Serif"', 'Georgia', 'serif'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.8rem, 7.5vw, 6.5rem)', { lineHeight: '0.98', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-2': ['clamp(2rem, 4.5vw, 3.5rem)', { lineHeight: '1.0', letterSpacing: '-0.02em', fontWeight: '800' }],
      },
      boxShadow: {
        card: '0 24px 60px -24px rgba(0, 0, 0, 0.7)',
        glow: '0 0 40px rgba(232, 179, 74, 0.25)',
        pop: '0 12px 32px -12px rgba(0, 0, 0, 0.6)',
      },
      maxWidth: {
        page: '76rem',
      },
    },
  },
  plugins: [],
};

export default config;
