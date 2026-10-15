import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16130f',
        paper: '#f3ecdf',
        card: '#fffaf3',
        saffron: '#c9841a',
        forest: '#1c6a45',
        navy: '#1a2744',
        line: '#e4d5bf',
        danger: '#8c2e2a',
        warn: '#8a5a12',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        deva: ['var(--font-deva)', 'serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.7rem,6vw,5.4rem)', { lineHeight: '0.96', letterSpacing: '-0.03em' }],
        'display-2': ['clamp(2rem,4vw,3.4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        card: '0 1px 0 rgba(22, 19, 15, 0.05), 0 18px 40px rgba(26, 39, 68, 0.06)',
      },
      maxWidth: {
        page: '72rem',
      },
    },
  },
  plugins: [],
};

export default config;
