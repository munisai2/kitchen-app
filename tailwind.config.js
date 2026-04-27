/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        palace: {
          black:   '#0C0A08',
          smoke:   '#1E1815',
          stone:   '#2E2420',
          maroon:  '#7D1A1A',
          maroonL: '#A02424',
          navy:    '#1B2D52',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#E8C97A',
          muted:   '#7A6535',
        },
        cream: {
          DEFAULT: '#F0E6C8',
          muted:   '#C8B896',
        },
        status: {
          new:       '#EF4444',
          preparing: '#F59E0B',
          ready:     '#10B981',
          complete:  '#6B7280',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
