import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF6EE',
        paperdeep: '#F1EAD9',
        card: '#FFFFFF',
        ink: '#1B1712',
        inksoft: '#6B6257',
        risk: '#FF3B30',
        hotpink: '#FF4D8D',
        hl: '#FFD02F',
        lime: '#A3E635',
        sky: '#38BDF8',
        grape: '#8B5CF6',
        line: 'rgba(27,23,18,0.14)',
      },
      fontFamily: {
        display: ['Archivo', '"Inter Tight"', 'system-ui', 'sans-serif'],
        sans: ['Archivo', '"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        hand: ['Caveat', 'cursive'],
        dev: ['"Noto Sans"', 'sans-serif'],
      },
      maxWidth: {
        page: '76rem',
      },
      boxShadow: {
        sticker: '5px 5px 0 #1B1712',
        'sticker-sm': '3px 3px 0 #1B1712',
        'sticker-lg': '8px 8px 0 #1B1712',
      },
      keyframes: {
        marquee: { to: { transform: 'translateX(-50%)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        raindrift: { to: { transform: 'translateY(-50%)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        blink: 'blink 1.6s ease-in-out infinite',
        raindrift: 'raindrift 90s linear infinite',
        wiggle: 'wiggle 0.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
