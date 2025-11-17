// lib/services/tts_service.dart

import 'package:flutter_tts/flutter_tts.dart';

class TtsService {
  final FlutterTts _flutterTts = FlutterTts();
  bool _isInitialized = false;
  bool _isCurrentlySpeaking = false;

  bool get isInitialized => _isInitialized;
  bool get isSpeaking => _isCurrentlySpeaking;

  /// Initialize text-to-speech service
  Future<bool> initialize() async {
    if (_isInitialized) return true;

    await _flutterTts.setLanguage("en-US");
    await _flutterTts.setSpeechRate(0.5); // Normal speech rate
    await _flutterTts.setVolume(1.0);
    await _flutterTts.setPitch(1.0);

    // Set up completion handler to track speaking state
    _flutterTts.completionHandler = () {
      _isCurrentlySpeaking = false;
    };

    _isInitialized = true;
    return true;
  }

  /// Speak the given text
  Future<void> speak(String text) async {
    if (!_isInitialized) {
      await initialize();
    }
    // Stop any ongoing speech first
    await _flutterTts.stop();
    _isCurrentlySpeaking = true;
    await _flutterTts.speak(text);
  }

  /// Stop speaking
  Future<void> stop() async {
    await _flutterTts.stop();
    _isCurrentlySpeaking = false;
  }

  /// Set completion handler
  void setCompletionHandler(Function() onComplete) {
    _flutterTts.completionHandler = () {
      _isCurrentlySpeaking = false;
      onComplete();
    };
  }

  /// Wait for speech to complete
  Future<void> waitForCompletion() async {
    while (_isCurrentlySpeaking) {
      await Future.delayed(const Duration(milliseconds: 100));
    }
  }
}

