# How to Update Flutter App Config

## Option 1: Update Default Value in Code (Permanent)

Edit `mobile/lib/config/app_config.dart`:

```dart
static const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://YOUR_NGROK_URL.ngrok-free.app', // Replace with your ngrok URL
);
```

**Pros**: Always uses the ngrok URL by default
**Cons**: Need to update code if ngrok URL changes

## Option 2: Use Environment Variable (Flexible - Recommended)

Keep the code as-is, and run Flutter with:

```bash
flutter run -d 00008140-000038C82608801C \
  --dart-define=API_BASE_URL=https://YOUR_NGROK_URL.ngrok-free.app
```

**Pros**: Easy to change without editing code
**Cons**: Need to remember to add the flag each time

## Option 3: Create a Script (Best for Development)

Create `mobile/run_dev.sh`:

```bash
#!/bin/bash
NGROK_URL="https://YOUR_NGROK_URL.ngrok-free.app"
flutter run -d 00008140-000038C82608801C \
  --dart-define=API_BASE_URL=$NGROK_URL
```

Then run: `bash mobile/run_dev.sh`

## Current Config File Location

`mobile/lib/config/app_config.dart`

