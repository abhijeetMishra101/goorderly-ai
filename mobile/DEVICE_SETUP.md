# Physical Device Setup Guide

When running the Flutter app on a **physical iPhone**, you need to use your Mac's local IP address instead of `localhost`.

## Why?

- `localhost` on a physical device refers to the **device itself**, not your Mac
- Your Mac's backend server is running on a different machine
- You need to use your Mac's **local network IP address**

## Find Your Mac's IP Address

Run this command in Terminal:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
```

Or check in System Settings:
1. System Settings → Network
2. Select your active connection (Wi-Fi or Ethernet)
3. Your IP address is shown (e.g., `192.168.29.220`)

## Update Configuration

### Option 1: Use Default (Already Configured)

The app is already configured to use `192.168.29.220` as the default. If your IP changes, update `lib/config/app_config.dart`.

### Option 2: Use Environment Variable

Run the app with a custom IP:

```bash
flutter run -d 00008140-000038C82608801C \
  --dart-define=API_BASE_URL=http://YOUR_MAC_IP:3000 \
  --dart-define=FRONTEND_URL=http://YOUR_MAC_IP:3001
```

Replace `YOUR_MAC_IP` with your actual Mac IP address.

## Ensure Backend is Accessible

1. **Make sure your backend is running:**
   ```bash
   cd /Users/abhijeetmishra/Developer/goorderly-ai
   npm run dev
   ```

2. **Check firewall settings:**
   - System Settings → Network → Firewall
   - Make sure Node.js/backend can accept connections

3. **Verify both devices are on the same network:**
   - iPhone and Mac must be on the same Wi-Fi network

## Test Connection

From your iPhone, open Safari and try:
```
http://192.168.29.220:3000/api/health
```

If you see a response, the connection works!

## Troubleshooting

### "Can't connect to server"
- Verify Mac and iPhone are on the same Wi-Fi network
- Check Mac's firewall settings
- Verify backend is running (`npm run dev`)
- Try pinging the Mac IP from iPhone (not directly possible, but helps verify network)

### IP Address Changed
- Your Mac's IP may change when you reconnect to Wi-Fi
- Update `app_config.dart` or use `--dart-define` flag
- Or set a static IP in your router settings

### Still Not Working?
1. Check backend logs for connection attempts
2. Verify port 3000 is not blocked
3. Try accessing from Mac's browser: `http://192.168.29.220:3000`
4. Check if backend CORS allows your iPhone's IP

