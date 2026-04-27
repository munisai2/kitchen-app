import React, { useEffect, useRef, useState } from 'react'
import {
  Animated, Text, TouchableOpacity, StyleSheet, View,
} from 'react-native'
import { theme } from '../constants/theme'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id:      number
  message: string
  type:    ToastType
}

let addToastFn: ((msg: string, type?: ToastType) => void) | null = null

export function showToast(message: string, type: ToastType = 'info') {
  addToastFn?.(message, type)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    addToastFn = (message, type = 'info') => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }
    return () => { addToastFn = null }
  }, [])

  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  )
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [opacity])

  const bgColor = {
    success: theme.colors.status.ready,
    error:   theme.colors.status.new,
    info:    theme.colors.gold.DEFAULT,
  }[toast.type]

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity }]}>
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position:  'absolute',
    top:       16,
    left:      0,
    right:     0,
    alignItems:'center',
    zIndex:    9999,
    gap:       8,
  },
  toast: {
    borderRadius:    8,
    paddingHorizontal: 20,
    paddingVertical:   10,
    maxWidth:        400,
  },
  text: {
    color:      '#fff',
    fontWeight: '600',
    fontSize:   14,
  },
})
