// lib/services/api_client.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class ApiClient {
  final String baseUrl;
  String? _token;

  ApiClient({String? baseUrl})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  Future<void> _loadToken() async {
    if (_token == null) {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString('auth_token');
    }
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  Future<String?> getToken() async {
    await _loadToken();
    return _token;
  }

  Future<Map<String, dynamic>> request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    await _loadToken();

    final url = Uri.parse('$baseUrl$endpoint');
    final requestHeaders = <String, String>{
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
      ...?headers,
    };

    http.Response response;

    try {
      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(url, headers: requestHeaders);
          break;
        case 'POST':
          response = await http.post(
            url,
            headers: requestHeaders,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            url,
            headers: requestHeaders,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(url, headers: requestHeaders);
          break;
        default:
          throw Exception('Unsupported HTTP method: $method');
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return data;
      } else {
        throw ApiException(
          message: data['error'] as String? ?? 'HTTP error! status: ${response.statusCode}',
          statusCode: response.statusCode,
          details: data['details'],
        );
      }
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException(
        message: e.toString(),
        statusCode: 0,
      );
    }
  }

  // Auth endpoints
  String getAuthUrl() {
    // Add ngrok skip browser warning parameter for free tier
    final url = '$baseUrl/api/auth/google';
    if (baseUrl.contains('ngrok-free.dev') || baseUrl.contains('ngrok-free.app')) {
      return '$url?ngrok-skip-browser-warning=true';
    }
    return url;
  }

  Future<Map<String, dynamic>> getMe() async {
    return await request('/api/auth/me');
  }

  Future<Map<String, dynamic>> logout() async {
    final result = await request('/api/auth/logout', method: 'POST');
    await setToken(null);
    return result;
  }

  // Template endpoints
  Future<Map<String, dynamic>> getTemplates() async {
    return await request('/api/templates');
  }

  Future<Map<String, dynamic>> getTemplate(int id) async {
    return await request('/api/templates/$id');
  }

  // Onboarding endpoints
  Future<Map<String, dynamic>> getOnboardingStatus() async {
    return await request('/api/onboarding/status');
  }

  Future<Map<String, dynamic>> selectTemplate(int templateId) async {
    return await request(
      '/api/onboarding/select-template',
      method: 'POST',
      body: {'templateId': templateId},
    );
  }

  Future<Map<String, dynamic>> confirmOnboarding(
    int templateId,
    Map<String, dynamic> preferences,
  ) async {
    return await request(
      '/api/onboarding/confirm',
      method: 'POST',
      body: {
        'templateId': templateId,
        'preferences': preferences,
      },
    );
  }

  // Journal endpoints
  Future<Map<String, dynamic>> getJournal(String date) async {
    return await request('/api/journal/$date');
  }

  Future<Map<String, dynamic>> createJournal({String? date}) async {
    return await request(
      '/api/journal/create',
      method: 'POST',
      body: date != null ? {'date': date} : {},
    );
  }

  Future<Map<String, dynamic>> logVoiceEntry({
    required String text,
    DateTime? timestamp,
    double? lat,
    double? lng,
    String? context,
  }) async {
    return await request(
      '/api/journal/voice-entry',
      method: 'POST',
      body: {
        'text': text,
        if (timestamp != null) 'timestamp': timestamp.toIso8601String(),
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        if (context != null) 'context': context,
      },
    );
  }

  Future<String> getJournalContent(String journalId) async {
    await _loadToken();

    final url = Uri.parse('$baseUrl/api/journal/$journalId/content');
    final requestHeaders = <String, String>{
      if (_token != null) 'Authorization': 'Bearer $_token',
    };

    final response = await http.get(url, headers: requestHeaders);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body;
    } else {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(
        message: data['error'] as String? ?? 'HTTP error! status: ${response.statusCode}',
        statusCode: response.statusCode,
        details: data['details'],
      );
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final dynamic details;

  ApiException({
    required this.message,
    required this.statusCode,
    this.details,
  });

  @override
  String toString() => message;
}

