import '../global.css'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { activateKeepAwakeAsync } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  useEffect(() => {
    activateKeepAwakeAsync()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0C0A08' }}>
      <SafeAreaProvider>
        <StatusBar style="light" hidden />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index"       options={{ headerShown: false }} />
          <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
