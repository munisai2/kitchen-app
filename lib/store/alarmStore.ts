import { create } from 'zustand'

interface AlarmStore {
  isAlarming:    boolean
  pendingOrders: string[]
  startAlarm:    (orderId: string) => void
  stopAlarm:     (orderId: string) => void
  stopAllAlarms: () => void
}

export const useAlarmStore = create<AlarmStore>((set, get) => ({
  isAlarming:    false,
  pendingOrders: [],

  startAlarm: (orderId) => set(state => ({
    isAlarming:    true,
    pendingOrders: [...state.pendingOrders, orderId],
  })),

  stopAlarm: (orderId) => {
    const remaining = get().pendingOrders.filter(id => id !== orderId)
    set({
      pendingOrders: remaining,
      isAlarming:    remaining.length > 0,
    })
  },

  stopAllAlarms: () => set({ isAlarming: false, pendingOrders: [] }),
}))
