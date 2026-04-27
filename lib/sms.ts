import { Order } from './types';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL;

export async function sendOrderSMS(payload: {
  to:   string,
  type: 'ready' | 'activated' | 'adjusted_time' | 'confirmed' | 'reservation_reminder',
  data: {
    orderId:      string,
    customerName: string,
    tableNumber?: string,
    extraMinutes?: number,
    estimatedTime?: number,
    guestCount?:  number,
    formattedTime?: string,
  }
}) {
  try {
    console.log(`[SMS] Sending ${payload.type} to ${payload.to}`, payload.data);
    
    // In a real scenario, this hits the website's API which handles Twilio/etc.
    const response = await fetch(`${WEBSITE_URL}/api/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('[SMS] API returned error:', await response.text());
    }
  } catch (err) {
    console.error('[SMS] Failed to send:', err);
  }
}
