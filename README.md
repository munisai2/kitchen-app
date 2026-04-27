# Qasr Kitchen Dashboard

React Native kitchen management app for the Qasr Afghani restaurant tablet.

## Before You Build

### 1. Add an alarm sound

The app plays an alarm when new orders arrive. You need to add an MP3 file:

1. Download a free alarm/beep sound from [freesound.org](https://freesound.org)
   - Search: "alarm beep" or "notification alert"
   - Filter: License → Creative Commons 0 (public domain)
   - Recommended: any short, loud, repeating beep (1-3 seconds loops nicely)
2. Rename it to `alarm.mp3`
3. Place it at: `assets/alarm.mp3`

### 2. Add your Sanity token

1. Go to [sanity.io](https://sanity.io) → Manage → Project `c020lahr`
2. Click **API** → **Tokens** → **Add API Token**
3. Name: "Kitchen App" | Permissions: **Editor**
4. Copy the token
5. Open `.env` and replace `your_editor_token_here` with your token

### 3. Create the kitchenSettings document in Sanity Studio

1. Open your Sanity Studio (or run `npm run dev` in `Qasr-Afghani-restaurant/`)
2. You should see **Kitchen App Settings** in the sidebar
3. Create one document with your desired PINs
4. Default PINs: Chef=1111, Cashier=2222, Manager=3333, Owner=4444
5. **Change these before deploying to staff!**

---

## Development

```bash
npm start             # Start Expo development server
npm run android       # Launch on Android device/emulator
```

---

## Building the APK

### Prerequisites

```bash
npm install -g eas-cli
eas login             # Use your expo.dev account
```

### Build

```bash
eas build --platform android --profile preview
```

This builds in the cloud (~5–10 minutes). You'll get a download link when done.

### Install on Kitchen Tablet

1. Download the `.apk` file to your computer
2. Connect the Android tablet via USB (or send via Google Drive / airdrop)
3. On tablet: **Settings → Security → Unknown Sources → ON**
   - On newer Android: **Settings → Apps → Special App Access → Install Unknown Apps**
4. Open **Files** app → find `qasr-kitchen.apk` → tap to install
5. Open **Qasr Kitchen** from the home screen
6. Enter your PIN to log in
7. The screen will stay on permanently (keep-awake is active)

### Updating the App

```bash
# Make your code changes, then:
eas build --platform android --profile preview
# Download new APK → reinstall on tablet (same process as above)
```

---

## Role Permissions

| Screen         | Chef | Cashier | Manager | Owner |
|----------------|:----:|:-------:|:-------:|:-----:|
| Kitchen        | ✅   | ✅      | ✅      | ✅    |
| Orders History | —    | ✅      | ✅      | ✅    |
| Revenue        | —    | —       | ✅      | ✅    |
| Menu Control   | —    | —       | ✅      | ✅    |
| Settings       | —    | —       | —       | ✅    |

---

## Architecture

```
qasr-kitchen/
├── app/
│   ├── _layout.tsx          # Root layout, keep-awake
│   ├── index.tsx            # PIN login screen
│   └── (dashboard)/
│       ├── _layout.tsx      # Left-side tab bar
│       ├── kitchen.tsx      # Main order display (3 columns)
│       ├── orders.tsx       # Order history
│       ├── revenue.tsx      # Revenue dashboard
│       ├── menu-control.tsx # Toggle item availability
│       └── settings.tsx     # PINs, alarm, sign out
├── components/              # OrderCard, StatusBadge, TimeAgo, Toast, EmptyState
├── hooks/
│   └── useOrders.ts         # Real-time Sanity listener
├── lib/
│   ├── sanity.ts            # Sanity client
│   ├── queries.ts           # GROQ queries
│   ├── types.ts             # TypeScript types
│   └── store/
│       ├── authStore.ts     # Zustand auth
│       └── alarmStore.ts    # Zustand alarm state
├── constants/
│   └── theme.ts             # Color constants
└── assets/
    └── alarm.mp3            # ← you must add this!
```
