import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        paper: '#e5e9eb',
        card: '#ffffff',
        muted: '#6b6b6b',
        line: '#d5dadd',
        low: '#1f6b45',
        mid: '#8a5a12',
        high: '#9b1c1c',
        // Legacy names kept so older class strings still resolve to this palette.
        saffron: '#111111',
        forest: '#1f6b45',
        navy: '#111111',
        danger: '#9b1c1c',
        warn: '#8a5a12',
      },
      fontFamily: {
        display: ['var(--font-sans)', 'Manrope', 'sans-serif'],
        sans: ['var(--font-sans)', 'Manrope', 'sans-serif'],
        hindi: ['var(--font-hindi)', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.2rem, 4.6vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '500' }],
        'display-2': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '500' }],
      },
      boxShadow: {
        card: '0 24px 60px rgba(17, 17, 17, 0.05)',
      },
      maxWidth: {
        page: '72rem',
      },
      borderRadius: {
        card: '1.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
