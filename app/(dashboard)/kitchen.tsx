import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native'
import { useOrders } from '../../hooks/useOrders'
import { useAlarmStore } from '../../lib/store/alarmStore'
import { OrderCard } from '../../components/OrderCard'
import { EmptyState } from '../../components/EmptyState'
import { ToastContainer, showToast } from '../../components/Toast'
import { Order } from '../../lib/types'
import { theme } from '../../constants/theme'
import { StatusControl } from '../../components/StatusControl'
import { router } from 'expo-router'
export default function KitchenScreen() {
  const { orders, loading, isConnected, updateOrderStatus, refetch } = useOrders()
  const [clock, setClock]      = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Live clock
  useEffect(() => {
    function tick() {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const newOrders  = orders.filter(o => o.status === 'new')
  const prepOrders = orders.filter(o => o.status === 'preparing')
  const readyOrders= orders.filter(o => o.status === 'ready')
  const schedOrders= orders.filter(o => o.status === 'scheduled')
  const newestPending = newOrders[0]

  async function handleStatusUpdate(orderId: string, status: Order['status'], message?: string) {
    try {
      await updateOrderStatus(orderId, status, message)
      const labels: Record<string, string> = {
        preparing: 'Order accepted — now preparing',
        ready:     'Order marked as ready!',
        completed: 'Order completed ✓',
        cancelled: 'Order cancelled',
      }
      showToast(labels[status] ?? 'Status updated', 'success')
    } catch {
      showToast('Failed to update order — check connection', 'error')
    }
  }

  function openOrderDetail(order: Order) {
    router.push({ pathname: '/(dashboard)/order-detail', params: { id: order._id } } as any)
  }

  async function onRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <View style={styles.root}>
      {/* 🟢 Feature 1: Status Control */}
      <StatusControl orders={orders} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>QASR KITCHEN</Text>

        <View style={styles.headerCounts}>
          <Text style={styles.countBadge}>
            🔴 {newOrders.length + schedOrders.length} New
          </Text>
          <Text style={styles.countBadge}>
            🟡 {prepOrders.length} Preparing
          </Text>
          <Text style={styles.countBadge}>
            🟢 {readyOrders.length} Ready
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.colors.status.ready : theme.colors.status.new }]} />
          <Text style={styles.clockText}>{clock}</Text>
        </View>
      </View>

      {/* Connection warning */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            ⚠️ Connection lost — orders may be delayed. Reconnecting...
          </Text>
        </View>
      )}

      {/* Columns */}
      <View style={styles.columns}>
        <OrderColumn
          title="NEW"
          color={theme.colors.status.new}
          orders={[...newOrders, ...schedOrders]}
          onStatusUpdate={handleStatusUpdate}
          onOrderPress={openOrderDetail}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
        <OrderColumn
          title="PREPARING"
          color={theme.colors.status.preparing}
          orders={prepOrders}
          onStatusUpdate={handleStatusUpdate}
          onOrderPress={openOrderDetail}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
        <OrderColumn
          title="READY"
          color={theme.colors.status.ready}
          orders={readyOrders}
          onStatusUpdate={handleStatusUpdate}
          onOrderPress={openOrderDetail}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </View>

      <ToastContainer />
    </View>
  )
}


function OrderColumn({
  title, color, orders, onStatusUpdate, onOrderPress, refreshing, onRefresh,
}: {
  title:          string
  color:          string
  orders:         Order[]
  onStatusUpdate: (id: string, s: Order['status']) => void
  onOrderPress:   (o: Order) => void
  refreshing:     boolean
  onRefresh:      () => void
}) {
  return (
    <View style={colStyles.column}>
      {/* Column header */}
      <View style={[colStyles.header, { borderBottomColor: color }]}>
        <Text style={[colStyles.title, { color }]}>{title}</Text>
        <View style={[colStyles.badge, { backgroundColor: color + '33' }]}>
          <Text style={[colStyles.badgeText, { color }]}>{orders.length}</Text>
        </View>
      </View>
      
      {title === 'NEW' && orders.some(o => o.status === 'scheduled') && (
        <Text style={colStyles.scheduledBadge}>
          📅 {orders.filter(o => o.status === 'scheduled').length} scheduled
        </Text>
      )}

      <ScrollView
        style={colStyles.scroll}
        contentContainerStyle={colStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.gold.DEFAULT}
          />
        }
      >
        {orders.length === 0 ? (
          <EmptyState
            icon="✅"
            title="Clear"
            subtitle="No orders here"
          />
        ) : (
          orders.map((order, idx) => {
            const isFirstScheduled = order.status === 'scheduled' && (idx === 0 || orders[idx-1].status !== 'scheduled')
            const hasNewOrdersBefore = idx > 0 && orders[0].status !== 'scheduled'

            return (
              <React.Fragment key={order._id}>
                {isFirstScheduled && hasNewOrdersBefore && (
                  <View style={colStyles.separator}>
                    <View style={colStyles.sepLine} />
                    <Text style={colStyles.sepText}>scheduled</Text>
                    <View style={colStyles.sepLine} />
                  </View>
                )}
                <OrderCard
                  order={order}
                  onStatusUpdate={onStatusUpdate}
                  onPress={() => onOrderPress(order)}
                />
              </React.Fragment>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}


const styles = StyleSheet.create({
  root: {
    flex:      1,
    flexDirection: 'column',
    backgroundColor: theme.colors.palace.black,
  },
  alarmOverlay: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    zIndex:         100,
    alignItems:     'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(125,26,26,0.6)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.status.new,
  },
  alarmTitle: {
    color:        theme.colors.gold.DEFAULT,
    fontSize:     28,
    fontWeight:   '900',
    letterSpacing: 3,
  },
  alarmOrderId: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '600',
    marginTop:  4,
  },
  alarmSummary: {
    color:    theme.colors.cream.muted,
    fontSize: 13,
    marginTop: 2,
  },
  alarmHint: {
    color:    theme.colors.gold.muted,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:  10,
    backgroundColor: theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  headerTitle: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: 3,
    width:         120,
  },
  headerCounts: {
    flexDirection: 'row',
    gap:           20,
  },
  countBadge: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 13,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    width:         160,
    justifyContent:'flex-end',
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  clockText: {
    color:    theme.colors.cream.muted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  offlineBanner: {
    backgroundColor: theme.colors.palace.maroon,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 12,
    textAlign:'center',
  },
  columns: {
    flex:          1,
    flexDirection: 'row',
  },
})

const colStyles = StyleSheet.create({
  column: {
    flex:            1,
    backgroundColor: theme.colors.palace.black,
    borderRightWidth: 1,
    borderRightColor: theme.colors.palace.stone,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingHorizontal: 12,
    paddingVertical:   10,
    backgroundColor:   theme.colors.palace.smoke,
    borderBottomWidth: 2,
  },
  title: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: 2,
  },
  badge: {
    borderRadius:    4,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:   12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scheduledBadge: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  sepText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scrollContent: {
    padding: 10,
    flexGrow: 1,
  },
})
