# GoOrderly.ai Mobile App

Flutter mobile application for GoOrderly.ai - Voice-powered journaling assistant.

## Prerequisites

1. **Install Flutter SDK**
   - Visit: https://flutter.dev/docs/get-started/install
   - Verify installation: `flutter doctor`

2. **Install Xcode** (for iOS development on Mac)
   - From App Store or Apple Developer

3. **Install Android Studio** (for Android development)
   - Visit: https://developer.android.com/studio

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   flutter pub get
   ```

2. **Configure environment:**
   - Update `lib/config/app_config.dart` with your API URLs
   - Or use environment variables when running:
     ```bash
     flutter run --dart-define=API_BASE_URL=http://your-api-url
     ```

3. **iOS Setup:**
   - Open `ios/Runner.xcworkspace` in Xcode
   - Configure signing & capabilities
   - Add microphone permission to `ios/Runner/Info.plist`:
     ```xml
     <key>NSMicrophoneUsageDescription</key>
     <string>We need microphone access for voice journaling</string>
     ```

4. **Android Setup:**
   - Add permissions to `android/app/src/main/AndroidManifest.xml`:
     ```xml
     <uses-permission android:name="android.permission.RECORD_AUDIO"/>
     <uses-permission android:name="android.permission.INTERNET"/>
     <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
     ```

## Running

```bash
# Run on iOS simulator
flutter run -d ios

# Run on Android emulator
flutter run -d android

# Run on web (secondary support)
flutter run -d chrome

# Run on connected device
flutter devices  # List available devices
flutter run -d <device-id>
```

## Features

- ✅ Native speech recognition (iOS/Android)
- ✅ Google OAuth authentication
- ✅ Template selection
- ✅ Voice journaling
- ✅ Location tagging
- ✅ Journal viewing
- ✅ Web support (secondary)

## Architecture

- **State Management**: Provider
- **API Client**: HTTP-based, reuses existing Node.js backend
- **Speech Recognition**: Native `speech_to_text` plugin
- **Location**: `geolocator` plugin
- **Storage**: `shared_preferences` for tokens

## Development

The app reuses the existing Node.js backend API. No backend changes needed.

Make sure the backend is running on the configured API URL (default: `http://localhost:3000`).

