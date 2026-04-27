import { create } from 'zustand'

interface RestaurantStore {
  logoUrl: string | null
  setLogoUrl: (url: string | null) => void
}

export const useRestaurantStore = create<RestaurantStore>(set => ({
  logoUrl: null,
  setLogoUrl: (url) => set({ logoUrl: url }),
}))
