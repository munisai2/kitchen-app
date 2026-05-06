import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import Slider from '@react-native-community/slider'
import { router } from 'expo-router'
import { client } from '../../lib/sanity'
import { kitchenSettingsQuery } from '../../lib/queries'
import { KitchenSettings, UserRole } from '../../lib/types'
import { useAuthStore } from '../../lib/store/authStore'
import { 
  previewAlarm, 
  stopAlarm, 
  isAlarmPlaying, 
  pickAndSaveCustomAlarm, 
  removeCustomAlarm 
} from '../../lib/sound'
import { showToast, ToastContainer } from '../../components/Toast'
import { theme } from '../../constants/theme'

type RoleKey = 'chef' | 'cashier' | 'manager' | 'owner'

const ROLE_LABELS: Record<RoleKey, string> = {
  chef:    'Chef',
  cashier: 'Cashier',
  manager: 'Manager',
  owner:   'Owner',
}

export default function SettingsScreen() {
  const [settings,     setSettings]     = useState<KitchenSettings | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [changingRole, setChangingRole] = useState<RoleKey | null>(null)
  const [newPin,       setNewPin]       = useState('')
  const [saving,       setSaving]       = useState(false)
  const { logout } = useAuthStore()

  const fetchSettings = useCallback(async () => {
    try {
      const data = await client.fetch<KitchenSettings>(kitchenSettingsQuery)
      setSettings(data)
    } catch {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function savePin() {
    if (!settings || !changingRole || newPin.length !== 4) return
    setSaving(true)
    try {
      await client.patch(settings._id).set({ [`${changingRole}Pin`]: newPin }).commit()
      setSettings(prev => prev ? { ...prev, [`${changingRole}Pin`]: newPin } : prev)
      showToast(`${ROLE_LABELS[changingRole]} PIN updated`, 'success')
      setChangingRole(null)
      setNewPin('')
    } catch {
      showToast('Failed to save PIN', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAlarm(val: boolean) {
    if (!settings) return
    setSettings(prev => prev ? { ...prev, alarmEnabled: val } : prev)
    try {
      await client.patch(settings._id).set({ alarmEnabled: val }).commit()
    } catch {
      setSettings(prev => prev ? { ...prev, alarmEnabled: !val } : prev)
      showToast('Failed to save alarm setting', 'error')
    }
  }

  // Debounced volume save
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveVolume(val: number) {
    if (!settings) return
    setSettings(prev => prev ? { ...prev, alarmVolume: val } : prev)
    
    if (volumeTimer.current) clearTimeout(volumeTimer.current)
    
    volumeTimer.current = setTimeout(async () => {
      try {
        await client.patch(settings._id).set({ alarmVolume: val }).commit()
        console.log('[settings] Volume saved to Sanity:', val)
      } catch {
        showToast('Failed to save volume', 'error')
      }
    }, 800)
  }

  function handleSignOut() {
    logout()
    router.replace('/')
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.gold.DEFAULT} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* PIN Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Staff PINs</Text>
        {(['chef','cashier','manager','owner'] as RoleKey[]).map(role => (
          <View key={role} style={styles.pinRow}>
            <Text style={styles.pinRoleLabel}>{ROLE_LABELS[role]}</Text>
            <Text style={styles.pinMasked}>••••</Text>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => { setChangingRole(role); setNewPin('') }}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Alarm Settings */}
      <View style={styles.section}>
        <Text style={styles.alarmSectionTitle}>Alarm Sound</Text>

        {/* Current Sound Indicator */}
        <View style={styles.currentSoundRow}>
          <View style={styles.soundInfo}>
            <Text style={settings?.useCustomAlarm ? styles.soundNameGold : styles.soundNameCream}>
              🔔 {settings?.useCustomAlarm ? 'Custom Sound' : 'Default Alarm'}
            </Text>
            <Text style={styles.soundSubtitle}>
              {settings?.useCustomAlarm ? 'Your uploaded alarm sound' : 'Built-in kitchen alarm'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.alarmActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.testBtnBorder]} 
            onPress={async () => {
              if (isAlarmPlaying()) {
                await stopAlarm()
                setSettings(s => s ? { ...s } : s) // Force re-render
              } else {
                await previewAlarm(settings?.alarmVolume ?? 8, 3000)
                setSettings(s => s ? { ...s } : s) // Force re-render
              }
            }}
          >
            <Text style={styles.testBtnTextGold}>
              {isAlarmPlaying() ? '⏹  Stop' : '▶  Test Alarm Sound (3 seconds)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={async () => {
            const result = await pickAndSaveCustomAlarm()
            if (result.success) {
              showToast('Custom alarm saved!', 'success')
              if (settings) {
                await client.patch(settings._id).set({ useCustomAlarm: true }).commit()
                setSettings({ ...settings, useCustomAlarm: true })
              }
            } else if (result.error !== 'Cancelled') {
              showToast(result.error || 'Failed to upload', 'error')
            }
          }}>
            <Text style={styles.actionBtnText}>📁  Upload Custom Alarm from Tablet</Text>
          </TouchableOpacity>

          {settings?.useCustomAlarm && (
            <TouchableOpacity 
              style={styles.removeBtn} 
              onPress={() => {
                Alert.alert(
                  'Remove your custom alarm?',
                  'The default alarm sound will be used instead.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Remove', 
                      style: 'destructive',
                      onPress: async () => {
                        await removeCustomAlarm()
                        if (settings) {
                          await client.patch(settings._id).set({ useCustomAlarm: false }).commit()
                          setSettings({ ...settings, useCustomAlarm: false })
                        }
                        showToast('Reverted to default alarm', 'success')
                      }
                    }
                  ]
                )
              }}
            >
              <Text style={styles.removeBtnText}>↩  Remove Custom — Use Default Alarm</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Volume Slider */}
        <View style={styles.volumeContainer}>
          <Text style={styles.rowLabel}>Alarm Volume</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={settings?.alarmVolume ?? 8}
            onValueChange={(val) => setSettings(s => s ? { ...s, alarmVolume: val } : s)}
            onSlidingComplete={saveVolume}
            minimumTrackTintColor={theme.colors.gold.DEFAULT}
            maximumTrackTintColor={theme.colors.palace.stone}
            thumbTintColor={theme.colors.gold.DEFAULT}
          />
          <Text style={styles.volumeLargeText}>{settings?.alarmVolume ?? 8}/10</Text>
          
          <TouchableOpacity 
            style={styles.volumeTestLink}
            onPress={() => previewAlarm(settings?.alarmVolume ?? 8, 2000)}
          >
            <Text style={styles.volumeTestLinkText}>Test at current volume</Text>
          </TouchableOpacity>

          <View style={styles.androidTip}>
            <Text style={styles.androidTipText}>
              💡 For maximum loudness, also ensure the tablet volume is set to maximum in Android Settings → Sound → Media Volume.
            </Text>
          </View>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <Text style={styles.infoRow}>Version: 1.0.0</Text>
        <Text style={styles.infoRow}>Restaurant: Qasr Afghani Grill & Kebab</Text>
        <Text style={styles.infoRow}>Sanity project: c020lahr</Text>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* PIN change modal */}
      <Modal
        visible={changingRole !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setChangingRole(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Change {changingRole ? ROLE_LABELS[changingRole] : ''} PIN
            </Text>
            <TextInput
              style={styles.pinInput}
              placeholder="Enter new 4-digit PIN"
              placeholderTextColor={theme.colors.cream.muted + '66'}
              value={newPin}
              onChangeText={t => setNewPin(t.replace(/\D/, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setChangingRole(null); setNewPin('') }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, newPin.length !== 4 && styles.btnDisabled]}
                onPress={savePin}
                disabled={newPin.length !== 4 || saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Save PIN</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ToastContainer />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.colors.palace.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.palace.black },
  header: {
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:  theme.colors.palace.smoke,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  title: { color: theme.colors.cream.DEFAULT, fontSize: 18, fontWeight: '700' },
  section: {
    margin:          16,
    backgroundColor: theme.colors.palace.smoke,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     theme.colors.palace.stone,
    padding:         16,
    gap:             12,
  },
  sectionTitle: {
    color:         theme.colors.gold.DEFAULT,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  alarmSectionTitle: {
    fontSize:      12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color:         'rgba(240, 230, 200, 0.4)',
    marginBottom:  16,
  },
  currentSoundRow: {
    marginBottom: 20,
  },
  soundInfo: {
    gap: 4,
  },
  soundNameGold: {
    color: theme.colors.gold.DEFAULT,
    fontSize: 16,
    fontWeight: '700',
  },
  soundNameCream: {
    color: theme.colors.cream.DEFAULT,
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.7,
  },
  soundSubtitle: {
    color: 'rgba(240, 230, 200, 0.4)',
    fontSize: 12,
  },
  alarmActions: {
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    backgroundColor: theme.colors.palace.smoke,
    borderWidth: 1,
    borderColor: theme.colors.palace.stone,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  testBtnBorder: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  testBtnTextGold: {
    color: theme.colors.gold.DEFAULT,
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnText: {
    color: 'rgba(240, 230, 200, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  removeBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
  removeBtnText: {
    color: 'rgba(240, 230, 200, 0.3)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  volumeContainer: {
    marginTop: 10,
    gap: 15,
  },
  volumeLargeText: {
    fontSize: 24,
    color: theme.colors.gold.DEFAULT,
    textAlign: 'center',
    marginTop: -5,
  },
  volumeTestLink: {
    alignSelf: 'center',
    marginTop: -5,
  },
  volumeTestLinkText: {
    color: 'rgba(240, 230, 200, 0.3)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  androidTip: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(245, 158, 11, 0.3)',
    paddingLeft: 12,
    marginTop: 8,
  },
  androidTipText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: 'rgba(251, 191, 36, 0.6)',
    lineHeight: 16,
  },
  pinRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
  },
  pinRoleLabel: {
    flex:     1,
    color:    theme.colors.cream.DEFAULT,
    fontSize: 14,
  },
  pinMasked: {
    color:        theme.colors.cream.muted,
    fontSize:     18,
    letterSpacing: 3,
    marginRight:  12,
  },
  changeBtn: {
    backgroundColor: theme.colors.palace.stone,
    borderRadius:    4,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  changeBtnText: {
    color:    theme.colors.gold.DEFAULT,
    fontSize: 13,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color:    theme.colors.cream.DEFAULT,
    fontSize: 14,
  },
  slider: {
    width:  '100%',
    height: 40,
  },
  testBtn: {
    backgroundColor: theme.colors.palace.stone,
    borderRadius:    6,
    paddingVertical: 10,
    alignItems:      'center',
  },
  testBtnText: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   14,
    fontWeight: '600',
  },
  infoRow: {
    color:    theme.colors.cream.muted,
    fontSize: 13,
  },
  signOutBtn: {
    margin:          16,
    backgroundColor: theme.colors.palace.maroon,
    borderRadius:    8,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    40,
  },
  signOutText: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  modalBox: {
    backgroundColor: theme.colors.palace.smoke,
    borderRadius:    12,
    padding:         24,
    width:           320,
    gap:             16,
    borderWidth:     1,
    borderColor:     theme.colors.palace.stone,
  },
  modalTitle: {
    color:      theme.colors.cream.DEFAULT,
    fontSize:   18,
    fontWeight: '700',
    textAlign:  'center',
  },
  pinInput: {
    backgroundColor: theme.colors.palace.stone,
    color:           theme.colors.cream.DEFAULT,
    borderRadius:    6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize:        18,
    textAlign:       'center',
    letterSpacing:   8,
  },
  modalBtns: {
    flexDirection: 'row',
    gap:           10,
  },
  cancelBtn: {
    flex:            1,
    backgroundColor: theme.colors.palace.stone,
    borderRadius:    6,
    paddingVertical: 10,
    alignItems:      'center',
  },
  cancelBtnText: {
    color:    theme.colors.cream.muted,
    fontSize: 14,
  },
  confirmBtn: {
    flex:            1,
    backgroundColor: theme.colors.gold.DEFAULT,
    borderRadius:    6,
    paddingVertical: 10,
    alignItems:      'center',
  },
  confirmBtnText: {
    color:      theme.colors.palace.black,
    fontSize:   14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.4,
  },
})
