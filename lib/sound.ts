import { Audio } from 'expo-av'

let soundObject: Audio.Sound | null = null

export async function startAlarm(volume: number = 8) {
  try {
    // If already playing, don't start another one
    if (soundObject) return

    await Audio.setAudioModeAsync({
      staysActiveInBackground:    true,
      shouldDuckAndroid:          false,
      playThroughEarpieceAndroid: false,
    })

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/alarm.mp3'),
      { isLooping: true, volume: Math.min(1.0, volume / 10) }
    )

    soundObject = sound
    await sound.playAsync()
  } catch (err) {
    console.error('[alarm] Failed to play:', err)
  }
}

export async function stopAlarm() {
  // Grab the reference first and clear it immediately so no other call races
  const s = soundObject
  soundObject = null

  if (s) {
    try { await s.stopAsync()   } catch {}
    try { await s.unloadAsync() } catch {}
  }
}

export async function playBeep() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/alarm.mp3'),
      { isLooping: false, volume: 0.5 }
    )
    await sound.playAsync()
    // Unload after playing (approx length of the file or just let it finish)
    setTimeout(() => sound.unloadAsync(), 5000)
  } catch (err) {
    console.error('[beep] Failed to play:', err)
  }
}
