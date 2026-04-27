import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { client } from '../../lib/sanity'
import { revenueQuery } from '../../lib/queries'
import { Order, OrderItem } from '../../lib/types'
import { theme } from '../../constants/theme'
import {
  isToday, isThisWeek, isThisMonth, parseISO,
  subDays, format, startOfDay,
} from 'date-fns'
import { VictoryBar, VictoryChart, VictoryAxis, VictoryTheme } from 'victory-native'

// ── Revenue helpers ────────────────────────────────────────
function getTodayRevenue(orders: Order[]) {
  return orders.filter(o => o.placedAt && isToday(parseISO(o.placedAt)))
               .reduce((s, o) => s + (o.total ?? 0), 0)
}
function getWeekRevenue(orders: Order[]) {
  return orders.filter(o => o.placedAt && isThisWeek(parseISO(o.placedAt)))
               .reduce((s, o) => s + (o.total ?? 0), 0)
}
function getMonthRevenue(orders: Order[]) {
  return orders.filter(o => o.placedAt && isThisMonth(parseISO(o.placedAt)))
               .reduce((s, o) => s + (o.total ?? 0), 0)
}
function countOrders(orders: Order[], pred: (o: Order) => boolean) {
  return orders.filter(pred).length
}
function getDailyRevenue(orders: Order[], days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d     = startOfDay(subDays(new Date(), days - 1 - i))
    const label = format(d, 'M/d')
    const total = orders
      .filter(o => {
        if (!o.placedAt) return false
        const od = startOfDay(parseISO(o.placedAt))
        return od.getTime() === d.getTime()
      })
      .reduce((s, o) => s + (o.total ?? 0), 0)
    return { x: label, y: total }
  })
}
function getTopDishes(orders: Order[], limit: number) {
  const counts: Record<string, { count: number; revenue: number }> = {}
  for (const o of orders) {
    for (const item of (o.items ?? [])) {
      if (!counts[item.name]) counts[item.name] = { count: 0, revenue: 0 }
      counts[item.name].count   += item.quantity
      counts[item.name].revenue += item.price * item.quantity
    }
  }
  return Object.entries(counts)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
// ──────────────────────────────────────────────────────────

export default function RevenueScreen() {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.fetch<Order[]>(revenueQuery)
      .then(d => setOrders(d ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.gold.DEFAULT} />
      </View>
    )
  }

  const todayRev  = getTodayRevenue(orders)
  const weekRev   = getWeekRevenue(orders)
  const monthRev  = getMonthRevenue(orders)
  const dailyData = getDailyRevenue(orders, 7)
  const topDishes = getTopDishes(orders, 8)
  const maxCount  = topDishes[0]?.count ?? 1

  function SummaryCard({ label, revenue, count }: { label: string; revenue: number; count: number }) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardRevenue}>${revenue.toFixed(2)}</Text>
        <Text style={styles.cardCount}>{count} orders</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Revenue Dashboard</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.cardsRow}>
        <SummaryCard
          label="Today"
          revenue={todayRev}
          count={countOrders(orders, o => !!o.placedAt && isToday(parseISO(o.placedAt)))}
        />
        <SummaryCard
          label="This Week"
          revenue={weekRev}
          count={countOrders(orders, o => !!o.placedAt && isThisWeek(parseISO(o.placedAt)))}
        />
        <SummaryCard
          label="This Month"
          revenue={monthRev}
          count={countOrders(orders, o => !!o.placedAt && isThisMonth(parseISO(o.placedAt)))}
        />
      </View>

      {/* Bar chart — last 7 days */}
      <View style={styles.chartBox}>
        <Text style={styles.sectionTitle}>Daily Revenue — Last 7 Days</Text>
        <VictoryChart
          height={200}
          padding={{ top: 10, bottom: 40, left: 60, right: 20 }}
          theme={VictoryTheme.material}
        >
          <VictoryAxis
            style={{
              axis:       { stroke: theme.colors.palace.stone },
              tickLabels: { fill: theme.colors.cream.muted, fontSize: 10 },
            }}
          />
          <VictoryAxis
            dependentAxis
            style={{
              axis:       { stroke: theme.colors.palace.stone },
              tickLabels: { fill: theme.colors.cream.muted, fontSize: 10 },
              grid:       { stroke: theme.colors.palace.stone, strokeDasharray: '4' },
            }}
            tickFormat={(t) => `$${t}`}
          />
          <VictoryBar
            data={dailyData}
            style={{ data: { fill: theme.colors.gold.DEFAULT } }}
            cornerRadius={{ top: 3 }}
          />
        </VictoryChart>
      </View>

      {/* Top dishes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Best Selling Dishes</Text>
        {topDishes.map((dish, i) => (
          <View key={dish.name} style={styles.dishRow}>
            <Text style={styles.dishRank}>{i + 1}</Text>
            <View style={styles.dishInfo}>
              <Text style={styles.dishName}>{dish.name}</Text>
              <View style={styles.dishBar}>
                <View
                  style={[
                    styles.dishBarFill,
                    { width: `${(dish.count / maxCount) * 100}%` as any },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.dishCount}>{dish.count} sold</Text>
            <Text style={styles.dishRevenue}>${dish.revenue.toFixed(0)}</Text>
          </View>
        ))}
        {topDishes.length === 0 && (
          <Text style={styles.empty}>No sales data yet.</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: theme.colors.palace.black },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.palace.black },
  header:  {
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  title: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '700',
  },
  cardsRow: {
    flexDirection:   'row',
    gap:             12,
    padding:         16,
  },
  card: {
    flex:            1,
    backgroundColor: theme.colors.palace.smoke,
    borderWidth:     1,
    borderColor:     theme.colors.palace.stone,
    borderRadius:    8,
    padding:         14,
  },
  cardLabel: {
    color:         theme.colors.cream.muted,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:  8,
  },
  cardRevenue: {
    color:      theme.colors.gold.DEFAULT,
    fontSize:   28,
    fontWeight: '700',
  },
  cardCount: {
    color:    theme.colors.cream.muted,
    fontSize: 12,
    marginTop: 2,
  },
  chartBox: {
    marginHorizontal: 16,
    marginBottom:     16,
    backgroundColor:  theme.colors.palace.smoke,
    borderRadius:     8,
    borderWidth:      1,
    borderColor:      theme.colors.palace.stone,
    padding:          12,
  },
  section: {
    marginHorizontal: 16,
    marginBottom:     24,
    backgroundColor:  theme.colors.palace.smoke,
    borderRadius:     8,
    borderWidth:      1,
    borderColor:      theme.colors.palace.stone,
    padding:          12,
  },
  sectionTitle: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: 1,
    marginBottom:  12,
    textTransform: 'uppercase',
  },
  dishRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  dishRank: {
    color:      theme.colors.gold.DEFAULT,
    fontSize:   14,
    fontWeight: '700',
    width:      20,
    textAlign:  'center',
  },
  dishInfo: {
    flex: 1,
    gap:  4,
  },
  dishName: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 13,
  },
  dishBar: {
    height:          4,
    backgroundColor: theme.colors.palace.stone,
    borderRadius:    2,
    overflow:        'hidden',
  },
  dishBarFill: {
    height:          4,
    backgroundColor: theme.colors.gold.DEFAULT,
    borderRadius:    2,
  },
  dishCount: {
    color:    theme.colors.cream.muted,
    fontSize: 12,
    width:    60,
    textAlign:'right',
  },
  dishRevenue: {
    color:    theme.colors.gold.light,
    fontSize: 12,
    width:    60,
    textAlign: 'right',
  },
  empty: {
    color:    theme.colors.cream.muted,
    fontSize: 13,
    textAlign:'center',
    padding:  20,
  },
})
