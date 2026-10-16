import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#000000',
        panel: '#0a0a0a',
        ink: '#ffffff',
        muted: '#8a8a8a',
        signal: '#fd0100',
        go: '#00e676',
        banana: '#faed8f',
        line: 'rgba(255,255,255,0.12)',
      },
      fontFamily: {
        display: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        dev: ['"Noto Sans"', 'sans-serif'],
      },
      maxWidth: {
        page: '76rem',
      },
      keyframes: {
        marquee: { to: { transform: 'translateX(-50%)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        raindrift: { to: { transform: 'translateY(-50%)' } },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        blink: 'blink 1.6s ease-in-out infinite',
        raindrift: 'raindrift 90s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
