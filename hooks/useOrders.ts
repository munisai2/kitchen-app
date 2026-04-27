import { useEffect, useState, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { client } from '../lib/sanity'
import { activeOrdersQuery } from '../lib/queries'
import { Order } from '../lib/types'
import { useAlarmStore } from '../lib/store/alarmStore'
import { stopAlarm, playBeep } from '../lib/sound'
import { sendOrderSMS } from '../lib/sms'
import { showToast } from '../components/Toast'

export function useOrders() {
  const [orders,      setOrders]      = useState<Order[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(true)
  const knownOrderIds                 = useRef<Set<string>>(new Set())
  const alreadyAlerted                = useRef<Set<string>>(new Set())
  const { startAlarm: startAlarmStore, stopAlarm: stopAlarmStore, pendingOrders } = useAlarmStore()

  const fetchOrders = useCallback(async () => {
    try {
      const data = await client.fetch<Order[]>(activeOrdersQuery)
      setOrders(data)
      // Mark all existing orders as known — no alarm for pre-existing orders
      data.forEach(o => knownOrderIds.current.add(o._id))
      setLoading(false)
      setError(null)
      setIsConnected(true)
    } catch (err) {
      setError('Failed to fetch orders')
      setLoading(false)
      setIsConnected(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Real-time listener
  useEffect(() => {
    const subscription = client
      .listen(
        '*[_type == "order" && (status in ["new","preparing","ready"] || (status == "scheduled" && (scheduledTime != null || reservationTime != null)))]',
        {},
        { visibility: 'query', events: ['mutation'] }
      )
      .subscribe({
        next: (update) => {
          setIsConnected(true)
          if (!update.result) return

          const updatedOrder = update.result as unknown as Order
          const isNewOrder =
            !knownOrderIds.current.has(updatedOrder._id) &&
            updatedOrder.status === 'new'

          if (isNewOrder) {
            knownOrderIds.current.add(updatedOrder._id)
            startAlarmStore(updatedOrder._id)
            setOrders(prev => [updatedOrder, ...prev])
          } else {
            setOrders(prev =>
              prev
                .map(o => (o._id === updatedOrder._id ? updatedOrder : o))
                .filter(o => ['new', 'preparing', 'ready', 'scheduled'].includes(o.status))
            )
          }
        },
        error: () => {
          setIsConnected(false)
        },
      })

    return () => subscription.unsubscribe()
  }, [fetchOrders, startAlarmStore])

  // Scheduled Activation Timer (checks every 60s)
  useEffect(() => {
    const id = setInterval(() => {
      const scheduledOrders = orders.filter(o => o.status === 'scheduled' && o.scheduledTime)
      const now = new Date()

      scheduledOrders.forEach(order => {
        const schedTime = new Date(order.scheduledTime!)
        const minutesUntil = (schedTime.getTime() - now.getTime()) / 60000

        // Alert at exactly 30 minutes before
        if (minutesUntil <= 30 && minutesUntil > 29) {
          if (!alreadyAlerted.current.has(order._id)) {
            alreadyAlerted.current.add(order._id)
            
            // 1. Play non-intrusive beep
            playBeep()

            // 2. Show Toast
            showToast(`📅 Scheduled order ${order.orderId} starting in 30 mins`, 'info')
          }
        }
      })
    }, 60000)
    return () => clearInterval(id)
  }, [orders])

  // Safety Fallback: Poll every 10s if listener is offline
  useEffect(() => {
    if (isConnected) return
    const id = setInterval(() => {
      fetchOrders()
    }, 10000)
    return () => clearInterval(id)
  }, [isConnected, fetchOrders])

  async function updateOrderStatus(orderId: string, newStatus: Order['status'], message?: string) {
    try {
      const patches: any = { status: newStatus }
      if (message) patches.kitchenMessage = message

      await client.patch(orderId).set(patches).commit()

      // Accepting an order → stop its alarm
      if (newStatus === 'preparing') {
        stopAlarmStore(orderId)
        const remaining = useAlarmStore.getState().pendingOrders
        if (remaining.length === 0) {
          await stopAlarm()
        }
      }

      // Remove from active list when completed/cancelled
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        setOrders(prev => prev.filter(o => o._id !== orderId))
      }

      // SMS Notifications
      const order = orders.find(o => o._id === orderId)
      if (!order) return

      // 1. Accepted Scheduled Order SMS
      if (order.status === 'scheduled' && newStatus === 'preparing' && order.orderType !== 'reservation') {
        sendOrderSMS({
          to: order.customerPhone,
          type: 'confirmed',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            estimatedTime: order.estimatedTime || 30
          }
        })
      }

      // 1b. Accepted Reservation SMS
      if (newStatus === 'preparing' && order.orderType === 'reservation') {
        sendOrderSMS({
          to: order.customerPhone,
          type: 'reservation_reminder',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            guestCount: order.guestCount || 1,
            formattedTime: order.reservationTime ? format(parseISO(order.reservationTime), 'h:mm a') : 'your reserved time'
          }
        })
      }

      // 2. Ready SMS: ONLY for pickup orders
      if (newStatus === 'ready' && order.orderType === 'pickup') {
        sendOrderSMS({
          to: order.customerPhone,
          type: 'ready',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
          }
        })
      }
    } catch (err) {
      console.error('[orders] Update failed:', err)
      throw err
    }
  }

  return {
    orders,
    loading,
    error,
    isConnected,
    updateOrderStatus,
    refetch: fetchOrders,
  }
}
