import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Order } from '../lib/types'
import { theme } from '../constants/theme'
import { client } from '../lib/sanity'
import { showToast } from './Toast'

interface AdjustmentSheetsProps {
  type: 'time' | 'price' | 'cancel' | null
  order: Order
  onClose: () => void
  onSuccess: () => void
}

export function AdjustmentSheets({ type, order, onClose, onSuccess }: AdjustmentSheetsProps) {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [tempTime, setTempTime] = useState(order.estimatedTime || 30)
  const [message, setMessage] = useState('')

  if (!type) return null

  async function handleAdjustTime() {
    try {
      setLoading(true)
      await client.patch(order._id)
        .set({ estimatedTime: tempTime, adjustmentReason: 'Time adjusted by kitchen' })
        .commit()

      showToast(`Time updated to ${tempTime}m`, 'success')
      onSuccess()
    } catch (err) {
      showToast('Failed to adjust time', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdjustPrice() {
    const discount = parseFloat(value)
    if (isNaN(discount) || discount <= 0) {
      return showToast('Enter a valid discount amount', 'error')
    }

    try {
      setLoading(true)
      const newTotal = Math.max(0, (order.total || 0) - discount)
      await client.patch(order._id)
        .set({
          discountAmount: discount,
          total: newTotal,
          adjustmentReason: reason || 'Price adjusted by staff'
        })
        .commit()

      showToast('Price adjusted', 'success')
      onSuccess()
    } catch (err) {
      showToast('Failed to adjust price', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!reason) return showToast('Please select a reason', 'error')

    try {
      setLoading(true)
      await client.patch(order._id)
        .set({
          status: 'cancelled',
          cancellationReason: reason,
          kitchenMessage: message || `Order cancelled: ${reason}`
        })
        .commit()

      showToast('Order cancelled', 'success')
      onSuccess()
    } catch (err) {
      showToast('Failed to cancel order', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={!!type} transparent animationType="fade">
      <View style={styles.dim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {type === 'time' ? 'Adjust Pickup Time' : type === 'price' ? 'Apply Discount' : 'Cancel Order'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sheetContent}>
            {type === 'time' && (
              <View style={styles.timeControl}>
                <Text style={styles.timeHeader}>ESTIMATED PREP TIME</Text>
                <View style={styles.timeCounter}>
                  <TouchableOpacity 
                    style={styles.timeStepBtn} 
                    onPress={() => setTempTime(t => Math.max(5, t - 5))}
                  >
                    <Text style={styles.timeStepText}>- 5</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.timeValueBox}>
                    <Text style={styles.timeValue}>{tempTime}</Text>
                    <Text style={styles.timeUnit}>MIN</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.timeStepBtn} 
                    onPress={() => setTempTime(t => Math.min(180, t + 5))}
                  >
                    <Text style={styles.timeStepText}>+ 5</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={handleAdjustTime}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>CONFIRM TIME</Text>}
                </TouchableOpacity>
              </View>
            )}

            {type === 'price' && (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>Discount Amount ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.cream.muted}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={setValue}
                />
                <Text style={styles.inputLabel}>Reason (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Item out of stock"
                  placeholderTextColor={theme.colors.cream.muted}
                  value={reason}
                  onChangeText={setReason}
                />
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleAdjustPrice}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>APPLY DISCOUNT</Text>}
                </TouchableOpacity>
              </View>
            )}

            {type === 'cancel' && (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>Select Cancellation Reason</Text>
                <View style={styles.reasonGrid}>
                  {['Out of stock', 'Too busy', 'Kitchen closed', 'Other'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                      onPress={() => setReason(r)}
                    >
                      <Text style={[styles.reasonBtnText, reason === r && styles.reasonBtnTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Message to Customer (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sorry, we are out of that specific item."
                  placeholderTextColor={theme.colors.cream.muted}
                  value={message}
                  onChangeText={setMessage}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: '#DC2626' }]}
                  onPress={handleCancel}
                  disabled={loading || !reason}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>CONFIRM CANCELLATION</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.palace.black,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 400,
    padding: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  sheetTitle: {
    color: theme.colors.gold.DEFAULT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 10,
  },
  closeText: {
    color: theme.colors.cream.muted,
    fontSize: 20,
  },
  sheetContent: {
    flex: 1,
  },
  timeControl: {
    alignItems: 'center',
    gap: 30,
  },
  timeHeader: {
    color: theme.colors.cream.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  timeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
  },
  timeStepBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.palace.stone,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.palace.stone,
  },
  timeStepText: {
    color: theme.colors.gold.DEFAULT,
    fontSize: 20,
    fontWeight: '800',
  },
  timeValueBox: {
    alignItems: 'center',
    minWidth: 100,
  },
  timeValue: {
    color: theme.colors.cream.DEFAULT,
    fontSize: 72,
    fontWeight: '900',
  },
  timeUnit: {
    color: theme.colors.gold.muted,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: -5,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeBtn: {
    backgroundColor: theme.colors.palace.stone,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: '30%',
    alignItems: 'center',
  },
  timeBtnText: {
    color: theme.colors.cream.DEFAULT,
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    gap: 20,
  },
  inputLabel: {
    color: theme.colors.cream.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.palace.stone,
    color: theme.colors.cream.DEFAULT,
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reasonBtn: {
    borderWidth: 1,
    borderColor: theme.colors.palace.stone,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  reasonBtnActive: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  reasonBtnText: {
    color: theme.colors.cream.muted,
    fontSize: 16,
  },
  reasonBtnTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: theme.colors.gold.DEFAULT,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: theme.colors.palace.black,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
})
