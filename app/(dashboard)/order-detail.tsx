import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Linking, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Order } from '../../lib/types'
import { theme } from '../../constants/theme'
import { StatusBadge } from '../../components/StatusBadge'
import { format, parseISO } from 'date-fns'
import { AdjustmentSheets } from '../../components/AdjustmentSheets'
import { client } from '../../lib/sanity'
import { showToast, ToastContainer } from '../../components/Toast'
import { useOrders } from '../../hooks/useOrders'

const NEXT_STATUS: Record<string, Order['status']> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'completed',
}

const STATUS_COLOR: Record<string, string> = {
  new:       '#EF4444', // Red
  preparing: '#2563EB', // blue
  ready:     '#16A34A', // green
}

// Global cache to persist "draft" adjustments while navigating
const draftAdjustmentsCache: Record<string, Record<number, { delta: number; reason: string }>> = {}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const { orders, updateOrderStatus } = useOrders()

  const order = orders.find(o => o._id === params.id) ?? null

  const [adjustType, setAdjustType] = useState<'time' | 'cancel' | null>(null)
  const [kitchenMsg, setKitchenMsg] = useState('')
  const [tempTime, setTempTime] = useState(30)
  const [savingTime, setSavingTime] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [specialAdj, setSpecialAdj] = useState(0)

  // Per-item price adjustment state
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null)
  const [itemDeltas, setItemDeltas] = useState<Record<number, { delta: number; reason: string }>>({})
  const [itemDeltaTemp, setItemDeltaTemp] = useState(0)
  const [itemReasonTemp, setItemReasonTemp] = useState('')

  useEffect(() => {
    if (order) {
      setTempTime(order.estimatedTime || 30)
      setKitchenMsg(order.kitchenMessage || '')
      // Load from cache or reset
      setActiveItemIdx(null)
      setItemDeltas(draftAdjustmentsCache[order._id] || {})
      setItemDeltaTemp(0)
      setItemReasonTemp('')
    }
  }, [order?._id])

  // Sync deltas to cache whenever they change
  useEffect(() => {
    if (order?._id) {
      draftAdjustmentsCache[order._id] = itemDeltas
    }
  }, [itemDeltas, order?._id])

  if (!order) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.notFound}>
            <Text style={styles.notFoundText}>Order not found or already completed.</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back to Kitchen</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const nextStatus = NEXT_STATUS[order.status]

  async function handleAdjustTime(delta: number) {
    const newTime = Math.max(5, Math.min(180, tempTime + delta))
    setTempTime(newTime)
    try {
      setSavingTime(true)
      await client.patch(order!._id).set({ estimatedTime: newTime }).commit()
    } catch {
      showToast('Failed to sync time', 'error')
    } finally {
      setSavingTime(false)
    }
  }

  async function handleCancelOrder() {
    try {
      setConfirmLoading(true)
      // Send cancellation email before status change
      if (order) {
        await updateOrderStatus(order._id, 'cancelled', kitchenMsg, {
          reason: kitchenMsg || 'Order cancelled by restaurant',
          items: order.items,
          total: order.total
        })
      }
      router.back()
    } catch (err) {
      console.error('[cancel] Failed:', err)
      showToast('Failed to cancel order', 'error')
    } finally {
      setConfirmLoading(false)
    }
  }

  function safeBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/(dashboard)/kitchen' as any)
  }

  function openItemAdjust(idx: number) {
    const existing = itemDeltas[idx]
    setItemDeltaTemp(existing?.delta ?? 0)
    setItemReasonTemp(existing?.reason ?? '')
    setActiveItemIdx(idx)
  }

  function saveItemAdjust() {
    if (activeItemIdx === null) return
    if (itemDeltaTemp !== 0) {
      setItemDeltas(prev => ({ ...prev, [activeItemIdx]: { delta: itemDeltaTemp, reason: itemReasonTemp } }))
    } else {
      // Remove adjustment if delta = 0
      setItemDeltas(prev => { const n = { ...prev }; delete n[activeItemIdx]; return n })
    }
    setActiveItemIdx(null)
  }

  async function handleMainAction() {
    if (!nextStatus) return
    try {
      setConfirmLoading(true)
      
      const isDineIn = order?.orderType === 'dine-in'
      let statusToSet = nextStatus
      if ((order?.orderType === 'dine-in' || order?.orderType === 'reservation') && order?.status === 'preparing') {
        statusToSet = 'completed'
      }

      // Apply item price adjustments before confirming/marking ready
      if ((Object.keys(itemDeltas).length > 0 || specialAdj !== 0) && (order?.status === 'new' || order?.status === 'preparing')) {
        const adjustedItems = order!.items.map((item, i) => {
          const adj = itemDeltas[i]
          return adj ? { ...item, price: Math.max(0, item.price + adj.delta / item.quantity) } : item
        })
        const totalDelta = Object.values(itemDeltas).reduce((s, a) => s + a.delta, 0) + specialAdj
        const originalSubtotal = order!.subtotal || 0
        const newSubtotal = Math.max(0, originalSubtotal + totalDelta)
        
        // Conditional Promo Logic
        const originalPromo = order!.promoDiscount || 0
        const isBogo = order!.promoCode?.toUpperCase().includes('BOGO')
        let newPromo = originalPromo

        if (!isBogo && originalSubtotal > 0) {
          const promoRatio = originalPromo / originalSubtotal
          newPromo = parseFloat((newSubtotal * promoRatio).toFixed(2))
        }
        
        // New Logic: Tax on (Subtotal - Promo)
        const discountedSubtotal = Math.max(0, newSubtotal - newPromo)
        const newTax = parseFloat((discountedSubtotal * 0.08).toFixed(2))
        const newTotal = parseFloat((discountedSubtotal + newTax).toFixed(2))
        
        const reasons = Object.values(itemDeltas).map(a => a.reason).filter(Boolean).join('; ')

        await client.patch(order!._id).set({
          items: adjustedItems.map((item, i) => ({
            _type: 'orderItem',
            _key: `item-${i}`,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          promoDiscount: newPromo,
          discountAmount: totalDelta !== 0 ? -totalDelta : undefined,
          adjustmentReason: reasons || kitchenMsg || 'Price adjusted by kitchen staff',
        }).commit()
        
        // Clear local state and cache immediately to prevent doubling
        setItemDeltas({})
        setSpecialAdj(0)
        delete draftAdjustmentsCache[order!._id]

        // Pass overrides to updateOrderStatus for email notification
        await updateOrderStatus(order!._id, statusToSet, kitchenMsg, {
          items: adjustedItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          promoDiscount: newPromo,
          discountAmount: totalDelta !== 0 ? -totalDelta : undefined,
          adjustmentReason: reasons || kitchenMsg || 'Price adjusted by kitchen staff'
        })
      } else {
        await updateOrderStatus(order!._id, statusToSet, kitchenMsg)
      }
      
      const labels: Record<string, string> = {
        preparing: 'Order confirmed — now preparing!',
        ready:     'Order marked as ready!',
        completed: isDineIn ? 'Order served and completed!' : 'Order completed ✓',
      }
      showToast(labels[statusToSet] ?? 'Status updated', 'success')
      safeBack()
    } catch {
      showToast('Failed to update order — check connection', 'error')
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack} style={styles.backArrow}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>

          <View style={styles.orderInfo}>
            <Text style={styles.orderIdText}>{order.orderId}</Text>
            <Text style={styles.customerNameTitle}>{order.customerName}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.timeControl}>
              <Text style={styles.timeLabel}>READY IN</Text>
              <View style={styles.timeCounter}>
                <TouchableOpacity onPress={() => handleAdjustTime(-5)} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>−5</Text>
                </TouchableOpacity>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValue}>{tempTime}</Text>
                  <Text style={styles.timeUnit}>m</Text>
                </View>
                <TouchableOpacity onPress={() => handleAdjustTime(5)} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>+5</Text>
                </TouchableOpacity>
              </View>
              {savingTime && <ActivityIndicator size="small" color={theme.colors.gold.DEFAULT} />}
            </View>
            <StatusBadge status={order.status} />
          </View>
        </View>

        {/* ── MAIN CONTENT ── */}
        <View style={styles.mainArea}>

          {/* Left Panel: Items + Cancel Footer */}
          <View style={styles.leftPanel}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.itemList} showsVerticalScrollIndicator={false}>
              <View style={styles.leftPanelHeader}>
                <Text style={styles.panelTitle}>ORDER ITEMS</Text>
              </View>

              {order.items?.map((item, i) => {
                const adj = itemDeltas[i]
                const adjTotal = adj ? Math.max(0, item.price * item.quantity + adj.delta) : item.price * item.quantity
                const isOpen = activeItemIdx === i
                const isIncrease = adj && adj.delta > 0
                const isDecrease = adj && adj.delta < 0

                return (
                  <View key={i}>
                    <TouchableOpacity
                      style={[styles.itemCard, adj && { borderColor: isDecrease ? '#4ADE80' : '#EF4444' }]}
                      onPress={() => isOpen ? setActiveItemIdx(null) : openItemAdjust(i)}
                    >
                      <View style={styles.itemMain}>
                        <View style={styles.qtyBox}>
                          <Text style={styles.qtyText}>{item.quantity}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {adj && (
                            <Text style={{ color: isDecrease ? '#4ADE80' : '#EF4444', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                              {isDecrease ? 'DISCOUNTED' : 'ADD-ON'} {isDecrease ? '' : '+'}${Math.abs(adj.delta).toFixed(2)}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.itemPrice, adj && { textDecorationLine: 'line-through', opacity: 0.4, fontSize: 12 }]}>
                            ${(item.price * item.quantity).toFixed(2)}
                          </Text>
                          {adj && <Text style={{ color: isDecrease ? '#4ADE80' : '#EF4444', fontWeight: '800', fontSize: 15 }}>${adjTotal.toFixed(2)}</Text>}
                        </View>
                      </View>
                      {!isOpen && <Text style={styles.tapToEdit}>{adj ? `✓ Adjusted${adj.reason ? ` — ${adj.reason}` : ''}` : 'Tap to adjust price'}</Text>}
                    </TouchableOpacity>

                    {/* Inline popup card */}
                    {isOpen && (
                      <View style={styles.itemAdjustCard}>
                        <Text style={styles.itemAdjustTitle}>ADJUST: {item.name}</Text>
                        <View style={styles.itemAdjustStepper}>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => setItemDeltaTemp(d => parseFloat((d - 0.5).toFixed(2)))}>
                            <Text style={styles.stepBtnText}>−</Text>
                          </TouchableOpacity>
                          <View style={{ alignItems: 'center', flex: 1 }}>
                            <TextInput
                              style={[styles.stepValue, { color: itemDeltaTemp < 0 ? '#4ADE80' : itemDeltaTemp > 0 ? '#EF4444' : theme.colors.gold.DEFAULT, width: '100%', textAlign: 'center' }]}
                              keyboardType="numeric"
                              value={Math.abs(itemDeltaTemp).toFixed(2)}
                              onChangeText={(val) => {
                                const cents = parseInt(val.replace(/[^0-9]/g, '')) || 0
                                const sign = itemDeltaTemp < 0 ? -1 : 1
                                setItemDeltaTemp((cents / 100) * sign)
                              }}
                            />
                            <Text style={{ color: theme.colors.cream.muted, fontSize: 11 }}>Add/Sub: ${itemDeltaTemp.toFixed(2)}</Text>
                          </View>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => setItemDeltaTemp(d => parseFloat((d + 0.5).toFixed(2)))}>
                            <Text style={styles.stepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={styles.itemAdjustReason}
                          placeholder="Reason (optional)"
                          placeholderTextColor={theme.colors.cream.muted}
                          value={itemReasonTemp}
                          onChangeText={setItemReasonTemp}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[styles.itemAdjustBtn, { flex: 1, backgroundColor: theme.colors.palace.stone }]} onPress={() => setActiveItemIdx(null)}>
                            <Text style={{ color: theme.colors.cream.muted, fontWeight: '700', fontSize: 13 }}>CANCEL</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.itemAdjustBtn, { flex: 2 }]} onPress={saveItemAdjust}>
                            <Text style={{ color: theme.colors.palace.black, fontWeight: '900', fontSize: 13 }}>APPLY</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}

              {order.specialRequests ? (
                <View style={styles.specialBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specialTitle}>⚠️ SPECIAL REQUESTS</Text>
                    <Text style={styles.specialText}>{order.specialRequests}</Text>
                  </View>
                  {(order.status === 'new' || order.status === 'preparing') && (
                    <View style={styles.specialStepper}>
                      <TouchableOpacity style={styles.miniStepBtn} onPress={() => setSpecialAdj(s => parseFloat((s - 0.5).toFixed(2)))}>
                        <Text style={styles.miniStepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.miniStepVal, { color: specialAdj < 0 ? '#4ADE80' : specialAdj > 0 ? '#EF4444' : theme.colors.cream.DEFAULT }]}
                        keyboardType="numeric"
                        value={Math.abs(specialAdj).toFixed(2)}
                        onChangeText={(val) => {
                          const cents = parseInt(val.replace(/[^0-9]/g, '')) || 0
                          const sign = specialAdj < 0 ? -1 : 1
                          setSpecialAdj((cents / 100) * sign)
                        }}
                        selectTextOnFocus
                      />
                      <TouchableOpacity style={styles.miniStepBtn} onPress={() => setSpecialAdj(s => parseFloat((s + 0.5).toFixed(2)))}>
                        <Text style={styles.miniStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>

            {/* X Cancel Button at bottom of left column */}
            <View style={styles.leftPanelFooter}>
              <TouchableOpacity
                style={styles.cancelCircle}
                onPress={() => setAdjustType('cancel')}
              >
                <Text style={styles.cancelCircleText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.cancelLabel}>Cancel Order</Text>
            </View>
          </View>

          {/* Right Panel: scroll content + pinned footer */}
          <View style={styles.rightPanel}>

            {/* Scrollable content */}
            <ScrollView
              style={styles.rightScroll}
              contentContainerStyle={styles.rightScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Customer Info */}
              <View style={styles.summaryCard}>
                <Text style={styles.cardLabel}>CUSTOMER</Text>
                
                {order.orderType === 'dine-in' && order.tableNumber && (
                  <View style={styles.tableHero}>
                    <Text style={styles.tableHeroText}>🍽️ TABLE {order.tableNumber}</Text>
                  </View>
                )}
                {order.orderType === 'reservation' && (
                  <View style={[styles.tableHero, { backgroundColor: 'rgba(88, 28, 135, 0.3)', borderColor: '#D8B4FE' }]}>
                    <Text style={[styles.tableHeroText, { color: '#D8B4FE' }]}>
                      🍽️ {order.tableNumber ? `TABLE ${order.tableNumber}` : 'NO TABLE ASSIGNED'}
                    </Text>
                    <Text style={{ color: '#E9D5FF', fontSize: 14, marginTop: 4, fontWeight: '600', textAlign: 'center' }}>
                      {order.guestCount || 1} guests • {order.reservationTime ? format(parseISO(order.reservationTime), 'MMM d, h:mm a') : 'Unknown Time'}
                    </Text>
                  </View>
                )}

                <Text style={styles.customerName}>{order.customerName}</Text>
                {order.customerPhone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={styles.phoneRow}>
                    <Text style={styles.phoneIcon}>📞</Text>
                    <Text style={styles.phoneText}>{order.customerPhone}</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={[
                  styles.typeTag, 
                  order.orderType === 'dine-in' && { backgroundColor: '#2563EB' },
                  order.orderType === 'reservation' && { backgroundColor: '#7E22CE' }
                ]}>
                  <Text style={styles.typeText}>{order.orderType?.toUpperCase() || 'PICKUP'}</Text>
                </View>
              </View>

              {/* Payment */}
              {(() => {
                const totalDelta = Object.values(itemDeltas).reduce((s, a) => s + a.delta, 0) + specialAdj
                const promo = order.promoDiscount || 0
                
                // For confirmed orders, discountAmount in Sanity represents the historical delta
                const historicalDelta = order.status !== 'new' ? -(order.discountAmount || 0) : 0
                const currentDelta = totalDelta || historicalDelta
                
                const originalSubtotal = (order.status === 'new' || !order.discountAmount) ? (order.subtotal || 0) : (order.subtotal || 0) - historicalDelta
                const projectedSubtotal = Math.max(0, originalSubtotal + currentDelta)
                
                // Fixed Promo Calculation: We must NOT double-recalculate if the promo was already adjusted in Sanity
                // If status is not 'new', order.promoDiscount IS the already-adjusted promo.
                const originalPromo = (order.status === 'new') ? (order.promoDiscount || 0) : (order.promoDiscount || 0)
                const isBogo = order.promoCode?.toUpperCase().includes('BOGO')
                
                let dynamicPromo = originalPromo
                if (!isBogo && originalSubtotal > 0 && order.status === 'new') {
                  // Only recalculate ratio against original subtotal when in 'new'
                  const promoRatio = originalPromo / originalSubtotal
                  dynamicPromo = parseFloat((projectedSubtotal * promoRatio).toFixed(2))
                } else if (!isBogo && order.status !== 'new' && totalDelta !== 0) {
                  // If in Preparing/Ready and we have a NEW local delta, scale from the CURRENT promo/subtotal
                  const promoRatio = (order.promoDiscount || 0) / (order.subtotal || 1)
                  dynamicPromo = parseFloat((projectedSubtotal * promoRatio).toFixed(2))
                }
                
                const discountedSubtotal = Math.max(0, projectedSubtotal - dynamicPromo)
                const projectedTax = parseFloat((discountedSubtotal * 0.08).toFixed(2))
                const projectedTotal = parseFloat((discountedSubtotal + projectedTax).toFixed(2))

                return (
                  <View style={styles.summaryCard}>
                    <Text style={styles.cardLabel}>PAYMENT SUMMARY</Text>
                    
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Original Subtotal</Text>
                      <Text style={styles.priceVal}>${originalSubtotal.toFixed(2)}</Text>
                    </View>

                    {currentDelta !== 0 && (
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: currentDelta < 0 ? '#4ADE80' : '#EF4444' }]}>
                          Kitchen Adjustment
                        </Text>
                        <Text style={[styles.priceVal, { color: currentDelta < 0 ? '#4ADE80' : '#EF4444' }]}>
                          ({currentDelta < 0 ? '−' : '+'}$${Math.abs(currentDelta).toFixed(2)})
                        </Text>
                      </View>
                    )}

                    {dynamicPromo > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: '#4ADE80' }]}>Promo ({order.promoCode})</Text>
                        <Text style={[styles.priceVal, { color: '#4ADE80' }]}>−${dynamicPromo.toFixed(2)}</Text>
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Tax (8% of ${discountedSubtotal.toFixed(2)})</Text>
                      <Text style={styles.priceVal}>${projectedTax.toFixed(2)}</Text>
                    </View>

                    <View style={[styles.priceRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>FINAL TOTAL</Text>
                      <Text style={styles.totalVal}>${projectedTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                )
              })()}

              {/* Message */}
              <View style={styles.messageBox}>
                <Text style={styles.cardLabel}>MESSAGE TO CUSTOMER</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="e.g. Ready in 15 mins!"
                  placeholderTextColor={theme.colors.cream.muted}
                  multiline
                  value={kitchenMsg}
                  onChangeText={setKitchenMsg}
                />
                <Text style={styles.msgHint}>Saved when you confirm or cancel.</Text>
              </View>
            </ScrollView>

            {/* Pinned footer — confirm only */}
            <View style={styles.rightFooter}>
              {nextStatus && (
                <TouchableOpacity
                  onPress={handleMainAction}
                  disabled={confirmLoading}
                  style={[
                    styles.confirmBtn, 
                    { backgroundColor: STATUS_COLOR[order.status] ?? '#DC2626' },
                    ((order.orderType === 'dine-in' || order.orderType === 'reservation') && order.status === 'preparing') && { backgroundColor: '#16A34A' }
                  ]}
                >
                  {confirmLoading
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.confirmBtnText}>
                        {order.status === 'new' ? 'CONFIRM ORDER' : ((order.orderType === 'dine-in' || order.orderType === 'reservation') && order.status === 'preparing') ? 'SERVE ORDER 🍽️' : order.status === 'preparing' ? 'MARK AS READY' : 'COMPLETE ORDER'} ✓
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>

      <AdjustmentSheets
        type={adjustType}
        order={order}
        updateOrderStatus={updateOrderStatus}
        onClose={() => setAdjustType(null)}
        onSuccess={() => {
          setAdjustType(null)
          safeBack()
        }}
      />
      <ToastContainer />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.palace.black },
  safe: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  notFoundText: { color: theme.colors.cream.muted, fontSize: 16 },
  backBtn: { padding: 14, backgroundColor: theme.colors.palace.stone, borderRadius: 8 },
  backBtnText: { color: theme.colors.gold.DEFAULT, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  backArrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.palace.stone,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrowText: { color: theme.colors.gold.DEFAULT, fontSize: 22, fontWeight: '700' },
  orderInfo: { flex: 1, paddingLeft: 16 },
  orderIdText: { color: theme.colors.gold.DEFAULT, fontSize: 12, fontWeight: '700', opacity: 0.8 },
  customerNameTitle: { color: theme.colors.cream.DEFAULT, fontSize: 22, fontWeight: '800' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  timeControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeLabel: { color: theme.colors.gold.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  timeCounter: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.palace.stone, borderRadius: 30, padding: 4 },
  timeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.palace.black, alignItems: 'center', justifyContent: 'center' },
  timeBtnText: { color: theme.colors.gold.DEFAULT, fontSize: 14, fontWeight: '800' },
  timeValueBox: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 4 },
  timeValue: { color: theme.colors.cream.DEFAULT, fontSize: 20, fontWeight: '900' },
  timeUnit: { color: theme.colors.cream.muted, fontSize: 11, marginLeft: 2 },

  // Main
  mainArea: { flex: 1, flexDirection: 'row' },

  // Left panel
  leftPanel: { flex: 0.6, borderRightWidth: 1, borderRightColor: theme.colors.palace.stone, flexDirection: 'column' },
  itemList: { padding: 20, paddingBottom: 20 },
  leftPanelHeader: { marginBottom: 16 },
  panelTitle: { color: theme.colors.cream.muted, fontSize: 11, fontWeight: '800', letterSpacing: 2, opacity: 0.6 },
  
  leftPanelFooter: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.palace.stone,
    backgroundColor: theme.colors.palace.smoke,
  },
  cancelCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#DC262622',
    borderWidth: 2, borderColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelCircleText: { color: '#DC2626', fontSize: 20, fontWeight: '900' },
  cancelLabel: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  itemCard: {
    backgroundColor: theme.colors.palace.smoke, borderRadius: 10,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.palace.stone,
  },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniStepBtnText: {
    color: '#C9A84C',
    fontSize: 18,
    fontWeight: '700',
  },
  miniStepVal: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
    padding: 0,
  },
  specialStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
  },
  miniStepBtn: {
    padding: 5,
  },
  qtyBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.gold.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: theme.colors.palace.black, fontSize: 16, fontWeight: '900' },
  itemName: { flex: 1, color: theme.colors.cream.DEFAULT, fontSize: 18, fontWeight: '600' },
  itemPrice: { color: theme.colors.cream.muted, fontSize: 15 },
  tapToEdit: { color: theme.colors.gold.muted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  // Per-item adjust card
  itemAdjustCard: {
    backgroundColor: theme.colors.palace.smoke,
    borderRadius: 10, borderWidth: 1,
    borderColor: theme.colors.gold.DEFAULT,
    padding: 14, marginBottom: 12, gap: 12,
  },
  itemAdjustTitle: { color: theme.colors.gold.DEFAULT, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  itemAdjustStepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.palace.black,
    borderRadius: 8, padding: 8, gap: 8,
  },
  stepBtn: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: theme.colors.palace.stone,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: theme.colors.cream.DEFAULT, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  stepValue: { fontSize: 22, fontWeight: '900', color: theme.colors.gold.DEFAULT },
  itemAdjustReason: {
    backgroundColor: theme.colors.palace.black, color: theme.colors.cream.DEFAULT,
    borderRadius: 8, padding: 10, fontSize: 13,
    borderWidth: 1, borderColor: theme.colors.palace.stone,
  },
  itemAdjustBtn: {
    backgroundColor: theme.colors.gold.DEFAULT,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  specialBox: { backgroundColor: '#F59E0B15', borderRadius: 10, padding: 16, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  specialTitle: { color: '#F59E0B', fontSize: 13, fontWeight: '900', marginBottom: 6 },
  specialText: { color: '#FEF3C7', fontSize: 18, fontWeight: '600', lineHeight: 26 },

  // Right panel — flex column with scroll + pinned footer
  rightPanel: { flex: 0.4, backgroundColor: theme.colors.palace.black, flexDirection: 'column' },
  rightScroll: { flex: 1 },
  rightScrollContent: { padding: 16, gap: 12, paddingBottom: 8 },
  summaryCard: { backgroundColor: theme.colors.palace.smoke, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: theme.colors.palace.stone },
  cardLabel: { color: theme.colors.gold.DEFAULT, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  customerName: { color: theme.colors.cream.DEFAULT, fontSize: 20, fontWeight: '900' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneIcon: { fontSize: 16 },
  phoneText: { color: theme.colors.gold.DEFAULT, fontSize: 15, fontWeight: '700' },
  typeTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.colors.palace.stone },
  typeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { color: theme.colors.cream.muted, fontSize: 13 },
  priceVal: { color: theme.colors.cream.DEFAULT, fontSize: 13, fontWeight: '600' },
  totalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.palace.stone },
  totalLabel: { color: theme.colors.cream.DEFAULT, fontSize: 16, fontWeight: '800' },
  totalVal: { color: theme.colors.gold.DEFAULT, fontSize: 24, fontWeight: '900' },

  tableHero: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  tableHeroText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  
  messageBox: { backgroundColor: theme.colors.palace.smoke, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: theme.colors.palace.stone },
  messageInput: {
    backgroundColor: theme.colors.palace.black, color: theme.colors.cream.DEFAULT,
    borderRadius: 8, padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: 'top',
    borderWidth: 1, borderColor: theme.colors.palace.stone,
  },

  msgHint: { color: theme.colors.cream.muted, fontSize: 10, fontStyle: 'italic' },

  // Right footer — always pinned at bottom
  rightFooter: { padding: 16, paddingTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.palace.stone },
  issueBtn: { paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.palace.stone, alignItems: 'center' },
  issueBtnText: { color: theme.colors.cream.muted, fontSize: 13, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#DC2626', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
})
