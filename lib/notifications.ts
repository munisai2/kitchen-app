import { Order } from './types';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL;

export interface NotificationPayload {
  customerEmail?: string;
  customerPhone?: string;
  type: 'ready' | 'adjusted_time' | 'adjusted_price' | 'confirmed' | 'reservation_reminder' | 'cancelled';
  data: {
    orderId:      string;
    customerName: string;
    tableNumber?: string;
    extraMinutes?: number;
    estimatedTime?: number;
    guestCount?:  number;
    formattedTime?: string;
    items?: any[];
    subtotal?: number;
    tax?: number;
    total?: number;
    specialRequests?: string;
    placedAt?: string;
    logoUrl?: string | null;
    newTotal?: number;
    reason?: string;
    scheduledTime?: string | null;
    discountAmount?: number;
    adjustmentReason?: string;
    promoCode?: string;
    promoDiscount?: number;
    kitchenMessage?: string;
  };
}

export async function sendOrderEmail(payload: NotificationPayload): Promise<void> {
  const { customerEmail, type, data } = payload;

  if (!customerEmail) {
    console.warn(`[email] No customer email for order ${data.orderId} — skipping notification`);
    return;
  }

  try {
    console.log(`[email] Sending ${type} notification to ${customerEmail} for order ${data.orderId}`);
    console.log(`[email] Data Payload:`, JSON.stringify(data, null, 2));
    
    let endpoint = '';
    let body: any = {};

    switch (type) {
      case 'confirmed':
        endpoint = '/api/send-receipt';
        body = {
          email:         customerEmail,
          orderId:       data.orderId,
          customerName:  data.customerName,
          orderType:     data.tableNumber ? 'dine-in' : 'pickup',
          tableNumber:   data.tableNumber,
          items:         data.items || [],
          subtotal:      data.subtotal || 0,
          tax:           data.tax || 0,
          total:         data.total || 0,
          specialRequests: data.specialRequests,
          placedAt:      data.placedAt || new Date().toISOString(),
          logoUrl:       data.logoUrl,
          estimatedTime: data.estimatedTime,
          discountAmount:    data.discountAmount,
          adjustmentReason:  data.adjustmentReason,
          promoCode:         data.promoCode,
          promoDiscount:     data.promoDiscount,
          kitchenMessage:    data.kitchenMessage,
        };
        break;

      case 'adjusted_time':
        endpoint = '/api/send-adjustment-email';
        body = {
          email:          customerEmail,
          orderId:        data.orderId,
          customerName:   data.customerName,
          type:           'time',
          newValue:       data.estimatedTime,
          logoUrl:        data.logoUrl,
        };
        break;

      case 'adjusted_price':
        endpoint = '/api/send-adjustment-email';
        body = {
          email:          customerEmail,
          orderId:        data.orderId,
          customerName:   data.customerName,
          type:           'price',
          newValue:       data.newTotal,
          reason:         data.reason,
          logoUrl:        data.logoUrl,
        };
        break;

      case 'ready':
        endpoint = '/api/send-adjustment-email';
        body = {
          email:          customerEmail,
          orderId:        data.orderId,
          customerName:   data.customerName || 'Customer',
          type:           'ready',
          newValue:       'Ready', // Fallback for older API versions that require a value
          discountAmount: data.discountAmount,
          adjustmentReason: data.adjustmentReason,
          promoCode:      data.promoCode,
          promoDiscount:  data.promoDiscount,
          kitchenMessage: data.kitchenMessage,
          logoUrl:        data.logoUrl,
        };
        break;

      case 'reservation_reminder':
        endpoint = '/api/send-adjustment-email';
        body = {
          email:          customerEmail,
          orderId:        data.orderId,
          customerName:   data.customerName,
          type:           'reservation_reminder',
          newValue:       data.formattedTime || data.scheduledTime,
          logoUrl:        data.logoUrl,
        };
        break;

      case 'cancelled':
        endpoint = '/api/send-cancellation-email';
        body = {
          email:        customerEmail,
          orderId:      data.orderId,
          customerName: data.customerName,
          reason:       data.reason,
          items:        data.items || [],
          total:        data.total || 0,
          logoUrl:      data.logoUrl,
        };
        break;

      default:
        console.warn(`[email] Unknown notification type: ${type}`);
        return;
    }

    const response = await fetch(`${WEBSITE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn('[email] API returned error:', await response.text());
    } else {
      console.log(`[email] Notification sent for order ${data.orderId}`);
    }
  } catch (err) {
    console.error('[email] Failed to send:', err);
  }
}
