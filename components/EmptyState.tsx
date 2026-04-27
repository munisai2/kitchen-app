import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../constants/theme'

interface EmptyStateProps {
  icon:      string
  title:     string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 40,
  },
  icon: {
    fontSize:     36,
    marginBottom: 12,
  },
  title: {
    fontSize:   16,
    fontWeight: '600',
    color:      theme.colors.cream.DEFAULT,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   13,
    color:      theme.colors.cream.muted,
    textAlign:  'center',
    marginTop:  6,
  },
})
