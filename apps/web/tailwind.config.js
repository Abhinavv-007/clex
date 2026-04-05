/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Core neutrals (B/W system) ─────────────────────────────
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        overlay: 'var(--overlay)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        // Text
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        // Accent — kept subtle, blue only
        accent: '#3b82f6',
        'accent-dim': 'rgba(59,130,246,0.15)',
        'accent-border': 'rgba(59,130,246,0.3)',
        // Status
        green: '#22c55e',
        amber: '#f59e0b',
        red: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '18px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
        md: ['15px', '24px'],
        lg: ['16px', '26px'],
        xl: ['18px', '28px'],
        '2xl': ['22px', '32px'],
        '3xl': ['28px', '36px'],
        '4xl': ['36px', '44px'],
        '5xl': ['48px', '56px'],
        '6xl': ['64px', '72px'],
        '7xl': ['80px', '88px'],
      },
      letterSpacing: {
        tight: '-0.04em',
        snug: '-0.025em',
        normal: '-0.01em',
        wide: '0.02em',
        wider: '0.08em',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        'sm-dark': '0 1px 2px rgba(0,0,0,0.6)',
        'md-dark': '0 4px 16px rgba(0,0,0,0.5)',
        'lg-dark': '0 8px 32px rgba(0,0,0,0.6)',
        'xl-dark': '0 16px 64px rgba(0,0,0,0.7)',
        'card': '0 0 0 1px var(--border), 0 4px 16px rgba(0,0,0,0.3)',
        'card-hover': '0 0 0 1px var(--border-strong), 0 8px 32px rgba(0,0,0,0.4)',
        'glow-blue': '0 0 32px rgba(59,130,246,0.15)',
        'inner': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.4s ease both',
        'float': 'float 8s ease-in-out infinite',
        'float-slow': 'float 12s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 6s linear infinite',
        'beam': 'beam 2s ease-in-out infinite',
        'star-drift': 'starDrift 20s linear infinite',
        'enter-1': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both',
        'enter-2': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both',
        'enter-3': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both',
        'enter-4': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSubtle: {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        beam: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '40%': { opacity: '1' },
          '100%': { transform: 'translateX(300%)', opacity: '0' },
        },
        starDrift: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(-100px)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px',
      },
    },
  },
  plugins: [],
}
