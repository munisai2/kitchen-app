import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, SectionList, Switch,
  ActivityIndicator,
} from 'react-native'
import { client } from '../../lib/sanity'
import { menuItemsQuery } from '../../lib/queries'
import { MenuItem } from '../../lib/types'
import { showToast, ToastContainer } from '../../components/Toast'
import { theme } from '../../constants/theme'

export default function MenuControlScreen() {
  const [items,   setItems]   = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMenu = useCallback(async () => {
    try {
      const data = await client.fetch<MenuItem[]>(menuItemsQuery)
      setItems(data ?? [])
    } catch {
      showToast('Failed to load menu items', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  async function handleToggle(item: MenuItem, newValue: boolean) {
    // Optimistic update
    setItems(prev =>
      prev.map(i => (i._id === item._id ? { ...i, isAvailable: newValue } : i))
    )

    try {
      await client.patch(item._id).set({ isAvailable: newValue }).commit()
      showToast(
        `${item.name} marked as ${newValue ? 'available' : 'sold out'}`,
        newValue ? 'success' : 'info'
      )
    } catch {
      // Revert on error
      setItems(prev =>
        prev.map(i => (i._id === item._id ? { ...i, isAvailable: !newValue } : i))
      )
      showToast('Failed to update — check connection', 'error')
    }
  }

  // Group by category
  const grouped: { title: string; data: MenuItem[] }[] = []
  const catMap: Record<string, MenuItem[]> = {}
  for (const item of items) {
    const cat = item.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = []
    catMap[cat].push(item)
  }
  for (const [cat, data] of Object.entries(catMap)) {
    grouped.push({ title: cat, data })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.gold.DEFAULT} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Menu Control</Text>
          <Text style={styles.subtitle}>Toggle items sold out or available</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live — changes appear on website within 30s</Text>
        </View>
      </View>

      <SectionList
        sections={grouped}
        keyExtractor={item => item._id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.isAvailable && styles.rowSoldOut]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.itemName, !item.isAvailable && styles.itemNameDimmed]}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>${item.price?.toFixed(2)}</Text>
            </View>

            {!item.isAvailable && (
              <View style={styles.soldOutPill}>
                <Text style={styles.soldOutText}>SOLD OUT</Text>
              </View>
            )}

            <Switch
              value={item.isAvailable}
              onValueChange={(val) => handleToggle(item, val)}
              trackColor={{ false: theme.colors.status.new, true: theme.colors.status.ready }}
              thumbColor={theme.colors.cream.DEFAULT}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No menu items found.</Text>
        }
      />

      <ToastContainer />
    </View>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.colors.palace.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.palace.black },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor: theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  title: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '700',
  },
  subtitle: {
    color:    theme.colors.cream.muted,
    fontSize: 12,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  liveDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: theme.colors.status.ready,
  },
  liveText: {
    color:    theme.colors.cream.muted,
    fontSize: 11,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     6,
  },
  sectionTitle: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:  12,
    backgroundColor: theme.colors.palace.smoke,
    marginHorizontal: 12,
    marginBottom:     4,
    borderRadius:    6,
    gap:             10,
  },
  rowSoldOut: {
    backgroundColor: theme.colors.status.new + '12',
  },
  rowInfo: {
    flex: 1,
    gap:  2,
  },
  itemName: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 14,
  },
  itemNameDimmed: {
    opacity: 0.4,
  },
  itemPrice: {
    color:    theme.colors.gold.DEFAULT,
    fontSize: 12,
  },
  soldOutPill: {
    backgroundColor: '#EF444433',
    borderRadius:    4,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  soldOutText: {
    color:      '#EF4444',
    fontSize:   9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  empty: {
    color:    theme.colors.cream.muted,
    fontSize: 14,
    textAlign:'center',
    padding:  40,
  },
})
