// All active orders (new + preparing + ready)
export const activeOrdersQuery = `
  *[_type == "order" && (status in ["new","preparing","ready"] || (status == "scheduled" && (scheduledTime != null || reservationTime != null)))]
  | order(placedAt desc) {
    _id, orderId, status, customerName, customerPhone, customerEmail,
    orderType, items, subtotal, tax, total, discountAmount,
    specialRequests, placedAt, notes, scheduledTime, estimatedTime,
    tableNumber, guestCount, reservationTime, promoCode, promoDiscount
  }
`

// Orders history (completed/cancelled)
export const ordersHistoryQuery = (limit: number) => `
  *[_type == "order" && status in ["completed","cancelled"]]
  | order(placedAt desc) [0...${limit}] {
    _id, orderId, status, customerName, customerPhone, customerEmail,
    orderType, items, subtotal, tax, total,
    specialRequests, placedAt
  }
`

// Revenue data — all completed orders
export const revenueQuery = `
  *[_type == "order" && status == "completed"]
  | order(placedAt desc) {
    _id, orderId, total, items, placedAt
  }
`

// All menu items for availability control
export const menuItemsQuery = `
  *[_type == "menuItem"] | order(category asc, name asc) {
    _id, name, category, price, isAvailable
  }
`

// Kitchen settings (singleton)
export const kitchenSettingsQuery = `
  *[_type == "kitchenSettings"][0] {
    _id, chefPin, cashierPin, managerPin, ownerPin,
    alarmEnabled, alarmVolume
  }
`

// Restaurant Info (singleton)
export const restaurantInfoQuery = `
  *[_type == "restaurantInfo"][0] {
    _id,
    restaurantStatus,
    openingHours,
    phone,
    logo { asset->{ url } }
  }
`

