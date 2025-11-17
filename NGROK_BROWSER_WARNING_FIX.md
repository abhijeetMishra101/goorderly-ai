# Fix ngrok Browser Warning (403 Error)

## Problem
ngrok free tier shows a browser warning page that blocks requests. You're seeing a blank page or 403 error.

## Solution 1: Bypass ngrok Warning (Quick Fix)

When you see the ngrok warning page:
1. Click "Visit Site" or "Continue" button
2. The page should then load

## Solution 2: Use ngrok Authtoken (Recommended)

1. **Sign up for free ngrok account**: https://dashboard.ngrok.com/signup
2. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
4. **Restart ngrok**: The warning page will be gone

## Solution 3: Update Flutter to Handle ngrok Warning

The Flutter app needs to handle the ngrok warning page. We can:
1. Add a header to bypass warning: `ngrok-skip-browser-warning: true`
2. Or use a different approach for OAuth

## Current Issue

The blank page you're seeing is likely:
1. ngrok browser warning page (needs "Visit Site" click)
2. Or the OAuth redirect isn't working properly

## Quick Test

Try accessing this URL directly in Safari on iPhone:
```
https://sciatic-deegan-nonobligatorily.ngrok-free.dev/api/auth/google
```

If you see a warning page, click "Visit Site" and it should redirect to Google login.

