import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native'
import { Order } from '../lib/types'
import { stopAlarm } from '../lib/sound'
import { useAlarmStore } from '../lib/store/alarmStore'

interface NewOrderAlertProps {
  order: Order | null
  onDismiss: () => void
}

export function NewOrderAlert({ order, onDismiss }: NewOrderAlertProps) {
  const pulseAnim  = useRef(new Animated.Value(1)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const { stopAllAlarms } = useAlarmStore()

  useEffect(() => {
    if (order) {
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start()

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.75, duration: 350, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 350, useNativeDriver: true }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    } else {
      opacityAnim.setValue(0)
    }
  }, [order])

  if (!order) return null

  async function handleTouch() {
    // Stop both the sound AND the store state so isAlarming becomes false
    await stopAlarm()
    stopAllAlarms()
    Animated.timing(opacityAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => onDismiss())
  }

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#15803D', opacity: pulseAnim }]} />
      <TouchableOpacity style={styles.touchArea} activeOpacity={1} onPress={handleTouch}>
        <Text style={styles.bellText}>🔔</Text>
        <Text style={styles.newOrderText}>NEW ORDER</Text>
        <Text style={styles.tapText}>TAP ANYWHERE TO VIEW</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#16A34A',
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  bellText: { fontSize: 80 },
  newOrderText: {
    color: '#FFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  tapText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 10,
  },
})
