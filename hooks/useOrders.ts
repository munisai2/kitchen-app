import { useEffect, useState, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { client } from '../lib/sanity'
import { activeOrdersQuery } from '../lib/queries'
import { Order } from '../lib/types'
import { useAlarmStore } from '../lib/store/alarmStore'
import { stopAlarm, playBeep } from '../lib/sound'
import { sendOrderEmail } from '../lib/notifications'
import { showToast } from '../components/Toast'
import { restaurantInfoQuery } from '../lib/queries'
import { useRestaurantStore } from '../lib/store/restaurantStore'

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

      // Fetch logo URL for emails
      const restInfo = await client.fetch(restaurantInfoQuery)
      if (restInfo?.logo?.asset?.url) {
        useRestaurantStore.getState().setLogoUrl(restInfo.logo.asset.url)
      }

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
            (updatedOrder.status === 'new' || updatedOrder.status === 'scheduled')

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

        // Activation Alarm: Alert when order enters the 30-minute preparation window
        if (minutesUntil <= 30 && minutesUntil > 0) {
          if (!alreadyAlerted.current.has(order._id)) {
            alreadyAlerted.current.add(order._id)
            console.log(`[alarm] Activating scheduled order ${order.orderId} - ${Math.round(minutesUntil)} mins left`)
            
            // Automatically promote to 'new' status so it shows up for confirmation
            client.patch(order._id).set({ status: 'new' }).commit()
              .catch(err => console.error('[activation] Failed to update status:', err))

            startAlarmStore(order._id)
            showToast(`Scheduled Order #${order.orderId} is now active!`, 'info')
          }
        }
      })

      // Reminder Alarm: Re-sound alarm for new (unconfirmed) orders every 2 mins
      const newOrders = orders.filter(o => o.status === 'new')
      newOrders.forEach(order => {
        const placedAt = new Date(order.placedAt)
        const minsSincePlaced = (now.getTime() - placedAt.getTime()) / 60000
        
        // If unconfirmed for > 2 mins, and we haven't reminded in the last 2 mins
        if (minsSincePlaced >= 2) {
          const lastReminder = (order as any)._lastReminder || 0
          if (now.getTime() - lastReminder > 120000) {
            (order as any)._lastReminder = now.getTime()
            console.log(`[alarm] Reminder for unconfirmed order #${order.orderId}`)
            startAlarmStore(order._id)
          }
        }
      })
    }, 30000) // Check every 30s for better accuracy
    return () => clearInterval(id)
  }, [orders, startAlarmStore])

  // Safety Fallback: Poll every 10s if listener is offline
  useEffect(() => {
    if (isConnected) return
    const id = setInterval(() => {
      fetchOrders()
    }, 10000)
    return () => clearInterval(id)
  }, [isConnected, fetchOrders])

  async function updateOrderStatus(orderId: string, newStatus: Order['status'], kitchenMsg?: string, overrideData?: Partial<Order>) {
    try {
      const updateObj: any = { status: newStatus }
      if (kitchenMsg !== undefined) updateObj.kitchenMessage = kitchenMsg

      await client.patch(orderId).set(updateObj).commit()

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

      // Email Notifications
      let order = orders.find(o => o._id === orderId)
      if (!order) return

      // Merge override data for notification (if provided)
      if (overrideData) {
        order = { ...order, ...overrideData }
      }

      const logoUrl = useRestaurantStore.getState().logoUrl

      // 1. ACCEPT: Send confirmed email for ALL order types when kitchen accepts
      if (newStatus === 'preparing' && order.orderType !== 'reservation') {
        sendOrderEmail({
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          type: 'confirmed',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            estimatedTime: order.estimatedTime || 30,
            tableNumber: order.tableNumber,
            items: order.items,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            specialRequests: order.specialRequests,
            placedAt: order.placedAt,
            discountAmount: order.discountAmount,
            adjustmentReason: (order as any).adjustmentReason,
            promoCode: order.promoCode,
            promoDiscount: order.promoDiscount,
            kitchenMessage: kitchenMsg,
            logoUrl
          }
        })
      }

      // 1b. ACCEPT Reservation: Send reservation reminder
      if (newStatus === 'preparing' && order.orderType === 'reservation') {
        sendOrderEmail({
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          type: 'reservation_reminder',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            guestCount: order.guestCount || 1,
            formattedTime: order.reservationTime ? format(parseISO(order.reservationTime), 'EEEE, MMM d \u2018at\u2019 h:mm a') : 'your reserved time',
            logoUrl
          }
        })
      }

      // 2. READY: Send ready email for pickup and dine-in
      if (newStatus === 'ready') {
        sendOrderEmail({
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          type: 'ready',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            discountAmount: order.discountAmount,
            adjustmentReason: (order as any).adjustmentReason,
            promoCode: order.promoCode,
            promoDiscount: order.promoDiscount,
            kitchenMessage: kitchenMsg,
            logoUrl
          }
        })
      }

      // 3. CANCELLED: Send cancellation email
      if (newStatus === 'cancelled') {
        sendOrderEmail({
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          type: 'cancelled',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            reason: (overrideData as any)?.reason || kitchenMsg || 'Order cancelled by restaurant',
            items: order.items,
            total: order.total,
            logoUrl
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
