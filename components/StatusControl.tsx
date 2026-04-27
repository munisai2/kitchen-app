import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { client } from '../lib/sanity'
import { restaurantInfoQuery } from '../lib/queries'
import { theme } from '../constants/theme'
import { showToast } from './Toast'
import { Order } from '../lib/types'
import { sendOrderEmail } from '../lib/notifications'
import { useRestaurantStore } from '../lib/store/restaurantStore'

type Status = 'open' | 'busy' | 'paused'

export function StatusControl({ orders, onStatusChange }: { orders: Order[], onStatusChange?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Busy Modal state
  const [showBusyModal, setShowBusyModal] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [extraMinutes, setExtraMinutes] = useState('10')
  const [busyLoading, setBusyLoading] = useState(false)

  // Derive active categories from active orders (new/preparing)
  const activeOrders = orders.filter(o => ['new', 'preparing'].includes(o.status))
  const categoryCounts: Record<string, number> = {}
  activeOrders.forEach(o => {
    o.items?.forEach(item => {
      // Note: We don't have item.category in the order itself usually, 
      // but the prompt implies we can group them. 
      // If category isn't in order.items, we might need to fallback.
      // Assuming 'item.category' or a placeholder.
      const cat = (item as any).category || 'General'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    })
  })
  const categories = Object.keys(categoryCounts).sort()

  const affectedOrdersCount = activeOrders.filter(o => 
    o.items?.some(item => selectedCategories.includes((item as any).category || 'General'))
  ).length

  useEffect(() => {
    // Initial fetch + listener for real-time updates
    client.fetch(restaurantInfoQuery).then(data => {
      if (data) {
        setStatus(data.restaurantStatus || 'open')
        setDocId(data._id)
      }
    })

    const sub = client.listen(restaurantInfoQuery).subscribe(update => {
      if (update.result) {
        setStatus(update.result.restaurantStatus as Status)
      }
    })

    return () => sub.unsubscribe()
  }, [])

  async function changeStatus(newStatus: Status) {
    if (!docId || newStatus === status) return

    if (newStatus === 'busy') {
      setShowBusyModal(true)
      setSelectedCategories(categories) // Default all checked
      return
    }

    const labels: Record<Status, string> = {
      open: 'OPEN',
      busy: 'BUSY',
      paused: 'PAUSED',
    }

    const messages: Record<Status, string> = {
      open: 'Accepting orders normally.',
      busy: '', 
      paused: 'Completely stops online ordering.',
    }

    Alert.alert(
      `Change status to ${labels[newStatus]}?`,
      messages[newStatus],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setLoading(true)
              await client.patch(docId).set({ restaurantStatus: newStatus }).commit()
              setStatus(newStatus)
              showToast(`Status updated to ${labels[newStatus]}`, 'success')
            } catch (err) {
              showToast('Failed to update status', 'error')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  async function handleApplyBusy() {
    if (!docId) return
    try {
      setBusyLoading(true)
      const extra = parseInt(extraMinutes) || 0
      
      // 1. Find orders to update
      const ordersToUpdate = activeOrders.filter(o => 
        o.items?.some(item => selectedCategories.includes((item as any).category || 'General'))
      )

      // 2. Patch each order + Send email
      await Promise.all(ordersToUpdate.map(async (order) => {
        const currentEst = order.estimatedTime || 30
        const newEst = currentEst + extra
        
        await client.patch(order._id).set({
          estimatedTime: newEst,
          busyTimeAdded: extra
        }).commit()

        await sendOrderEmail({
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          type: 'adjusted_time',
          data: {
            orderId: order.orderId,
            customerName: order.customerName,
            estimatedTime: newEst,
            logoUrl: useRestaurantStore.getState().logoUrl,
          }
        })
      }))

      // 3. Update restaurant status
      await client.patch(docId).set({ restaurantStatus: 'busy' }).commit()
      setStatus('busy')
      
      showToast(`Status set to Busy. ${ordersToUpdate.length} customers notified.`, 'success')
      setShowBusyModal(false)
    } catch (err) {
      showToast('Failed to update Busy status', 'error')
    } finally {
      setBusyLoading(false)
    }
  }

  if (!status) return null

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <StatusButton
          label="🟢 OPEN"
          active={status === 'open'}
          activeColor="#16A34A"
          onPress={() => changeStatus('open')}
        />
        <StatusButton
          label="🟡 BUSY"
          active={status === 'busy'}
          activeColor="#F59E0B"
          onPress={() => changeStatus('busy')}
        />
        <StatusButton
          label="🔴 PAUSED"
          active={status === 'paused'}
          activeColor="#DC2626"
          onPress={() => changeStatus('paused')}
        />
        {loading && <ActivityIndicator style={styles.loader} color={theme.colors.gold.DEFAULT} size="small" />}
      </View>

      {/* Busy Modal */}
      <Modal visible={showBusyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🟡 Mark as Busy</Text>
            <Text style={styles.modalSub}>Add extra preparation time to current active orders?</Text>

            <ScrollView style={styles.catList}>
              {categories.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={styles.catItem}
                  onPress={() => {
                    setSelectedCategories(prev => 
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )
                  }}
                >
                  <View style={[styles.checkbox, selectedCategories.includes(cat) && styles.checkboxChecked]}>
                    {selectedCategories.includes(cat) && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.catName}>{cat}</Text>
                  <Text style={styles.catCount}>({categoryCounts[cat]} active)</Text>
                </TouchableOpacity>
              ))}
              {categories.length === 0 && <Text style={styles.emptyText}>No active orders by category</Text>}
            </ScrollView>

            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Extra minutes to add:</Text>
              <TextInput 
                style={styles.timeInput}
                keyboardType="numeric"
                value={extraMinutes}
                onChangeText={setExtraMinutes}
              />
              <View style={styles.pills}>
                {['5','10','15','20','30'].map(p => (
                  <TouchableOpacity key={p} style={styles.pill} onPress={() => setExtraMinutes(p)}>
                    <Text style={styles.pillText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.previewText}>
              Will add {extraMinutes} min to {affectedOrdersCount} orders and notify customers by email
            </Text>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBusyModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyBtn} 
                onPress={handleApplyBusy}
                disabled={busyLoading}
              >
                {busyLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.applyBtnText}>Apply & Notify Customers</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function StatusButton({ label, active, activeColor, onPress }: {
  label: string, active: boolean, activeColor: string, onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.btn,
        active ? { backgroundColor: activeColor } : styles.btnInactive
      ]}
      activeOpacity={0.7}
    >
      <Text style={[styles.btnText, active ? styles.btnTextActive : { color: activeColor + '88' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.palace.black,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  container: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 110,
    alignItems: 'center',
  },
  btnInactive: {
    backgroundColor: theme.colors.palace.stone,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  btnTextActive: {
    color: '#FFFFFF',
  },
  loader: {
    marginLeft: 10,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: theme.colors.palace.black, width: '100%', maxWidth: 500, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: theme.colors.palace.stone },
  modalTitle: { color: theme.colors.gold.DEFAULT, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  modalSub: { color: theme.colors.cream.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  
  catList: { maxHeight: 200, marginVertical: 10 },
  catItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.colors.gold.muted, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: theme.colors.gold.DEFAULT, borderColor: theme.colors.gold.DEFAULT },
  checkMark: { color: '#000', fontSize: 14, fontWeight: '900' },
  catName: { color: theme.colors.cream.DEFAULT, fontSize: 15, fontWeight: '600', flex: 1 },
  catCount: { color: theme.colors.cream.muted, fontSize: 13 },
  emptyText: { color: theme.colors.cream.muted, textAlign: 'center', padding: 20 },

  timeSection: { marginVertical: 20 },
  timeLabel: { color: theme.colors.cream.muted, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  timeInput: { backgroundColor: theme.colors.palace.smoke, color: '#FFF', fontSize: 24, fontWeight: '900', padding: 12, borderRadius: 8, textAlign: 'center', borderWidth: 1, borderColor: theme.colors.palace.stone },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'center' },
  pill: { backgroundColor: theme.colors.palace.stone, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  pillText: { color: theme.colors.gold.DEFAULT, fontWeight: '800' },

  previewText: { color: theme.colors.gold.muted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginBottom: 20 },

  modalFooter: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.palace.stone, alignItems: 'center' },
  cancelBtnText: { color: theme.colors.cream.muted, fontWeight: '700' },
  applyBtn: { flex: 1.5, backgroundColor: theme.colors.gold.DEFAULT, paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  applyBtnText: { color: '#000', fontWeight: '900' },
})
