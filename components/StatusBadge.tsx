import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { OrderStatus } from '../lib/types'
import { theme } from '../constants/theme'

interface StatusBadgeProps {
  status: OrderStatus
}

const LABELS: Record<OrderStatus, string> = {
  new:       'NEW',
  confirmed: 'CONFIRMED',
  preparing: 'PREPARING',
  ready:     'READY',
  completed: 'DONE',
  cancelled: 'CANCELLED',
  scheduled: 'SCHEDULED',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: getBgColor(status) }]}>
      <Text style={styles.label}>{LABELS[status]}</Text>
    </View>
  )
}

function getBgColor(status: OrderStatus): string {
  switch (status) {
    case 'new':       return theme.colors.status.new + '33'
    case 'confirmed': return theme.colors.gold.DEFAULT + '33'
    case 'preparing': return theme.colors.status.preparing + '33'
    case 'ready':     return theme.colors.status.ready + '33'
    case 'completed': return theme.colors.status.complete + '33'
    case 'cancelled': return theme.colors.palace.maroon + '33'
    default:          return '#33333333'
  }
}

function getTextColor(status: OrderStatus): string {
  switch (status) {
    case 'new':       return theme.colors.status.new
    case 'confirmed': return theme.colors.gold.DEFAULT
    case 'preparing': return theme.colors.status.preparing
    case 'ready':     return theme.colors.status.ready
    case 'completed': return theme.colors.status.complete
    case 'cancelled': return theme.colors.palace.maroonL
    default:          return '#888'
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      4,
  },
  label: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1,
    color:         theme.colors.cream.DEFAULT,
  },
})
