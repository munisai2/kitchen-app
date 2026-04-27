import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Linking, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Order } from '../lib/types'
import { theme } from '../constants/theme'
import { StatusBadge } from './StatusBadge'
import { format, parseISO } from 'date-fns'
import { AdjustmentSheets } from './AdjustmentSheets'
import { client } from '../lib/sanity'
import { showToast } from './Toast'

interface OrderDetailModalProps {
  order: Order | null
  visible: boolean
  onClose: () => void
  onStatusUpdate: (id: string, status: Order['status'], message?: string) => void
}

const NEXT_STATUS: Record<string, Order['status']> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'completed',
}

export function OrderDetailModal({ order, visible, onClose, onStatusUpdate }: OrderDetailModalProps) {
  const [adjustType, setAdjustType] = useState<'time' | 'cancel' | null>(null)
  const [kitchenMsg, setKitchenMsg] = useState('')
  const [tempTime, setTempTime] = useState(30)
  const [savingTime, setSavingTime] = useState(false)

  useEffect(() => {
    if (order) {
      setTempTime(order.estimatedTime || 30)
      setKitchenMsg(order.kitchenMessage || '')
    }
  }, [order])

  if (!order) return null

  const nextStatus = NEXT_STATUS[order.status]

  async function handleAdjustTime(delta: number) {
    const newTime = Math.max(5, Math.min(180, tempTime + delta))
    setTempTime(newTime)
    try {
      setSavingTime(true)
      await client.patch(order!._id).set({ estimatedTime: newTime }).commit()
    } catch (err) {
      showToast('Failed to sync time', 'error')
    } finally {
      setSavingTime(false)
    }
  }

  function handleCall() {
    if (order?.customerPhone) {
      Linking.openURL(`tel:${order.customerPhone}`)
    }
  }

  function handleMainAction() {
    if (nextStatus) {
      onStatusUpdate(order!._id, nextStatus, kitchenMsg)
      onClose()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* ── HEADER ────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
              <View style={styles.orderInfo}>
                <Text style={styles.orderIdText}>{order.orderId}</Text>
                <Text style={styles.customerNameTitle}>{order.customerName}</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.timeControl}>
                <Text style={styles.timeLabel}>READY IN</Text>
                <View style={styles.timeCounter}>
                  <TouchableOpacity onPress={() => handleAdjustTime(-5)} style={styles.timeBtn}>
                    <Text style={styles.timeBtnText}>-5</Text>
                  </TouchableOpacity>
                  <View style={styles.timeValueBox}>
                    <Text style={styles.timeValue}>{tempTime}</Text>
                    <Text style={styles.timeUnit}>m</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleAdjustTime(5)} style={styles.timeBtn}>
                    <Text style={styles.timeBtnText}>+5</Text>
                  </TouchableOpacity>
                </View>
                {savingTime && <ActivityIndicator size="small" color={theme.colors.gold.DEFAULT} style={styles.timeLoader} />}
              </View>
              <StatusBadge status={order.status} />
            </View>
          </View>

          {/* ── MAIN CONTENT ──────────────────────────────────── */}
          <View style={styles.mainArea}>
            {/* Left Panel: Items */}
            <View style={styles.leftPanel}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.itemList}>
                <Text style={styles.panelTitle}>ORDER ITEMS</Text>
                {order.items?.map((item, i) => (
                  <View key={i} style={styles.itemCard}>
                    <View style={styles.itemMain}>
                      <View style={styles.qtyBox}>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                      </View>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                  </View>
                ))}

                {order.specialRequests ? (
                  <View style={styles.specialBox}>
                    <Text style={styles.specialTitle}>⚠️ SPECIAL REQUESTS</Text>
                    <Text style={styles.specialText}>{order.specialRequests}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>

            {/* Right Panel: Info & Messaging */}
            <View style={styles.rightPanel}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightScroll}>
                  
                  {/* Customer Card */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.cardLabel}>CUSTOMER INFO</Text>
                    <Text style={styles.customerNameLarge}>{order.customerName}</Text>
                    <TouchableOpacity onPress={handleCall} style={styles.phoneLink}>
                      <Text style={styles.phoneIcon}>📞</Text>
                      <Text style={styles.phoneText}>{order.customerPhone || 'No phone'}</Text>
                    </TouchableOpacity>
                    <View style={styles.typeTag}>
                      <Text style={styles.typeText}>{order.orderType?.toUpperCase() || 'PICKUP'}</Text>
                    </View>
                  </View>

                  {/* Pricing Summary */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.cardLabel}>PAYMENT SUMMARY</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Subtotal</Text>
                      <Text style={styles.priceVal}>${order.subtotal?.toFixed(2)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Tax</Text>
                      <Text style={styles.priceVal}>${order.tax?.toFixed(2)}</Text>
                    </View>
                    {order.discountAmount ? (
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.colors.gold.DEFAULT }]}>Adjustment</Text>
                        <Text style={[styles.priceVal, { color: theme.colors.gold.DEFAULT }]}>-${order.discountAmount.toFixed(2)}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.priceRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>TOTAL</Text>
                      <Text style={styles.totalVal}>${order.total?.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Messaging */}
                  <View style={styles.messageBox}>
                    <Text style={styles.cardLabel}>MESSAGE TO CUSTOMER</Text>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="e.g. Preparing your food now! It will be ready in 15 mins."
                      placeholderTextColor={theme.colors.cream.muted}
                      multiline
                      value={kitchenMsg}
                      onChangeText={setKitchenMsg}
                    />
                    <Text style={styles.msgHint}>This message appears on their order tracking page.</Text>
                  </View>

                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </View>

          {/* ── FOOTER ────────────────────────────────────────── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.issueBtn} onPress={() => setAdjustType('cancel')}>
              <Text style={styles.issueBtnText}>Issue with order / Cancel</Text>
            </TouchableOpacity>

            {nextStatus && (
              <TouchableOpacity
                onPress={handleMainAction}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: order.status === 'new' ? '#16A34A' : order.status === 'preparing' ? '#F59E0B' : '#2563EB' }
                ]}
              >
                <Text style={styles.confirmBtnText}>
                  {order.status === 'new' ? 'CONFIRM ORDER ✓' : order.status === 'preparing' ? 'MARK AS READY ✓' : 'COMPLETE ORDER ✓'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>

        <AdjustmentSheets
          type={adjustType}
          order={order}
          onClose={() => setAdjustType(null)}
          onSuccess={() => {
            setAdjustType(null)
            onClose()
          }}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.palace.black },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.palace.stone,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { color: theme.colors.gold.DEFAULT, fontSize: 22, fontWeight: '300' },
  orderInfo: { gap: 2 },
  orderIdText: { color: theme.colors.gold.DEFAULT, fontSize: 14, fontWeight: '700', opacity: 0.8 },
  customerNameTitle: { color: theme.colors.cream.DEFAULT, fontSize: 24, fontWeight: '800' },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  timeControl: { alignItems: 'center', flexDirection: 'row', gap: 15 },
  timeLabel: { color: theme.colors.gold.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  timeCounter: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.palace.stone, borderRadius: 30, padding: 4 },
  timeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.palace.black, alignItems: 'center', justifyContent: 'center' },
  timeBtnText: { color: theme.colors.gold.DEFAULT, fontSize: 14, fontWeight: '800' },
  timeValueBox: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 5 },
  timeValue: { color: theme.colors.cream.DEFAULT, fontSize: 20, fontWeight: '900' },
  timeUnit: { color: theme.colors.cream.muted, fontSize: 12, marginLeft: 2 },
  timeLoader: { position: 'absolute', right: -25 },

  mainArea: { flex: 1, flexDirection: 'row' },
  
  // Left Panel
  leftPanel: { flex: 0.6, borderRightWidth: 1, borderRightColor: theme.colors.palace.stone },
  itemList: { padding: 25, paddingBottom: 100 },
  panelTitle: { color: theme.colors.cream.muted, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 20, opacity: 0.6 },
  itemCard: {
    backgroundColor: theme.colors.palace.smoke,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.palace.stone,
  },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  qtyBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: theme.colors.gold.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: theme.colors.palace.black, fontSize: 18, fontWeight: '900' },
  itemName: { flex: 1, color: theme.colors.cream.DEFAULT, fontSize: 22, fontWeight: '600' },
  itemPrice: { color: theme.colors.cream.muted, fontSize: 18, fontWeight: '500' },
  itemFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.palace.stone + '33', paddingTop: 8 },
  tapToEdit: { color: theme.colors.gold.muted, fontSize: 12, fontStyle: 'italic' },
  specialBox: { backgroundColor: '#F59E0B15', borderRadius: 12, padding: 20, marginTop: 10, borderLeftWidth: 5, borderLeftColor: '#F59E0B' },
  specialTitle: { color: '#F59E0B', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  specialText: { color: '#FEF3C7', fontSize: 22, fontWeight: '600', lineHeight: 30 },

  // Right Panel
  rightPanel: { flex: 0.4, backgroundColor: theme.colors.palace.black },
  rightScroll: { padding: 25, gap: 20, paddingBottom: 100 },
  summaryCard: { backgroundColor: theme.colors.palace.smoke, borderRadius: 16, padding: 20, gap: 15, borderWidth: 1, borderColor: theme.colors.palace.stone },
  cardLabel: { color: theme.colors.gold.DEFAULT, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  customerNameLarge: { color: theme.colors.cream.DEFAULT, fontSize: 28, fontWeight: '900' },
  phoneLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneIcon: { fontSize: 20 },
  phoneText: { color: theme.colors.gold.DEFAULT, fontSize: 20, fontWeight: '700' },
  typeTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#2563EB' },
  typeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: theme.colors.cream.muted, fontSize: 16 },
  priceVal: { color: theme.colors.cream.DEFAULT, fontSize: 16, fontWeight: '600' },
  totalRow: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: theme.colors.palace.stone },
  totalLabel: { color: theme.colors.cream.DEFAULT, fontSize: 20, fontWeight: '800' },
  totalVal: { color: theme.colors.gold.DEFAULT, fontSize: 32, fontWeight: '900' },

  messageBox: { backgroundColor: theme.colors.palace.smoke, borderRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: theme.colors.palace.stone },
  messageInput: {
    backgroundColor: theme.colors.palace.black,
    color: theme.colors.cream.DEFAULT,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.palace.stone,
  },
  msgHint: { color: theme.colors.cream.muted, fontSize: 11, fontStyle: 'italic' },

  footer: {
    flexDirection: 'row',
    padding: 25,
    backgroundColor: theme.colors.palace.smoke,
    borderTopWidth: 1,
    borderTopColor: theme.colors.palace.stone,
    gap: 20,
    alignItems: 'center',
  },
  issueBtn: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.palace.stone },
  issueBtnText: { color: theme.colors.cream.muted, fontSize: 14, fontWeight: '700' },
  confirmBtn: { flex: 1, paddingVertical: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
})
