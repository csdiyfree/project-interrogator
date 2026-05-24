import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 用 RGB 通道 + <alpha-value>,使 /透明度 修饰符(bg-accent/10 等)生效。
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-2': 'rgb(var(--accent-2-rgb) / <alpha-value>)',
        green: 'rgb(var(--green-rgb) / <alpha-value>)',
        amber: 'rgb(var(--amber-rgb) / <alpha-value>)',
        red: 'rgb(var(--red-rgb) / <alpha-value>)',
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '22px',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(70, 50, 30, 0.08)',
        'soft-lg': '0 16px 50px rgba(70, 50, 30, 0.12)',
      },
      fontFamily: {
        serif: ['Fraunces', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s ease both',
        'fade-in': 'fade-in 0.4s ease both',
        blink: 'blink 1s step-end infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
