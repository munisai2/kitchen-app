import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Dimensions, ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { client } from '../lib/sanity'
import { kitchenSettingsQuery } from '../lib/queries'
import { KitchenSettings, UserRole } from '../lib/types'
import { useAuthStore } from '../lib/store/authStore'
import { theme } from '../constants/theme'

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinScreen() {
  const [pin,      setPin]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(false)
  const shakeAnim               = useRef(new Animated.Value(0)).current
  const errorFlash              = useRef(new Animated.Value(0)).current
  const { login }               = useAuthStore()

  function handleKey(key: string) {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      return
    }
    if (key === '' || pin.length >= 4) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newPin = pin + key
    setPin(newPin)

    if (newPin.length === 4) {
      validatePin(newPin)
    }
  }

  async function validatePin(enteredPin: string) {
    setLoading(true)
    try {
      let settings: KitchenSettings | null = null
      try {
        settings = await client.fetch<KitchenSettings>(kitchenSettingsQuery)
      } catch (e) {
        // Silently skip if sanity is down
      }

      let role: UserRole | null = null

      if (settings) {
        if (enteredPin === settings.chefPin)    role = 'chef'
        else if (enteredPin === settings.cashierPin)  role = 'cashier'
        else if (enteredPin === settings.managerPin)  role = 'manager'
        else if (enteredPin === settings.ownerPin)    role = 'owner'
      }

      // Explicit fallback for setup/emergency
      if (!role && enteredPin === '1234') {
        role = 'manager'
      }

      if (role) {
        login(role)
        router.replace('/(dashboard)/kitchen')
      } else {
        triggerError()
      }
    } catch (err) {
      triggerError()
    } finally {
      setLoading(false)
    }
  }

  function triggerError() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    setError(true)

    // Shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0,  duration: 60, useNativeDriver: true }),
    ]).start()

    // Red flash
    Animated.sequence([
      Animated.timing(errorFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(errorFlash, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()

    setTimeout(() => {
      setPin('')
      setError(false)
    }, 600)
  }

  const flashBg = errorFlash.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(125,26,26,0)', 'rgba(125,26,26,0.4)'],
  })

  return (
    <View style={styles.root}>
      {/* Error flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: flashBg }]}
        pointerEvents="none"
      />

      {/* Left — Branding */}
      <View style={styles.branding}>
        <Text style={styles.diamond}>◆</Text>
        <Text style={styles.restaurantName}>Qasr Afghani</Text>
        <Text style={styles.dashboardLabel}>Kitchen Dashboard</Text>
        <Text style={styles.subtitle}>Staff Access Only</Text>
      </View>

      {/* Right — PIN pad */}
      <View style={styles.pinSide}>
        <Text style={styles.hint}>Enter your PIN</Text>

        {/* PIN dots */}
        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                pin.length > i
                  ? [styles.dotFilled, error && styles.dotError]
                  : styles.dotEmpty,
              ]}
            />
          ))}
        </Animated.View>

        {/* Numpad */}
        <View style={styles.grid}>
          {KEYS.map((key, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.key, key === '' && styles.keyDisabled]}
              onPress={() => handleKey(key)}
              disabled={key === '' || loading}
              activeOpacity={0.7}
            >
              {loading && key === '0' ? (
                <ActivityIndicator color={theme.colors.gold.DEFAULT} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    flexDirection:   'row',
    backgroundColor: theme.colors.palace.black,
  },

  // Branding
  branding: {
    flex:           0.4,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    borderRightWidth: 1,
    borderRightColor: theme.colors.palace.stone,
  },
  diamond: {
    color:        theme.colors.gold.DEFAULT,
    fontSize:     32,
    marginBottom: 24,
  },
  restaurantName: {
    color:        theme.colors.cream.DEFAULT,
    fontSize:     36,
    fontWeight:   '300',
    fontStyle:    'italic',
    textAlign:    'center',
    letterSpacing: 2,
    lineHeight:   44,
  },
  dashboardLabel: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      16,
    letterSpacing: 4,
    marginTop:     8,
    textTransform: 'uppercase',
  },
  subtitle: {
    color:         theme.colors.cream.muted,
    fontSize:      11,
    letterSpacing: 3,
    marginTop:     20,
    textTransform: 'uppercase',
    opacity:        0.5,
  },

  // PIN side
  pinSide: {
    flex:           0.6,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            24,
  },
  hint: {
    color:         theme.colors.cream.DEFAULT,
    opacity:        0.4,
    fontSize:       14,
    letterSpacing:  1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           16,
  },
  dot: {
    width:        20,
    height:       20,
    borderRadius: 10,
  },
  dotEmpty: {
    borderWidth:  1.5,
    borderColor:  theme.colors.gold.muted,
  },
  dotFilled: {
    backgroundColor: theme.colors.gold.DEFAULT,
  },
  dotError: {
    backgroundColor: theme.colors.status.new,
  },

  // Grid
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    width:          270,
    gap:            10,
    justifyContent: 'center',
  },
  key: {
    width:           80,
    height:          72,
    borderRadius:    8,
    backgroundColor: theme.colors.palace.smoke,
    borderWidth:     1,
    borderColor:     theme.colors.palace.stone,
    alignItems:      'center',
    justifyContent:  'center',
  },
  keyDisabled: {
    opacity: 0,
  },
  keyText: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 24,
    fontWeight: '300',
  },
})
