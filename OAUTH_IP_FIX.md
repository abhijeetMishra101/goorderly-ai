# Fix OAuth Redirect for iPhone Access

## Problem
After OAuth login on iPhone, you're being redirected to `localhost` which doesn't work on physical devices.

## Solution

### 1. Update `.env` File

Add or update these lines in your `.env` file:

```env
# Use your Mac's IP address instead of localhost
FRONTEND_URL=http://192.168.29.220:3001
GOOGLE_REDIRECT_URI=http://192.168.29.220:3000/api/auth/google/callback
```

**To find your Mac's IP address:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
```

### 2. Update Google Cloud Console OAuth Settings

**CRITICAL:** You must add your Mac's IP address to Google OAuth authorized redirect URIs:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   http://192.168.29.220:3000/api/auth/google/callback
   ```
4. **Also keep** the localhost one for local development:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
5. Click **Save**

### 3. Restart Backend

After updating `.env`:
```bash
# Stop current backend (Ctrl+C)
npm run dev
```

### 4. Verify

Test from iPhone Safari:
```
http://192.168.29.220:3000/api/auth/google
```

You should be redirected to Google login, and after login, redirected back to your app (not localhost).

## Important Notes

1. **IP Address Changes**: If your Mac's IP changes (e.g., reconnecting to Wi-Fi), update:
   - `.env` file
   - Google Cloud Console redirect URI
   - Flutter app config (`mobile/lib/config/app_config.dart`)

2. **For Production**: Use your actual domain name, not IP addresses

3. **Both URIs**: Keep both localhost and IP redirect URIs in Google Console for flexibility

## Current Configuration

- **Mac IP**: `192.168.29.220`
- **Backend Port**: `3000`
- **Frontend Port**: `3001`
- **OAuth Callback**: `http://192.168.29.220:3000/api/auth/google/callback`

