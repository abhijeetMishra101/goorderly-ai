// lib/config/app_config.dart

class AppConfig {
  // API Configuration
  // For physical devices, use ngrok URL (or Mac's local IP address)
  // Option 1: Update defaultValue below with your ngrok URL
  // Option 2: Use --dart-define=API_BASE_URL=https://your-ngrok-url.ngrok-free.app when running
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://sciatic-deegan-nonobligatorily.ngrok-free.dev',
  );
  
  static const String frontendUrl = String.fromEnvironment(
    'FRONTEND_URL',
    defaultValue: 'https://sciatic-deegan-nonobligatorily.ngrok-free.dev',
  );
  
  // OAuth Configuration
  static String get oauthCallbackUrl => '$frontendUrl/auth/callback';
  
  // App Information
  static const String appName = 'GoOrderly.ai';
  static const String appVersion = '1.0.0';
  
  // Feature Flags
  static const bool enableLocationServices = true;
  static const bool enableOfflineMode = false; // Future feature
}

