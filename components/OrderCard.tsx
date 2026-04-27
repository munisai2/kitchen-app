import {
  View, Text, TouchableOpacity, StyleSheet, Pressable, Animated
} from 'react-native'
import React, { useState, useEffect, useRef } from 'react'
import { Order } from '../lib/types'
import { theme } from '../constants/theme'
import { format, parseISO, addMinutes } from 'date-fns'
import { StatusBadge } from './StatusBadge'

interface OrderCardProps {
  order:          Order
  onStatusUpdate: (orderId: string, status: Order['status']) => void
  onPress:        () => void
}

const NEXT_STATUS: Record<string, Order['status']> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'completed',
}

export function OrderCard({ order, onStatusUpdate, onPress }: OrderCardProps) {
  const isScheduled = order.status === 'scheduled' || order.orderType === 'reservation'
  const isReservation = order.orderType === 'reservation'
  const isDineIn    = order.orderType === 'dine-in'
  
  const nextStatus = NEXT_STATUS[order.status]
  
  // Countdown for scheduled orders
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const timeStr = order.reservationTime || order.scheduledTime
    if (!isScheduled || !timeStr) return

    function update() {
      const target = new Date(timeStr!)
      const diff = (target.getTime() - new Date().getTime()) / 60000
      setMinutesLeft(Math.max(0, Math.floor(diff)))
    }

    update()
    const id = setInterval(update, 10000) // Update every 10s
    return () => clearInterval(id)
  }, [isScheduled, order.scheduledTime, order.reservationTime])

  // Pulsing animation
  useEffect(() => {
    if (isScheduled && minutesLeft !== null && minutesLeft < 30) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isScheduled, minutesLeft])

  function formatTime(iso: string) {
    return format(parseISO(iso), 'h:mm a')
  }

  function getCountdownText() {
    if (minutesLeft === null) return ''
    if (minutesLeft <= 0) return 'DUE NOW'
    const h = Math.floor(minutesLeft / 60)
    const m = minutesLeft % 60
    if (h > 0) return `In ${h}h ${m}m`
    return `In ${m} minutes`
  }

  const countdownColor = minutesLeft !== null && minutesLeft < 30 ? '#EF4444' : (minutesLeft !== null && minutesLeft < 60 ? '#F59E0B' : '#94A3B8')
  const isAvailable = minutesLeft !== null && minutesLeft <= 30
  
  // Prep time display
  const timeDisplay = order.estimatedTime 
    ? `${order.estimatedTime}m`
    : '25-35m'

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.card,
        isScheduled && styles.cardScheduled,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      {isScheduled && (
        <View style={[styles.scheduledLabel, isReservation && { backgroundColor: 'rgba(88, 28, 135, 0.5)' }]}>
          <Text style={[styles.scheduledLabelText, isReservation && { color: '#D8B4FE' }]}>
            {isReservation ? '🍽️ RESERVATION' : '📅 SCHEDULED ORDER'}
          </Text>
        </View>
      )}

      <View style={[styles.cardHeader, isScheduled && styles.cardHeaderScheduled]}>
        <View>
          <Text style={[styles.orderId, isScheduled && { color: '#94A3B8' }]}>{order.orderId}</Text>
          <Text style={styles.placedAt}>
            Placed {order.placedAt ? formatTime(order.placedAt) : '—'}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {isScheduled && (order.scheduledTime || order.reservationTime) && (
        <View style={styles.scheduledNotice}>
          <Text style={styles.scheduledTimeText}>
            {isReservation ? 'Arrival: ' : 'Pickup: '}
            {format(parseISO(order.reservationTime || order.scheduledTime!), 'EEEE MMM d')} at {format(parseISO(order.reservationTime || order.scheduledTime!), 'h:mm a')}
          </Text>
          <Animated.Text style={[styles.countdownText, { color: countdownColor, opacity: pulseAnim }]}>
            {getCountdownText()}
          </Animated.Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName} numberOfLines={1}>{order.customerName}</Text>
            {isReservation && (
              <Text style={{ color: theme.colors.cream.muted, fontSize: 12, marginTop: 4 }}>
                {order.guestCount || 1} guests • {order.tableNumber ? `Table ${order.tableNumber}` : 'No table assigned'}
              </Text>
            )}
          </View>
          {isDineIn && order.tableNumber && (
            <View style={styles.tableBadge}>
              <Text style={styles.tableText}>T-{order.tableNumber}</Text>
            </View>
          )}
        </View>
        
        {/* Indicators Row */}
        <View style={styles.indicators}>
          <View style={[
            styles.pill, 
            { backgroundColor: isDineIn ? '#2563EB' : isReservation ? '#7E22CE' : theme.colors.palace.stone }
          ]}>
            <Text style={[
              styles.pillText, 
              { color: (isDineIn || isReservation) ? '#FFF' : theme.colors.cream.muted }
            ]}>
              {order.orderType?.toUpperCase() || 'PICKUP'}
            </Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>🕒 {timeDisplay}</Text>
          </View>
          {order.discountAmount && !order.promoCode ? (
            <View style={[styles.pill, { backgroundColor: '#C9A84C33' }]}>
              <Text style={[styles.pillText, { color: theme.colors.gold.DEFAULT }]}>💰 ADJUSTED</Text>
            </View>
          ) : null}
          {order.promoCode ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(20, 83, 45, 0.3)', paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Text style={[styles.pillText, { color: '#4ADE80', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }]}>
                🏷️ Promo: {order.promoCode}
              </Text>
            </View>
          ) : null}
          {order.specialRequests ? (
            <View style={[styles.pill, { backgroundColor: '#F59E0B22' }]}>
              <Text style={[styles.pillText, { color: '#F59E0B' }]}>⚠️ REQ</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.itemsPreview}>
          {order.items?.slice(0, 2).map((item, i) => (
            <Text key={i} style={styles.itemText} numberOfLines={1}>
              {item.quantity}x {item.name}
            </Text>
          ))}
          {(order.items?.length ?? 0) > 2 && (
            <Text style={styles.moreText}>+ {(order.items?.length ?? 0) - 2} more items</Text>
          )}
        </View>
      </View>

      {nextStatus && (
        <View>
          <TouchableOpacity
            disabled={isScheduled && !isAvailable}
            style={[
              styles.actionBtn,
              { backgroundColor: order.status === 'new' ? '#DC2626' : order.status === 'preparing' ? '#2563EB' : '#16A34A' },
              isScheduled && { backgroundColor: isAvailable ? '#DC2626' : '#334155' }
            ]}
            onPress={() => {
              const statusToSet = ((isDineIn || isReservation) && order.status === 'preparing') ? 'completed' : nextStatus
              onStatusUpdate(order._id, statusToSet)
            }}
          >
            <Text style={[styles.actionBtnText, isScheduled && !isAvailable && { color: '#64748B' }]}>
              {order.status === 'new' ? 'ACCEPT' : 
               ((isDineIn || isReservation) && order.status === 'preparing') ? 'SERVE ORDER 🍽️' : 
               order.status === 'preparing' ? 'READY' : 
               (isScheduled && !isAvailable) ? 'ACCEPT' :
               isScheduled ? 'ACCEPT ORDER ✓' : 'DONE'}
            </Text>
          </TouchableOpacity>
          
          {isScheduled && !isAvailable && (order.scheduledTime || order.reservationTime) && (
            <Text style={styles.availText}>
              Available at {format(addMinutes(parseISO((order.scheduledTime || order.reservationTime)!), -30), 'h:mm a')}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.palace.smoke,
    borderRadius:    12,
    marginBottom:    12,
    borderWidth:     1.5,
    borderColor:     theme.colors.palace.stone,
    overflow:        'hidden',
  },
  cardScheduled: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  cardPressed: {
    backgroundColor: theme.colors.palace.stone,
  },
  cardHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    padding:         12,
    borderBottomWidth:1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cardHeaderScheduled: {
    backgroundColor: '#0F172A',
  },
  scheduledLabel: {
    backgroundColor: '#334155',
    paddingVertical: 4,
    width: '100%',
    alignItems: 'center',
  },
  scheduledLabelText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  orderId: {
    color:      theme.colors.gold.DEFAULT,
    fontSize:   14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  placedAt: {
    color:    theme.colors.cream.muted,
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    padding: 12,
  },
  customerName: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  tableBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  scheduledNotice: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  scheduledTimeText: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '700',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  availText: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillText: {
    color: theme.colors.cream.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  itemsPreview: {
    marginTop: 4,
  },
  itemText: {
    color:    theme.colors.cream.muted,
    fontSize: 13,
    marginBottom: 2,
  },
  moreText: {
    color:    theme.colors.gold.muted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
})

