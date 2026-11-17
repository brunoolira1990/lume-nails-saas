import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Off-white fundo (base da marca Lume Nails)
        offwhite: {
          50: '#FFFFFF',
          100: '#FAF7F2',
          200: '#F5EFE6',
          300: '#EFE6DA',
        },
        // Lilás / roxo suave (primário)
        lumelavender: {
          50: '#F5F3FF',
          100: '#EEEBFF',
          200: '#E3DFFD',
          300: '#D4CAFA',
          400: '#C4B5FD',
          500: '#A78BFA',
          600: '#8B5CF6',
          700: '#7C3AED',
          800: '#6D28D9',
          900: '#5B21B6',
        },
        // Dourado (destaques)
        lumegold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: ['Plus_Jakarta_Sans', 'sans-serif'],
        serif: ['Playfair_Display', 'serif'],
        script: ['Great_Vibes', 'cursive'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
