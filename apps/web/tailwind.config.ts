import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0b0b14',
        panel: '#14141f',
        panel2: '#1b1b2b',
        ink: '#f2f2ea',
        muted: '#8b8b9e',
        line: '#2a2a3d',
        lime: '#b4ff39',
        pink: '#ff4ad8',
        cyan: '#4ae3ff',
        yellow: '#ffd94a',
        danger: '#ff4a5e',
        warn: '#ffd94a',
        // legacy aliases — old class names keep working on the new palette
        canvas: '#0b0b14',
        paper: '#0b0b14',
        card: '#14141f',
        raised: '#1b1b2b',
        accent: '#b4ff39',
        'accent-deep': '#8fd42a',
        electric: '#b4ff39',
        low: '#b4ff39',
        mid: '#ffd94a',
        high: '#ff4a5e',
        forest: '#b4ff39',
        saffron: '#b4ff39',
        navy: '#f2f2ea',
        'pastel-pink': '#ff4ad8',
        'pastel-sky': '#4ae3ff',
        'pastel-butter': '#ffd94a',
        'pastel-mint': '#b4ff39',
      },
      fontFamily: {
        sans: ['var(--font-grotesk)', '"Space Grotesk"', 'sans-serif'],
        mono: ['var(--font-spacemono)', '"Space Mono"', 'ui-monospace', 'monospace'],
        display: ['var(--font-pixel)', '"Pixelify Sans"', 'monospace'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.4rem, 7.5vw, 6rem)', { lineHeight: '1.02', letterSpacing: '0', fontWeight: '700' }],
        'display-2': ['clamp(1.7rem, 4vw, 3rem)', { lineHeight: '1.05', letterSpacing: '0', fontWeight: '700' }],
      },
      boxShadow: {
        card: '6px 6px 0 rgba(0, 0, 0, 0.55)',
        pop: '4px 4px 0 #000000',
        px: '6px 6px 0 #000000',
      },
      maxWidth: {
        page: '76rem',
      },
    },
  },
  plugins: [],
};

export default config;
