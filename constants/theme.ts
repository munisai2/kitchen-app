export const theme = {
  colors: {
    palace: {
      black:   '#050505',
      smoke:   '#0F0F0F',
      stone:   '#1A1A1A',
      maroon:  '#4A0E0E',
      maroonL: '#7D1A1A',
      navy:    '#0A1931',
    },
    gold: {
      DEFAULT: '#D4AF37', // More classic gold
      light:   '#F1D592',
      muted:   '#996515',
    },
    cream: {
      DEFAULT: '#E5D3B3',
      muted:   '#A69480',
    },
    status: {
      new:       '#EF4444',
      preparing: '#F59E0B',
      ready:     '#10B981',
      complete:  '#6B7280',
      cancelled: '#7D1A1A',
    },
  },
} as const

export type ThemeColors = typeof theme.colors
