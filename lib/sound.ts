// expo-av deprecation warning suppressed
// Migration to expo-audio planned for next major update
// TODO: migrate when upgrading to Expo SDK 54+

import { Audio }          from 'expo-av'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem     from 'expo-file-system/legacy'
import { Alert } from 'react-native'

// ── CONSTANTS ──────────────────────────────────────────

// Download a free loud alarm sound from:
// https://freesound.org/search/?q=alarm+beep&f=license:"Creative+Commons+0"
// 
// Requirements for the sound file:
//   - Format: MP3
//   - Duration: 2-4 seconds (will loop)
//   - Should be loud and attention-grabbing
//   - Filename: alarm_default.mp3
//   - Place in: assets/sounds/alarm_default.mp3

const DEFAULT_ALARM = require('../assets/sounds/alarm_default.mp3')
// @ts-ignore: Legacy expo-file-system typings issue
export const CUSTOM_ALARM_PATH = FileSystem.documentDirectory + 'custom_alarm.mp3'

// ── STATE ───────────────────────────────────────────────

let currentSound:    Audio.Sound | null = null
let isPlaying:       boolean            = false
let customAlarmPath: string | null      = null  // null = use default

// ── AUDIO MODE ──────────────────────────────────────────

async function setupAudioMode() {
  await Audio.setAudioModeAsync({
    // Android specific — critical for loudness
    staysActiveInBackground:    true,
    shouldDuckAndroid:          false,
    playThroughEarpieceAndroid: false,
    // These settings use the media audio stream at max
    allowsRecordingIOS:         false,
    playsInSilentModeIOS:       true,  // iOS: play even in silent mode
  })
}

// ── LOAD CUSTOM ALARM PATH ──────────────────────────────
// Call this on app startup to restore saved custom alarm

export function setCustomAlarmPath(path: string | null) {
  customAlarmPath = path
}

// ── CHECK IF CUSTOM FILE EXISTS ─────────────────────────

export async function customAlarmExists(): Promise<boolean> {
  if (!customAlarmPath) return false
  try {
    const info = await FileSystem.getInfoAsync(customAlarmPath)
    return info.exists
  } catch { return false }
}

// ── START ALARM ─────────────────────────────────────────

export async function startAlarm(volume: number = 8): Promise<void> {
  try {
    await setupAudioMode()
    
    // Stop any existing alarm first
    if (currentSound) {
      await currentSound.stopAsync().catch(() => {})
      await currentSound.unloadAsync().catch(() => {})
      currentSound = null
    }

    // Determine which sound to use
    const useCustom = await customAlarmExists()
    
    let sound: Audio.Sound
    
    if (useCustom && customAlarmPath) {
      // Load from file system (custom uploaded sound)
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: customAlarmPath },
        {
          isLooping: true,
          volume:    Math.min(1.0, volume / 10),
        }
      )
      sound = s
    } else {
      // Load bundled default sound
      const { sound: s } = await Audio.Sound.createAsync(
        DEFAULT_ALARM,
        {
          isLooping: true,
          volume:    Math.min(1.0, volume / 10),
        }
      )
      sound = s
    }

    currentSound = sound
    await sound.playAsync()
    isPlaying = true
    
    console.log(`[alarm] Started — using ${useCustom ? 'custom' : 'default'} sound at volume ${volume}/10`)
    
  } catch (err) {
    console.error('[alarm] Failed to start:', err)
  }
}

// ── STOP ALARM ──────────────────────────────────────────

export async function stopAlarm(): Promise<void> {
  try {
    if (currentSound) {
      await currentSound.stopAsync()
      await currentSound.unloadAsync()
      currentSound = null
      isPlaying = false
      console.log('[alarm] Stopped')
    }
  } catch (err) {
    console.error('[alarm] Failed to stop:', err)
  }
}

// ── PREVIEW SOUND (for testing in settings) ─────────────

export async function previewAlarm(
  volume: number = 8,
  durationMs: number = 3000
): Promise<void> {
  await startAlarm(volume)
  setTimeout(async () => {
    await stopAlarm()
  }, durationMs)
}

// ── UPLOAD CUSTOM ALARM ─────────────────────────────────

export interface UploadAlarmResult {
  success:  boolean
  filePath?: string
  error?:   string
}

export async function pickAndSaveCustomAlarm(): 
  Promise<UploadAlarmResult> {
  try {
    // Open the file picker — filter to audio files
    const result = await DocumentPicker.getDocumentAsync({
      type:      'audio/*',
      copyToCacheDirectory: true,
    })

    // User cancelled
    if (result.canceled || !result.assets?.[0]) {
      return { success: false, error: 'Cancelled' }
    }

    const pickedFile = result.assets[0]

    // Validate file size (max 10MB for alarm sounds)
    if (pickedFile.size && pickedFile.size > 10 * 1024 * 1024) {
      return { 
        success: false, 
        error: 'File too large. Please use a sound file under 10MB.' 
      }
    }

    Alert.alert('Debug: File Picked', `URI: ${pickedFile.uri}\nSize: ${pickedFile.size}`)

    // Copy to app's permanent document directory
    // This survives app updates and cache clears
    await FileSystem.copyAsync({
      from: pickedFile.uri,
      to:   CUSTOM_ALARM_PATH,
    })

    Alert.alert('Debug', 'File copied successfully!')

    // Verify the copy succeeded
    const info = await FileSystem.getInfoAsync(CUSTOM_ALARM_PATH)
    if (!info.exists) {
      return { success: false, error: 'Failed to save file.' }
    }

    customAlarmPath = CUSTOM_ALARM_PATH
    
    console.log('[alarm] Custom alarm saved to', CUSTOM_ALARM_PATH)
    return { success: true, filePath: CUSTOM_ALARM_PATH }

  } catch (err: any) {
    console.error('[alarm] Upload error:', err)
    return { success: false, error: err.message ?? 'Unknown error' }
  }
}

// ── REMOVE CUSTOM ALARM (revert to default) ─────────────

export async function removeCustomAlarm(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CUSTOM_ALARM_PATH)
    if (info.exists) {
      await FileSystem.deleteAsync(CUSTOM_ALARM_PATH)
    }
    customAlarmPath = null
    console.log('[alarm] Reverted to default alarm sound')
  } catch (err) {
    console.error('[alarm] Failed to remove custom alarm:', err)
  }
}

export function isAlarmPlaying(): boolean { return isPlaying }
