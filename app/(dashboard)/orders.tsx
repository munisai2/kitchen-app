import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl,
} from 'react-native'
import { client } from '../../lib/sanity'
import { ordersHistoryQuery } from '../../lib/queries'
import { Order } from '../../lib/types'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState } from '../../components/EmptyState'
import { theme } from '../../constants/theme'
import { format, isToday, isYesterday, parseISO, isThisWeek } from 'date-fns'

type DateFilter  = 'today' | 'week' | 'all'
type StatusFilter = 'all' | 'completed' | 'cancelled'

export default function OrdersScreen() {
  const [orders,       setOrders]       = useState<Order[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [search,       setSearch]       = useState('')
  const [dateFilter,   setDateFilter]   = useState<DateFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const data = await client.fetch<Order[]>(ordersHistoryQuery(200))
      setOrders(data)
    } catch (e) {
      console.error('[orders history]', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function onRefresh() {
    setRefreshing(true)
    fetchHistory()
  }

  // Filter logic
  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.customerName?.toLowerCase().includes(q) &&
          !o.orderId?.toLowerCase().includes(q)) return false
    }
    if (!o.placedAt) return dateFilter === 'all'  // skip date filters if no date
    if (dateFilter === 'today' && !isToday(parseISO(o.placedAt))) return false
    if (dateFilter === 'week'  && !isThisWeek(parseISO(o.placedAt))) return false
    return true
  })

  // Group by date
  const groups: { title: string; data: Order[] }[] = []
  const seen = new Set<string>()
  for (const o of filtered) {
    const key = o.placedAt
      ? (() => {
          const d = parseISO(o.placedAt)
          return isToday(d)     ? 'Today'
               : isYesterday(d) ? 'Yesterday'
               : format(d, 'EEEE, MMM d')
        })()
      : 'Unknown Date'
    if (!seen.has(key)) {
      seen.add(key)
      groups.push({ title: key, data: [] })
    }
    groups[groups.length - 1].data.push(o)
  }

  const flatItems: ({ type: 'header'; title: string } | { type: 'row'; order: Order })[] = []
  for (const g of groups) {
    flatItems.push({ type: 'header', title: g.title })
    for (const o of g.data) flatItems.push({ type: 'row', order: o })
  }

  function DatePill({ label, val }: { label: string; val: DateFilter }) {
    return (
      <TouchableOpacity
        style={[styles.pill, dateFilter === val && styles.pillActive]}
        onPress={() => setDateFilter(val)}
      >
        <Text style={[styles.pillText, dateFilter === val && styles.pillTextActive]}>{label}</Text>
      </TouchableOpacity>
    )
  }

  function StatusPill({ label, val }: { label: string; val: StatusFilter }) {
    return (
      <TouchableOpacity
        style={[styles.pill, statusFilter === val && styles.pillActive]}
        onPress={() => setStatusFilter(val)}
      >
        <Text style={[styles.pillText, statusFilter === val && styles.pillTextActive]}>{label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, order ID…"
          placeholderTextColor={theme.colors.cream.muted + '66'}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <DatePill label="Today"     val="today" />
          <DatePill label="This Week" val="week"  />
          <DatePill label="All Time"  val="all"   />
        </View>
        <View style={styles.filterRow}>
          <StatusPill label="All"       val="all"       />
          <StatusPill label="Completed" val="completed" />
          <StatusPill label="Cancelled" val="cancelled" />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={flatItems}
        keyExtractor={(item, idx) =>
          item.type === 'header' ? `h-${item.title}` : `o-${item.order._id}`
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.gold.DEFAULT}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="📋" title="No orders found" subtitle="Try adjusting your filters" />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{item.title}</Text>
              </View>
            )
          }

          const o          = item.order
          const isExpanded = expanded === o._id

          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => setExpanded(isExpanded ? null : o._id)}
              activeOpacity={0.7}
            >
              <View style={styles.rowMain}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowOrderId}>{o.orderId}</Text>
                  <Text style={styles.rowName}>{o.customerName}</Text>
                </View>
                <View style={styles.rowCenter}>
                  <Text style={styles.rowItems}>{o.items?.length ?? 0} items</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowTotal}>${o.total?.toFixed(2)}</Text>
                  <StatusBadge status={o.status} />
                  <Text style={styles.rowTime}>
                    {o.placedAt ? format(parseISO(o.placedAt), 'h:mm a') : '—'}
                  </Text>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.expanded}>
                  {o.items?.map((item, i) => (
                    <Text key={i} style={styles.expItem}>
                      {item.quantity}× {item.name} — ${(item.price * item.quantity).toFixed(2)}
                    </Text>
                  ))}
                  {o.specialRequests ? (
                    <Text style={styles.expSpecial}>📝 {o.specialRequests}</Text>
                  ) : null}
                  {o.customerPhone ? (
                    <Text style={styles.expPhone}>📞 {o.customerPhone}</Text>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: theme.colors.palace.black,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             16,
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor: theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  title: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '700',
    minWidth:   130,
  },
  searchInput: {
    flex:            1,
    backgroundColor: theme.colors.palace.stone,
    color:           theme.colors.cream.DEFAULT,
    borderRadius:    6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    fontSize:        14,
  },
  filters: {
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  filterRow: {
    flexDirection: 'row',
    gap:           8,
  },
  pill: {
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderWidth:     1,
    borderColor:     theme.colors.palace.stone,
  },
  pillActive: {
    backgroundColor: theme.colors.gold.DEFAULT + '22',
    borderColor:     theme.colors.gold.DEFAULT,
  },
  pillText: {
    color:    theme.colors.cream.muted,
    fontSize: 12,
  },
  pillTextActive: {
    color: theme.colors.gold.DEFAULT,
  },
  groupHeader: {
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     6,
  },
  groupTitle: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  row: {
    backgroundColor:  theme.colors.palace.smoke,
    marginHorizontal: 12,
    marginBottom:     4,
    borderRadius:     6,
    overflow:         'hidden',
  },
  rowMain: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 12,
    paddingVertical:  10,
  },
  rowLeft: {
    flex: 1.2,
    gap:  2,
  },
  rowOrderId: {
    color:      theme.colors.gold.DEFAULT,
    fontSize:   13,
    fontWeight: '700',
  },
  rowName: {
    color:    theme.colors.cream.muted,
    fontSize: 12,
  },
  rowCenter: {
    flex: 0.6,
    alignItems: 'center',
  },
  rowItems: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 13,
  },
  rowRight: {
    flex:       1,
    alignItems: 'flex-end',
    gap:        4,
  },
  rowTotal: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   14,
    fontWeight: '600',
  },
  rowTime: {
    color:    theme.colors.cream.muted,
    fontSize: 11,
  },
  expanded: {
    paddingHorizontal: 12,
    paddingBottom:     10,
    borderTopWidth:    1,
    borderTopColor:    theme.colors.palace.stone,
    gap:               4,
    marginTop:         0,
  },
  expItem: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 13,
    opacity:  0.8,
  },
  expSpecial: {
    color:    '#F59E0B',
    fontSize: 13,
    marginTop: 4,
  },
  expPhone: {
    color:    theme.colors.gold.DEFAULT,
    fontSize: 13,
    marginTop: 2,
  },
})
