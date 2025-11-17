# Google OAuth with Physical Device - Solution

## Problem
Google OAuth **does not allow IP addresses** (like `192.168.29.220`) in redirect URIs for security reasons. They only allow:
- `localhost` or `127.0.0.1` (for local development)
- Actual domain names (for production)

## Solutions

### Option 1: Use ngrok (Recommended for Testing)

Create a public tunnel to your local backend:

1. **Install ngrok** (if not already installed):
   ```bash
   brew install ngrok
   ```

2. **Start your backend**:
   ```bash
   npm run dev
   ```

3. **Create ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

5. **Update `.env`**:
   ```env
   GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.app/api/auth/google/callback
   FRONTEND_URL=https://abc123.ngrok-free.app
   ```

6. **Update Google Cloud Console**:
   - **Authorized JavaScript origins**: `https://abc123.ngrok-free.app`
   - **Authorized redirect URIs**: `https://abc123.ngrok-free.app/api/auth/google/callback`

7. **Update Flutter app config** (`mobile/lib/config/app_config.dart`):
   ```dart
   static const String apiBaseUrl = 'https://abc123.ngrok-free.app';
   ```

### Option 2: Use Local Domain Name (Advanced)

Map a local domain to your IP:

1. **Edit `/etc/hosts`** (requires sudo):
   ```bash
   sudo nano /etc/hosts
   ```
   Add:
   ```
   192.168.29.220  goorderly.local
   ```

2. **Update `.env`**:
   ```env
   GOOGLE_REDIRECT_URI=http://goorderly.local:3000/api/auth/google/callback
   FRONTEND_URL=http://goorderly.local:3001
   ```

3. **Update Google Cloud Console**:
   - **Authorized JavaScript origins**: `http://goorderly.local:3000`
   - **Authorized redirect URIs**: `http://goorderly.local:3000/api/auth/google/callback`

4. **On iPhone**: You'll need to access via `goorderly.local` (may require additional setup)

### Option 3: Test on Simulator Only

For now, test OAuth only on iOS Simulator (which can use localhost):

1. Keep localhost in `.env`
2. Test OAuth on simulator: `flutter run -d "iPad Pro 13-inch (M4)"`
3. For physical device testing, use Option 1 (ngrok)

## Recommended: Use ngrok

This is the easiest solution for testing on physical devices.

### Quick Setup:

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Copy the https URL from ngrok (e.g., https://abc123.ngrok-free.app)
# Update .env and Google Console with this URL
# Restart backend
```

## Important Sections in Google Console

1. **Authorized JavaScript origins** (no path):
   - `http://localhost:3000`
   - `https://your-ngrok-url.ngrok-free.app` (if using ngrok)

2. **Authorized redirect URIs** (with path):
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-ngrok-url.ngrok-free.app/api/auth/google/callback` (if using ngrok)

**Note**: You were trying to add a redirect URI to JavaScript origins - that's why you got the error!

