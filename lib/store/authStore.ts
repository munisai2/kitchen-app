import { create } from 'zustand'
import { UserRole } from '../types'

interface AuthStore {
  role:     UserRole | null
  isAuthed: boolean
  login:    (role: UserRole) => void
  logout:   () => void
}

export const useAuthStore = create<AuthStore>(set => ({
  role:     null,
  isAuthed: false,
  login:    (role) => set({ role, isAuthed: true }),
  logout:   () => set({ role: null, isAuthed: false }),
}))
