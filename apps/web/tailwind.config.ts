import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1915',
        paper: '#f3eee6',
        card: '#fffdf8',
        saffron: '#c4551a',
        forest: '#1d6b48',
        navy: '#1b3344',
        line: '#e4d9c8',
        danger: '#9f2d2d',
        warn: '#8a5a12',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(28, 25, 21, 0.04), 0 16px 40px rgba(28, 25, 21, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
