# Quick Start Guide

## Prerequisites Check

1. **Flutter SDK installed?**
   ```bash
   flutter --version
   ```
   If not installed: https://flutter.dev/docs/get-started/install

2. **Backend running?**
   ```bash
   # In project root
   npm run dev
   ```
   Backend should be on `http://localhost:3000`

## Setup Steps

1. **Navigate to mobile directory**
   ```bash
   cd mobile
   ```

2. **Get Flutter dependencies**
   ```bash
   flutter pub get
   ```

3. **Run the app**
   ```bash
   # iOS
   flutter run -d ios
   
   # Android
   flutter run -d android
   
   # Web (secondary)
   flutter run -d chrome
   ```

## First Run

1. **Login** - Tap "Continue with Google"
2. **Select Template** - Choose your journal template
3. **Confirm Setup** - Set preferences and confirm
4. **Test Voice** - Tap "Start Recording" (should work much better than web!)

## Troubleshooting

### "Command not found: flutter"
- Install Flutter SDK first
- Add to PATH if needed

### Build errors
- Run `flutter clean && flutter pub get`
- For iOS: `cd ios && pod install`

### OAuth not working
- Check backend is running
- Verify callback URL in backend matches app scheme

### Voice not working
- Grant microphone permission when prompted
- Test on physical device (simulator may have limitations)

## What's Different from Web?

✅ **Native speech recognition** - No more network errors!
✅ **Better mobile UX** - Optimized for touch
✅ **Offline support** - Speech recognition works offline
✅ **Better permissions** - Native permission handling

