export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'scheduled'

export interface OrderItem {
  name:     string
  quantity: number
  price:    number
}

export interface Order {
  _id:              string
  orderId:          string
  status:           OrderStatus
  customerName:     string
  customerPhone:    string
  customerEmail?:   string
  orderType:        'pickup' | 'dine-in' | 'reservation'
  items:            OrderItem[]
  subtotal:         number
  tax:              number
  total:            number
  discountAmount?:  number
  estimatedTime?:   number
  kitchenMessage?:  string
  specialRequests?: string
  placedAt:         string
  scheduledTime?:   string
  tableNumber?:     string
  notes?:           string
  busyTimeAdded?:   number
  guestCount?:      number
  reservationTime?: string
  promoCode?:       string
  promoDiscount?:   number
}

export interface MenuItem {
  _id:         string
  name:        string
  category:    string
  price:       number
  isAvailable: boolean
}

export type UserRole = 'chef' | 'cashier' | 'manager' | 'owner'

export interface KitchenSettings {
  _id:          string
  chefPin:      string
  cashierPin:   string
  managerPin:   string
  ownerPin:     string
  alarmEnabled: boolean
  alarmVolume:  number
}

export interface OpeningHours {
  _key?: string
  days: string
  hours: string
  isClosed: boolean
}
