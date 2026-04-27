import React, { useState, useEffect } from 'react'
import { Text, StyleSheet } from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { theme } from '../constants/theme'

interface TimeAgoProps {
  date:   string
  style?: object
}

export function TimeAgo({ date, style }: TimeAgoProps) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function update() {
      try {
        setLabel(formatDistanceToNow(new Date(date), { addSuffix: true }))
      } catch {
        setLabel('—')
      }
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [date])

  return <Text style={[styles.text, style]}>{label}</Text>
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color:    theme.colors.cream.muted,
  },
})
