import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Tabs, usePathname, router } from 'expo-router'
import { useAuthStore } from '../../lib/store/authStore'
import { UserRole } from '../../lib/types'
import { theme } from '../../constants/theme'
import { NewOrderAlert } from '../../components/NewOrderAlert'
import { useOrders } from '../../hooks/useOrders'
import { useAlarmStore } from '../../lib/store/alarmStore'
import { startAlarm, stopAlarm } from '../../lib/sound'

interface TabDef {
  name:  string
  label: string
  icon:  string
  roles: UserRole[]
  href:  string
}

const ALL_TABS: TabDef[] = [
  { name: 'kitchen',      label: 'Kitchen',  icon: '🍢', roles: ['chef','cashier','manager','owner'], href: '/(dashboard)/kitchen'      },
  { name: 'orders',       label: 'Orders',   icon: '📋', roles: ['cashier','manager','owner'],        href: '/(dashboard)/orders'       },
  { name: 'revenue',      label: 'Revenue',  icon: '📊', roles: ['manager','owner'],                  href: '/(dashboard)/revenue'      },
  { name: 'menu-control', label: 'Menu',     icon: '🔀', roles: ['chef','cashier','manager','owner'], href: '/(dashboard)/menu-control' },
  { name: 'hours',        label: 'Hours',    icon: '🕐', roles: ['chef','cashier','manager','owner'], href: '/(dashboard)/hours'        },
  { name: 'settings',     label: 'Settings', icon: '⚙️', roles: ['owner'],                            href: '/(dashboard)/settings'     },
]

function SideTabBar() {
  const { role } = useAuthStore()
  const pathname = usePathname()
  
  const visibleTabs = ALL_TABS.filter(t => role && t.roles.includes(role))

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <Text style={styles.logoText}>◆</Text>
        <Text style={styles.logoSub}>QASR</Text>
      </View>

      {/* Tabs */}
      <ScrollView style={styles.tabList} showsVerticalScrollIndicator={false}>
        {visibleTabs.map(tab => {
          const active = pathname.includes(tab.name)
          
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => router.push(tab.href as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {active && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Role indicator */}
      <View style={styles.roleArea}>
        <Text style={styles.roleText}>{role?.toUpperCase()}</Text>
      </View>
    </View>
  )
}

export default function DashboardLayout() {
  // Global order listener so we detect new orders on any tab
  const { orders } = useOrders()
  const { isAlarming, stopAllAlarms, pendingOrders } = useAlarmStore()
  const firstPendingId = pendingOrders[0] ?? null
  const pendingOrder   = orders.find(o => o._id === firstPendingId) ?? null

  // Watch isAlarming state to fire the actual sound
  React.useEffect(() => {
    if (isAlarming) {
      startAlarm(8)
    } else {
      stopAlarm()
    }
  }, [isAlarming])

  async function handleAlarmDismiss() {
    await stopAlarm()
    stopAllAlarms()
    if (firstPendingId) {
      router.push({ pathname: '/(dashboard)/order-detail', params: { id: firstPendingId } } as any)
    }
  }

  return (
    <View style={styles.root}>
      <SideTabBar />
      <View style={styles.content}>
        <Tabs
          screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        >
          <Tabs.Screen name="kitchen"      options={{ title: 'Kitchen' }} />
          <Tabs.Screen name="orders"       options={{ title: 'Orders' }} />
          <Tabs.Screen name="revenue"      options={{ title: 'Revenue' }} />
          <Tabs.Screen name="menu-control" options={{ title: 'Menu' }} />
          <Tabs.Screen name="hours"        options={{ title: 'Hours' }} />
          <Tabs.Screen name="settings"     options={{ title: 'Settings' }} />
          <Tabs.Screen name="order-detail" options={{ title: 'Order', href: null }} />
        </Tabs>
      </View>

      {/* Global overlay — shows on top of ANY tab */}
      <NewOrderAlert
        order={isAlarming ? pendingOrder : null}
        onDismiss={handleAlarmDismiss}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:           1,
    flexDirection:  'row',
    backgroundColor: theme.colors.palace.black,
  },

  // Sidebar
  sidebar: {
    width:           100,
    backgroundColor: theme.colors.palace.smoke,
    borderRightWidth: 1,
    borderRightColor: theme.colors.palace.stone,
    alignItems:      'center',
    paddingVertical: 16,
  },
  logoArea: {
    alignItems:   'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.palace.stone,
    width:        '100%',
    marginBottom: 12,
  },
  logoText: {
    color:    theme.colors.gold.DEFAULT,
    fontSize: 22,
  },
  logoSub: {
    color:         theme.colors.gold.muted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 3,
    marginTop:     2,
  },
  tabList: {
    flex:  1,
    width: '100%',
  },
  tabItem: {
    alignItems:    'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    position:      'relative',
    width:         '100%',
  },
  tabItemActive: {
    backgroundColor: theme.colors.palace.stone,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    color:         theme.colors.gold.muted,
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.5,
    marginTop:     4,
    textAlign:     'center',
  },
  tabLabelActive: {
    color: theme.colors.gold.DEFAULT,
  },
  activeIndicator: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           3,
    backgroundColor: theme.colors.gold.DEFAULT,
    borderTopRightRadius:    2,
    borderBottomRightRadius: 2,
  },

  // Content
  content: {
    flex: 1,
  },
  roleArea: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.palace.stone,
    paddingTop:     12,
    width:          '100%',
    alignItems:     'center',
  },
  roleText: {
    color:         theme.colors.gold.muted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 2,
  },
})
