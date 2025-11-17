// lib/services/oauth_service.dart

import 'package:flutter_web_auth/flutter_web_auth.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io' show Platform;
import '../config/app_config.dart';
import 'api_client.dart';

class OAuthService {
  final ApiClient apiClient;

  OAuthService(this.apiClient);

  /// Initiate OAuth flow
  /// Returns JWT token on success
  Future<String> signInWithGoogle() async {
    final authUrl = apiClient.getAuthUrl();

    try {
      // Use flutter_web_auth for mobile OAuth
      final result = await FlutterWebAuth.authenticate(
        url: authUrl,
        callbackUrlScheme: _getCallbackScheme(),
        preferEphemeral: false, // Keep session for better UX
      );

      // Extract token from callback URL
      final uri = Uri.parse(result);
      final token = uri.queryParameters['token'];
      final error = uri.queryParameters['error'];

      if (error != null) {
        throw OAuthException('OAuth error: $error');
      }

      if (token == null || token.isEmpty) {
        throw OAuthException('No token received from OAuth callback');
      }

      // Store token
      await apiClient.setToken(token);

      return token;
    } catch (e) {
      if (e is OAuthException) {
        rethrow;
      }
      throw OAuthException('OAuth failed: ${e.toString()}');
    }
  }

  /// Get callback URL scheme based on platform
  String _getCallbackScheme() {
    if (Platform.isIOS) {
      return 'goorderlyai';
    } else if (Platform.isAndroid) {
      return 'goorderlyai'; // Use same scheme for both platforms
    } else {
      // Web - use http/https
      return Uri.parse(AppConfig.frontendUrl).scheme;
    }
  }

  /// Alternative: Open OAuth URL in browser (for web or fallback)
  Future<void> openOAuthUrl() async {
    final authUrl = apiClient.getAuthUrl();
    final uri = Uri.parse(authUrl);
    
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      throw OAuthException('Cannot launch OAuth URL');
    }
  }
}

class OAuthException implements Exception {
  final String message;

  OAuthException(this.message);

  @override
  String toString() => message;
}

