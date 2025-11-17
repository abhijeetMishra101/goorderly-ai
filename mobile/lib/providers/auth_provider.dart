// lib/providers/auth_provider.dart

import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/oauth_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiClient apiClient;
  final OAuthService oauthService;

  User? _user;
  bool _isLoading = true;
  bool _needsOnboarding = false;

  AuthProvider(this.apiClient, this.oauthService) {
    _initialize();
  }

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  bool get needsOnboarding => _needsOnboarding;

  Future<void> _initialize() async {
    try {
      final token = await apiClient.getToken();
      if (token != null) {
        await _loadUser();
        await _checkOnboardingStatus();
      }
    } catch (e) {
      // Not authenticated
      _user = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadUser() async {
    try {
      final response = await apiClient.getMe();
      _user = User.fromJson(response);
      notifyListeners();
    } catch (e) {
      _user = null;
      await apiClient.setToken(null);
    }
  }

  Future<void> _checkOnboardingStatus() async {
    try {
      final response = await apiClient.getOnboardingStatus();
      _needsOnboarding = !(response['data']?['isComplete'] ?? false);
      notifyListeners();
    } catch (e) {
      // Assume needs onboarding if check fails
      _needsOnboarding = true;
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      _isLoading = true;
      notifyListeners();

      await oauthService.signInWithGoogle();
      await _loadUser();
      await _checkOnboardingStatus();
    } catch (e) {
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await apiClient.logout();
      _user = null;
      _needsOnboarding = false;
      notifyListeners();
    } catch (e) {
      // Even if logout fails, clear local state
      _user = null;
      _needsOnboarding = false;
      await apiClient.setToken(null);
      notifyListeners();
    }
  }

  Future<void> refreshUser() async {
    await _loadUser();
    await _checkOnboardingStatus();
  }
}

