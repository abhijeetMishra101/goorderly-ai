# Flutter Mobile App Setup Guide

## Prerequisites

1. **Install Flutter SDK**
   ```bash
   # Visit https://flutter.dev/docs/get-started/install
   # Or use Homebrew on Mac:
   brew install --cask flutter
   ```

2. **Verify Installation**
   ```bash
   flutter doctor
   ```

3. **Install Xcode** (for iOS - Mac only)
   - From App Store
   - Or download from Apple Developer

4. **Install Android Studio** (for Android)
   - Download from https://developer.android.com/studio
   - Install Android SDK and emulator

## Initial Setup

1. **Install Flutter SDK** (if not already installed)
   ```bash
   # Visit https://flutter.dev/docs/get-started/install
   # Or on Mac:
   brew install --cask flutter
   
   # Verify installation
   flutter doctor
   ```

2. **Initialize Flutter Project** (if needed)
   ```bash
   cd mobile
   
   # If the project structure is incomplete, run:
   # flutter create . --platforms=ios,android,web
   # (This will create missing platform files)
   ```

3. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Configure API URL** (if different from default)
   - Edit `lib/config/app_config.dart`
   - Or use environment variable:
     ```bash
     flutter run --dart-define=API_BASE_URL=http://your-api-url:3000
     ```

## Running the App

### iOS

1. **Open iOS Simulator**
   ```bash
   open -a Simulator
   ```

2. **Run the app**
   ```bash
   flutter run -d ios
   ```

   Or specify a device:
   ```bash
   flutter devices  # List available devices
   flutter run -d <device-id>
   ```

### Android

1. **Start Android Emulator**
   - Open Android Studio
   - Tools → Device Manager → Start emulator

2. **Run the app**
   ```bash
   flutter run -d android
   ```

### Web (Secondary Support)

```bash
flutter run -d chrome
```

## Platform-Specific Configuration

### iOS Configuration

1. **Open Xcode project**
   ```bash
   open ios/Runner.xcworkspace
   ```

2. **Configure Signing**
   - Select Runner target
   - Signing & Capabilities tab
   - Select your development team
   - Enable "Automatically manage signing"

3. **Permissions are already configured** in `ios/Runner/Info.plist`:
   - Microphone permission
   - Location permission
   - OAuth URL scheme

### Android Configuration

1. **Update package name** (if needed)
   - Edit `android/app/build.gradle`
   - Change `applicationId`

2. **Permissions are already configured** in `android/app/src/main/AndroidManifest.xml`:
   - Internet permission
   - Microphone permission
   - Location permissions
   - OAuth intent filter

## OAuth Configuration

The app uses `flutter_web_auth` for OAuth. The callback URL scheme is:
- iOS: `goorderlyai://`
- Android: `goorderlyai://`

Make sure your backend OAuth callback URL matches:
- Development: `http://localhost:3001/auth/callback`
- The app will intercept the callback and extract the token

## Testing

1. **Make sure backend is running**
   ```bash
   # In project root
   npm run dev
   ```

2. **Run Flutter app**
   ```bash
   cd mobile
   flutter run
   ```

3. **Test flow:**
   - Login with Google OAuth
   - Select template
   - Confirm preferences
   - Test voice recording
   - Create journal
   - Log voice entry

## Troubleshooting

### "Command not found: flutter"
- Install Flutter SDK
- Add to PATH: `export PATH="$PATH:$HOME/flutter/bin"`

### iOS Build Errors
- Run `cd ios && pod install`
- Clean build: `flutter clean && flutter pub get`

### Android Build Errors
- Update Android SDK
- Check `android/app/build.gradle` for correct SDK versions

### OAuth Not Working
- Check callback URL scheme matches
- Verify backend OAuth redirect URI includes the scheme
- Check browser console for errors

### Speech Recognition Not Working
- Check microphone permission is granted
- Test on physical device (simulator may have limitations)
- Check device settings → Privacy → Microphone

## Building for Release

### iOS
```bash
flutter build ios --release
# Then open Xcode and archive
```

### Android
```bash
flutter build apk --release
# Or for App Bundle:
flutter build appbundle --release
```

## Next Steps

1. Test on physical devices
2. Customize UI/UX
3. Add more features
4. Prepare for App Store/Play Store submission

