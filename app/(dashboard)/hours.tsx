import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Modal, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { client } from '../../lib/sanity'
import { restaurantInfoQuery } from '../../lib/queries'
import { theme } from '../../constants/theme'
import { showToast } from '../../components/Toast'
import { useAuthStore } from '../../lib/store/authStore'
import { OpeningHours } from '../../lib/types'

// Custom Simple Time Picker to avoid native dependencies
function SimpleTimePicker({ value, onChange }: { value: Date, onChange: (d: Date) => void }) {
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const mins = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
  const currentHour = value.getHours() % 12 || 12
  const currentMin = value.getMinutes()
  const isPM = value.getHours() >= 12

  const handleUpdate = (h: number, m: number, pm: boolean) => {
    const newDate = new Date(value)
    let finalH = h === 12 ? 0 : h
    if (pm) finalH += 12
    newDate.setHours(finalH, m)
    onChange(newDate)
  }

  const adjustMinutes = (delta: number) => {
    const newDate = new Date(value)
    newDate.setMinutes(newDate.getMinutes() + delta)
    onChange(newDate)
  }

  const adjustHours = (delta: number) => {
    const newDate = new Date(value)
    newDate.setHours(newDate.getHours() + delta)
    onChange(newDate)
  }

  return (
    <View style={pickerStyles.container}>
      {/* ── Granular Adjusters ── */}
      <View style={pickerStyles.adjusterRow}>
        <View style={pickerStyles.adjuster}>
          <Text style={pickerStyles.adjusterLabel}>HOURS</Text>
          <View style={pickerStyles.adjusterControls}>
            <TouchableOpacity style={pickerStyles.adjustBtn} onPress={() => adjustHours(-1)}>
              <Text style={pickerStyles.adjustBtnText}>−</Text>
            </TouchableOpacity>
            <View style={pickerStyles.displayBox}>
              <Text style={pickerStyles.displayText}>{currentHour}</Text>
            </View>
            <TouchableOpacity style={pickerStyles.adjustBtn} onPress={() => adjustHours(1)}>
              <Text style={pickerStyles.adjustBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={pickerStyles.adjuster}>
          <Text style={pickerStyles.adjusterLabel}>MINUTES</Text>
          <View style={pickerStyles.adjusterControls}>
            <TouchableOpacity style={pickerStyles.adjustBtn} onPress={() => adjustMinutes(-1)}>
              <Text style={pickerStyles.adjustBtnText}>−</Text>
            </TouchableOpacity>
            <View style={pickerStyles.displayBox}>
              <Text style={pickerStyles.displayText}>{currentMin < 10 ? `0${currentMin}` : currentMin}</Text>
            </View>
            <TouchableOpacity style={pickerStyles.adjustBtn} onPress={() => adjustMinutes(1)}>
              <Text style={pickerStyles.adjustBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={pickerStyles.adjuster}>
          <Text style={pickerStyles.adjusterLabel}>AM/PM</Text>
          <View style={pickerStyles.adjusterControls}>
            <TouchableOpacity 
              style={[pickerStyles.ampmBtn, !isPM && pickerStyles.ampmActive]} 
              onPress={() => handleUpdate(currentHour, currentMin, false)}
            >
              <Text style={[pickerStyles.ampmText, !isPM && pickerStyles.ampmActive ? pickerStyles.ampmTextActive : pickerStyles.ampmText]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[pickerStyles.ampmBtn, isPM && pickerStyles.ampmActive]} 
              onPress={() => handleUpdate(currentHour, currentMin, true)}
            >
              <Text style={[pickerStyles.ampmText, isPM && pickerStyles.ampmActive ? pickerStyles.ampmTextActive : pickerStyles.ampmText]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={pickerStyles.divider} />

      {/* ── Quick Grids ── */}
      <View style={pickerStyles.section}>
        <Text style={pickerStyles.label}>QUICK HOUR SELECT</Text>
        <View style={pickerStyles.grid}>
          {hours.map(h => (
            <TouchableOpacity 
              key={h} 
              style={[pickerStyles.btn, currentHour === h && pickerStyles.btnActive]}
              onPress={() => handleUpdate(h, currentMin, isPM)}
            >
              <Text style={[pickerStyles.btnText, currentHour === h && pickerStyles.btnTextActive]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={pickerStyles.section}>
        <Text style={pickerStyles.label}>QUICK MINUTE SELECT</Text>
        <View style={pickerStyles.grid}>
          {mins.map(m => (
            <TouchableOpacity 
              key={m} 
              style={[pickerStyles.btn, currentMin === parseInt(m) && pickerStyles.btnActive, { width: '15%' }]}
              onPress={() => handleUpdate(currentHour, parseInt(m), isPM)}
            >
              <Text style={[pickerStyles.btnText, currentMin === parseInt(m) && pickerStyles.btnTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

const pickerStyles = StyleSheet.create({
  container: { width: '100%' },
  adjusterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  adjuster: { flex: 1, alignItems: 'center' },
  adjusterLabel: { color: theme.colors.gold.muted, fontSize: 10, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  adjusterControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.palace.stone, borderRadius: 8, padding: 4 },
  adjustBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.palace.black, borderRadius: 6 },
  adjustBtnText: { color: theme.colors.gold.DEFAULT, fontSize: 20, fontWeight: '700' },
  displayBox: { width: 44, alignItems: 'center' },
  displayText: { color: theme.colors.cream.DEFAULT, fontSize: 18, fontWeight: '900' },

  ampmBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  ampmActive: { backgroundColor: theme.colors.gold.DEFAULT },
  ampmText: { color: theme.colors.cream.muted, fontWeight: '800', fontSize: 13 },
  ampmTextActive: { color: theme.colors.palace.black },

  divider: { height: 1, backgroundColor: theme.colors.palace.stone, marginBottom: 8 },

  section: { marginBottom: 12 },
  label: { color: theme.colors.cream.muted, fontSize: 10, fontWeight: '800', marginBottom: 6, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { 
    backgroundColor: theme.colors.palace.stone, 
    width: '15%', 
    paddingVertical: 10, 
    borderRadius: 6, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  btnActive: { borderColor: theme.colors.gold.DEFAULT, backgroundColor: theme.colors.gold.DEFAULT + '22' },
  btnText: { color: theme.colors.cream.muted, fontSize: 13, fontWeight: '700' },
  btnTextActive: { color: theme.colors.gold.DEFAULT },
})

export default function HoursScreen() {
  const { role } = useAuthStore()
  const [hours, setHours] = useState<OpeningHours[]>([])
  const [docId, setDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editDay, setEditDay] = useState<number | null>(null)

  const [openTime, setOpenTime] = useState(new Date())
  const [closeTime, setCloseTime] = useState(new Date())
  const [showPicker, setShowPicker] = useState<'open' | 'close' | null>(null)

  const fetchHours = useCallback(async () => {
    try {
      setLoading(true)
      const data = await client.fetch(restaurantInfoQuery)
      if (data) {
        setHours(data.openingHours || [])
        setDocId(data._id)
      }
    } catch (err) {
      console.error('[hours fetch]', err)
      showToast('Failed to load hours', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHours() }, [fetchHours])

  function handleToggle(index: number, val: boolean) {
    const newHours = [...hours]
    newHours[index] = { ...newHours[index], isClosed: !val }
    setHours(newHours)
  }

  function startEdit(index: number) {
    const day = hours[index]
    if (day.hours && day.hours.includes('–')) {
      const parts = day.hours.split(' – ')
      setOpenTime(parseTimeString(parts[0]))
      setCloseTime(parseTimeString(parts[1] ?? parts[0]))
    } else {
      // Default to 11:00 AM – 10:00 PM for days with no hours set
      const defaultOpen  = new Date(); defaultOpen.setHours(11, 0, 0, 0)
      const defaultClose = new Date(); defaultClose.setHours(22, 0, 0, 0)
      setOpenTime(defaultOpen)
      setCloseTime(defaultClose)
    }
    setEditDay(index)
  }

  function parseTimeString(timeStr: string) {
    try {
      // Robust regex to extract hours, minutes and am/pm regardless of spaces
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!match) throw new Error('Invalid format')
      
      let h = parseInt(match[1], 10)
      const m = parseInt(match[2], 10)
      const ampm = match[3].toUpperCase()

      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0

      const d = new Date()
      d.setHours(h, m, 0, 0)
      return d
    } catch (e) {
      console.warn('[parseTime] Failed to parse:', timeStr)
      // Default to 11:00 AM as a safe fallback
      const fallback = new Date()
      fallback.setHours(11, 0, 0, 0)
      return fallback
    }
  }

  function formatTimeString(date: Date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(' ', ' ') // Ensure standard space
  }

  async function saveHours(_hours = hours) {
    if (!docId) {
      showToast('Cannot save — restaurant data not loaded yet', 'error')
      return
    }
    try {
      setSaving(true)
      await client.patch(docId).set({ openingHours: _hours }).commit()
      showToast('Hours updated — website will reflect soon', 'success')
      setEditDay(null)
    } catch (err) {
      console.error('[hours save]', err)
      showToast('Failed to save hours — check connection', 'error')
    } finally {
      setSaving(false)
    }
  }

  function applyQuickHours() {
    if (editDay === null) return
    const timeRange = `${formatTimeString(openTime)} – ${formatTimeString(closeTime)}`
    const newHours = [...hours]
    newHours[editDay] = { ...newHours[editDay], hours: timeRange, isClosed: false }
    setHours(newHours)
    saveHours(newHours)  // persist immediately
  }

  function markAllSame() {
    if (editDay === null) return
    const timeRange = `${formatTimeString(openTime)} – ${formatTimeString(closeTime)}`
    const newHours = hours.map(h => ({ ...h, hours: timeRange, isClosed: false }))
    Alert.alert('Apply to All Days?', 'This will set every day to these hours.', [
      { text: 'Cancel' },
      { text: 'Apply All', onPress: () => { setHours(newHours); saveHours(newHours); } }
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.gold.DEFAULT} size="large" /></View>

  const todayIndex = (new Date().getDay() + 6) % 7 // Monday = 0
  const today = hours[todayIndex]

  // ── EDITOR VIEW (Separate "Page") ──
  if (editDay !== null) {
    return (
      <SafeAreaView style={styles.root}>
        {/* Floating Back Button */}
        <TouchableOpacity onPress={() => setEditDay(null)} style={styles.floatingBack}>
          <Text style={styles.floatingBackText}>←</Text>
        </TouchableOpacity>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContentCompact}>
          <View style={styles.editorArea}>
            <View style={styles.pickerBoxCompact}>
              <Text style={styles.pickerMainLabelSlim}>OPENING HOURS</Text>
              <SimpleTimePicker
                value={openTime}
                onChange={(d) => setOpenTime(d)}
              />
            </View>

            <View style={styles.pickerBoxCompact}>
              <Text style={styles.pickerMainLabelSlim}>CLOSING HOURS</Text>
              <SimpleTimePicker
                value={closeTime}
                onChange={(d) => setCloseTime(d)}
              />
            </View>
          </View>

          <View style={styles.editorActionsRow}>
            <TouchableOpacity style={styles.applyBtnHalf} onPress={applyQuickHours}>
              <Text style={styles.applyBtnText}>APPLY TO {hours[editDay].days.toUpperCase()}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.applyAllBtnHalf} onPress={markAllSame}>
              <Text style={styles.applyAllBtnText}>APPLY TO ALL DAYS</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── MAIN SCHEDULE VIEW ──
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Store Hours</Text>
          {(role === 'chef' || role === 'cashier') && (
            <Text style={styles.staffNote}>
              * Changes apply to the website immediately. Contact your manager if unsure.
            </Text>
          )}
          <Text style={styles.subtitle}>Changes apply to the website immediately</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={() => saveHours()} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE ALL</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Today Highlight */}
        {today && (
          <View style={styles.todayCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.todayLabel}>TODAY — {today.days.toUpperCase()}</Text>
              <View style={[styles.statusDot, { backgroundColor: today.isClosed ? '#EF4444' : '#22C55E' }]} />
            </View>
            <Text style={[styles.todayHours, today.isClosed && { color: '#EF4444' }]}>
              {today.isClosed ? 'CLOSED TODAY' : today.hours}
            </Text>
            <TouchableOpacity style={styles.editBtnInline} onPress={() => startEdit(todayIndex)}>
              <Text style={styles.editBtnText}>✏️ Edit Today's Time</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weekly Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Schedule</Text>
          {hours.map((day, idx) => (
            <View key={idx} style={styles.dayRow}>
              <View style={styles.dayInfo}>
                <Text style={styles.dayName}>{day.days}</Text>
                <Text style={[styles.dayHours, day.isClosed && styles.textRed]}>
                  {day.isClosed ? 'Closed' : day.hours}
                </Text>
              </View>
              <View style={styles.dayActions}>
                <Switch
                  value={!day.isClosed}
                  onValueChange={(val) => handleToggle(idx, val)}
                  trackColor={{ false: '#3F3F46', true: '#C9A84C44' }}
                  thumbColor={!day.isClosed ? theme.colors.gold.DEFAULT : '#71717A'}
                />
                {!day.isClosed && (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => startEdit(idx)}>
                    <Text style={styles.iconText}>✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickBtn}
            onPress={() => {
              const newHours = [...hours]
              newHours[todayIndex] = { ...newHours[todayIndex], isClosed: true }
              setHours(newHours)
              Alert.alert('Closed for Today', 'Today is now marked as CLOSED in memory. Press SAVE ALL to apply.')
            }}
          >
            <Text style={styles.quickBtnText}>Close for Today Only</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.palace.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.palace.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.palace.stone,
    backgroundColor: theme.colors.palace.smoke,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.palace.stone, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  backBtnText: { color: theme.colors.gold.DEFAULT, fontSize: 24, fontWeight: '700' },
  title: { color: theme.colors.gold.DEFAULT, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  staffNote: { color: '#F59E0B', fontSize: 11, fontStyle: 'italic', marginTop: 4, opacity: 0.8 },
  subtitle: { color: theme.colors.cream.muted, fontSize: 13, marginTop: 4 },
  saveBtn: { backgroundColor: theme.colors.gold.DEFAULT, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: theme.colors.palace.black, fontWeight: '800', letterSpacing: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 20 },
  scrollContentCompact: { padding: 12, gap: 10, paddingTop: 60 },

  // Editor View styles
  floatingBack: {
    position: 'absolute', top: 20, left: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.palace.stone,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.gold.DEFAULT + '22',
  },
  floatingBackText: { color: theme.colors.gold.DEFAULT, fontSize: 24, fontWeight: '700' },

  editorArea: { flexDirection: 'row', gap: 15 },
  pickerBoxCompact: { flex: 1, backgroundColor: theme.colors.palace.smoke, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.palace.stone },
  pickerMainLabelSlim: { color: theme.colors.gold.DEFAULT, fontSize: 11, fontWeight: '900', marginBottom: 12, letterSpacing: 1.5, textAlign: 'center' },
  
  editorActionsRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
  applyBtnHalf: { flex: 1, backgroundColor: theme.colors.gold.DEFAULT, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  applyAllBtnHalf: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.palace.stone, alignItems: 'center' },
  applyBtnText: { color: theme.colors.palace.black, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  applyAllBtnText: { color: theme.colors.cream.muted, fontSize: 13, fontWeight: '700' },

  todayCard: {
    backgroundColor: theme.colors.palace.smoke, padding: 20, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.gold.DEFAULT + '44',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  todayLabel: { color: theme.colors.gold.DEFAULT, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  todayHours: { color: theme.colors.cream.DEFAULT, fontSize: 28, fontWeight: '900', marginBottom: 15 },
  editBtnInline: { backgroundColor: theme.colors.palace.stone, alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  editBtnText: { color: theme.colors.gold.DEFAULT, fontSize: 12, fontWeight: '700' },

  section: { gap: 15 },
  sectionTitle: { color: theme.colors.cream.muted, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.palace.smoke, padding: 15, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.palace.stone,
  },
  dayInfo: { gap: 4 },
  dayName: { color: theme.colors.cream.DEFAULT, fontSize: 18, fontWeight: '700' },
  dayHours: { color: theme.colors.cream.muted, fontSize: 14 },
  textRed: { color: '#EF4444' },

  dayActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBtn: { padding: 5 },
  iconText: { fontSize: 18 },

  quickActions: { marginTop: 10 },
  quickBtn: { paddingVertical: 12, alignItems: 'center' },
  quickBtnText: { color: theme.colors.gold.muted, fontSize: 13, fontStyle: 'italic' },
})
