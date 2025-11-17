# Remove ngrok Browser Warning

## Quick Fix: Add ngrok Authtoken

The blank page you're seeing is ngrok's browser warning. To remove it:

### Step 1: Sign up for free ngrok account
1. Go to: https://dashboard.ngrok.com/signup
2. Sign up with your email (free account)

### Step 2: Get your authtoken
1. After signing up, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy your authtoken (looks like: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`)

### Step 3: Configure ngrok
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### Step 4: Restart ngrok
```bash
# Stop current ngrok (Ctrl+C)
# Restart it:
ngrok http 3000 --pooling-enabled
```

**After this, the browser warning will be gone!**

## Alternative: Manual Click-Through

If you don't want to sign up:
1. When you see the blank/warning page, look for a "Visit Site" or "Continue" button
2. Click it
3. The OAuth flow should continue

## Test After Setup

1. Restart backend: `npm run dev`
2. Run Flutter app: `flutter run -d 00008140-000038C82608801C`
3. Tap "Sign in with Google"
4. Should redirect to Google login (no warning page)

