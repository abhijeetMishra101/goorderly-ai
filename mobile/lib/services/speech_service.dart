// lib/services/speech_service.dart

import 'dart:async';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:permission_handler/permission_handler.dart';

class SpeechService {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isInitialized = false;
  bool _isListening = false;
  Timer? _wakeWordTimeoutTimer; // Track timeout timer for wake word detection

  bool get isInitialized => _isInitialized;
  bool get isListening => _isListening;

  /// Initialize speech recognition service
  Future<bool> initialize() async {
    if (_isInitialized) return true;

    // Ensure microphone permission
    var micStatus = await Permission.microphone.status;
    if (micStatus.isDenied || micStatus.isRestricted) {
      micStatus = await Permission.microphone.request();
    }
    if (micStatus.isPermanentlyDenied) {
      throw SpeechException(
        'Microphone permission permanently denied. Enable it in Settings → GoOrderly.ai → Microphone.',
      );
    }
    if (!micStatus.isGranted) {
      throw SpeechException('Microphone permission denied.');
    }

    // Ensure speech recognition permission (iOS)
    var speechStatus = await Permission.speech.status;
    if (speechStatus.isDenied || speechStatus.isRestricted) {
      speechStatus = await Permission.speech.request();
    }
    if (speechStatus.isPermanentlyDenied) {
      throw SpeechException(
        'Speech recognition permission permanently denied. Enable it in Settings → GoOrderly.ai → Speech Recognition.',
      );
    }

    // Initialize speech recognition
    final available = await _speech.initialize(
      onError: (error) {
        throw SpeechException('Speech recognition error: ${error.errorMsg}');
      },
      onStatus: (status) {
        // Handle status changes if needed
      },
    );

    _isInitialized = available;
    return available;
  }

  /// Start listening for speech
  /// Returns the recognized text when speech is complete
  Future<String?> startListening({
    String localeId = 'en_US',
    stt.ListenMode listenMode = stt.ListenMode.confirmation,
    bool partialResults = false,
  }) async {
    return startListeningWithLevels(
      localeId: localeId,
      listenMode: listenMode,
      partialResults: partialResults,
    );
  }

  /// Start listening with sound level monitoring
  /// Returns the recognized text when speech is complete
  /// Optionally provides partial results via callback for real-time display
  Future<String?> startListeningWithLevels({
    String localeId = 'en_US',
    stt.ListenMode listenMode = stt.ListenMode.confirmation,
    bool partialResults = false,
    Function(double level)? onSoundLevelChange,
    Function(String partialText)? onPartialResult,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_isListening) {
      await stopListening();
    }

    final completer = Completer<String?>();
    String? finalText;
    String? partialText;

    await _speech.listen(
      onResult: (result) {
        if (result.finalResult) {
          finalText = result.recognizedWords;
          if (!completer.isCompleted) {
            completer.complete(finalText);
          }
        } else if (partialResults) {
          // Store partial results for real-time display
          final recognizedText = result.recognizedWords;
          if (recognizedText.isNotEmpty) {
            partialText = recognizedText;
            onPartialResult?.call(recognizedText);
          }
        }
      },
      onSoundLevelChange: (level) {
        // Convert to RMS (0.0 to 1.0 range)
        // Level is typically in dB range -50 to 0
        final normalizedLevel = (level + 50) / 50; // Normalize from -50 to 0 dB
        final rms = normalizedLevel.clamp(0.0, 1.0);
        onSoundLevelChange?.call(rms);
      },
      localeId: localeId,
      listenOptions: stt.SpeechListenOptions(
        listenMode: listenMode,
        partialResults: partialResults,
        cancelOnError: true,
      ),
      pauseFor: const Duration(seconds: 5), // Increased from 3 to 5 seconds - allows for natural pauses
      listenFor: const Duration(seconds: 30), // Max 30 seconds
    );

    _isListening = true;

    try {
      return await completer.future.timeout(
        const Duration(seconds: 35),
        onTimeout: () {
          stopListening();
          return finalText;
        },
      );
    } catch (e) {
      await stopListening();
      if (finalText != null && finalText!.isNotEmpty) {
        return finalText;
      }
      rethrow;
    }
  }

  /// Stop listening
  Future<void> stopListening() async {
    if (_isListening) {
      await _speech.stop();
      _isListening = false;
    }
    // Cancel timeout timer if it exists
    _wakeWordTimeoutTimer?.cancel();
    _wakeWordTimeoutTimer = null;
  }

  /// Cancel listening
  Future<void> cancel() async {
    if (_isListening) {
      await _speech.cancel();
      _isListening = false;
    }
  }

  /// Check if speech recognition is available
  Future<bool> isAvailable() async {
    if (!_isInitialized) {
      await initialize();
    }
    return _isInitialized;
  }

  /// Get available locales
  Future<List<dynamic>> getAvailableLocales() async {
    if (!_isInitialized) {
      await initialize();
    }
    return await _speech.locales();
  }

  /// Start continuous listening for wake word detection
  /// Calls onWakeWordDetected when "Hey Goorderly" is detected
  /// Calls onTimeout when listening times out (doesn't auto-restart)
  Future<void> startWakeWordDetection({
    Function()? onWakeWordDetected,
    Function()? onTimeout,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_isListening) {
      await stopListening();
    }

    print('Wake word detection: Setting up speech recognition...');
    
    await _speech.listen(
      onResult: (result) {
        final text = result.recognizedWords.toLowerCase().trim();
        print('Wake word detection: Heard: "$text" (final: ${result.finalResult})');
        
        // More flexible wake word detection
        // Check for key words that indicate the wake phrase
        final normalizedText = text.replaceAll(RegExp(r'[^\w\s]'), ''); // Remove punctuation
        final words = normalizedText.split(RegExp(r'\s+'));
        
        // Look for combinations of key words
        bool hasHey = words.any((w) => w == 'hey' || w == 'he' || w == 'hi');
        bool hasGo = words.any((w) => w == 'go' || w == 'grow');
        bool hasOrderly = words.any((w) => 
          w.contains('order') || 
          w.contains('adeli') || 
          w.contains('orderly') ||
          w.contains('orderley')
        );
        
        // Also check for exact patterns
        final exactPatterns = [
          'hey goorderly',
          'hey go orderly',
          'hey go orderley',
          'goorderly',
          'he goorderly',
          'he go orderly',
          'he go orderley',
        ];
        
        bool exactMatch = exactPatterns.any((pattern) => text.contains(pattern));
        
        // Flexible match: "hey/he" + "go" + something with "order"
        bool flexibleMatch = (hasHey || text.startsWith('he')) && 
                            hasGo && 
                            hasOrderly;
        
        // Also check if text starts with wake word patterns
        bool startsWithWakeWord = text.startsWith('hey go') || 
                                  text.startsWith('he go') ||
                                  text.startsWith('goorderly');
        
        bool wakeWordDetected = exactMatch || flexibleMatch || startsWithWakeWord;
        
        if (wakeWordDetected) {
          print('Wake word detected in: "$text" (exact: $exactMatch, flexible: $flexibleMatch, startsWith: $startsWithWakeWord)');
          // Stop listening first, then call the callback
          stopListening();
          onWakeWordDetected?.call();
          return;
        }
        
        // If we got a final result and no wake word, restart listening
        // (This keeps it listening until timeout)
        if (result.finalResult) {
          print('Wake word detection: No wake word, restarting...');
          // Restart listening for wake word after a short delay
          Future.delayed(const Duration(milliseconds: 500), () {
            if (!_isListening) {
              startWakeWordDetection(
                onWakeWordDetected: onWakeWordDetected,
                onTimeout: onTimeout,
              );
            }
          });
        }
      },
      onSoundLevelChange: (level) {
        // Log sound levels to verify mic is working
        if (level > -40) { // Only log when there's actual sound
          print('Wake word detection: Sound level: $level');
        }
      },
      localeId: 'en_US',
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.dictation,
        partialResults: true, // Enable partial results for real-time detection
        cancelOnError: false, // Don't cancel on error, keep listening
      ),
      pauseFor: const Duration(seconds: 5), // Longer pause for wake word detection
      listenFor: const Duration(seconds: 60), // Listen for longer periods
    );

    _isListening = true;
    print('Wake word detection: Speech recognition started, listening: $_isListening');
    
    // Cancel any existing timeout timer
    _wakeWordTimeoutTimer?.cancel();
    
    // Set up a timer to detect timeout (listenFor duration + pauseFor)
    _wakeWordTimeoutTimer = Timer(const Duration(seconds: 65), () {
      if (_isListening) {
        print('Wake word detection: Timeout detected');
        _isListening = false; // Set to false before calling stopListening to prevent callback
        stopListening();
        onTimeout?.call();
      }
    });
  }
}

class SpeechException implements Exception {
  final String message;

  SpeechException(this.message);

  @override
  String toString() => message;
}

