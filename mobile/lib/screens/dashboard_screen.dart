// lib/screens/dashboard_screen.dart

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'dart:async';
import '../services/api_client.dart';
import '../services/speech_service.dart';
import '../services/location_service.dart';
import '../services/tts_service.dart';
import '../models/journal.dart';
import '../models/voice_state.dart';
import '../widgets/voice_orb_widget.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiClient _apiClient = ApiClient();
  final SpeechService _speechService = SpeechService();
  final LocationService _locationService = LocationService();
  final TtsService _ttsService = TtsService();
  
  Journal? _todayJournal;
  bool _isLoading = true;
  String? _error;
  String? _success;
  VoiceState _voiceState = VoiceState.idle;
  double _voiceLevel = 0.0;
  double _speakingProgress = 0.0;
  Timer? _speakingProgressTimer;
  String? _recognizedText; // Text that was heard
  bool _isCancelled = false; // Flag to track if user cancelled the recording
  bool _isProcessingVoiceEntry = false; // Flag to prevent duplicate processing
  bool _hasSpokenForCurrentEntry = false; // Flag to prevent double TTS announcements
  Map<String, dynamic>? _lastVoiceEntryResult; // Store last API response for announcement

  @override
  void initState() {
    super.initState();
    _loadTodayJournal();
  }

  @override
  void dispose() {
    _speakingProgressTimer?.cancel();
    _ttsService.stop();
    super.dispose();
  }

  void _handleCancel() {
    // Stop any ongoing operations
    _speechService.stopListening();
    _ttsService.stop();
    _speakingProgressTimer?.cancel();
    
    // Set cancellation flag to prevent API call processing
    _isCancelled = true;
    
    // Reset state and return to idle
    setState(() {
      _recognizedText = null;
      _voiceLevel = 0.0;
      _speakingProgress = 0.0;
      _isProcessingVoiceEntry = false; // Reset processing flag
      _hasSpokenForCurrentEntry = false; // Reset TTS flag
    });
    _updateVoiceState(VoiceState.idle);
  }

  Future<void> _handleRetry() async {
    // Stop current listening session
    await _speechService.stopListening();
    _ttsService.stop();
    _speakingProgressTimer?.cancel();
    
    // Reset state but keep in listening mode
    setState(() {
      _recognizedText = null;
      _voiceLevel = 0.0;
      _speakingProgress = 0.0;
      _isCancelled = false; // Reset cancellation flag for retry
      _isProcessingVoiceEntry = false; // Reset processing flag for retry
      _hasSpokenForCurrentEntry = false; // Reset TTS flag for retry
    });
    
    // Start a new recording session
    await _handleStartRecording();
  }

  void _updateVoiceState(VoiceState newState) {
    setState(() {
      _voiceState = newState;
      if (newState != VoiceState.speaking) {
        _speakingProgress = 0.0;
        _speakingProgressTimer?.cancel();
      }
    });
  }

  void _simulateSpeaking() {
    _speakingProgressTimer?.cancel();
    _speakingProgress = 0.0;
    
    _speakingProgressTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      if (mounted && _voiceState == VoiceState.speaking) {
        setState(() {
          _speakingProgress += 0.02;
          if (_speakingProgress >= 1.0) {
            _speakingProgress = 1.0;
            timer.cancel();
            // Return to idle after speaking completes
            Future.delayed(const Duration(milliseconds: 500), () {
              if (mounted) {
                setState(() {
                  _recognizedText = null; // Clear recognized text when returning to idle
                });
                _updateVoiceState(VoiceState.idle);
              }
            });
          }
        });
      } else {
        timer.cancel();
      }
    });
  }

  void _updateSpeakingProgress() async {
    _speakingProgressTimer?.cancel();
    _speakingProgress = 0.0;
    
    // Set up completion handler to know when TTS finishes
    _ttsService.setCompletionHandler(() {
      if (mounted && _voiceState == VoiceState.speaking) {
        setState(() {
          _speakingProgress = 1.0;
        });
        _speakingProgressTimer?.cancel();
        // Return to idle after a brief delay
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted) {
            setState(() {
              _recognizedText = null; // Clear recognized text when returning to idle
            });
            _updateVoiceState(VoiceState.idle);
          }
        });
      }
    });
    
    // Update progress while TTS is speaking
    _speakingProgressTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (mounted && _voiceState == VoiceState.speaking) {
        if (_ttsService.isSpeaking) {
          setState(() {
            // Gradually increase progress, but don't complete until TTS finishes
            if (_speakingProgress < 0.95) {
              _speakingProgress += 0.05;
            }
          });
        } else {
          // TTS finished, complete the progress
          setState(() {
            _speakingProgress = 1.0;
          });
          timer.cancel();
          // Return to idle after a brief delay
          Future.delayed(const Duration(milliseconds: 500), () {
            if (mounted) {
              setState(() {
                _recognizedText = null; // Clear recognized text when returning to idle
              });
              _updateVoiceState(VoiceState.idle);
            }
          });
        }
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _loadTodayJournal() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      // Add timeout to prevent hanging
      final response = await _apiClient.getJournal(today).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw TimeoutException('Journal loading timed out');
        },
      );
      
      setState(() {
        _todayJournal = Journal.fromJson(response);
        _isLoading = false;
      });
      
      // Journal content loading removed - we only show a link now
    } catch (e) {
      if (e.toString().contains('not found') || e.toString().contains('404')) {
        // Journal doesn't exist yet - that's okay
        setState(() {
          _todayJournal = null;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load journal: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openJournalLink() async {
    if (_todayJournal?.url == null) return;
    
    try {
      final uri = Uri.parse(_todayJournal!.url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        setState(() {
          _error = 'Cannot open journal link';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to open journal: ${e.toString()}';
      });
    }
  }

  Future<void> _createTodayJournal() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _apiClient.createJournal();
      setState(() {
        _todayJournal = Journal.fromJson(response);
        _isLoading = false;
        _success = 'Journal created successfully!';
      });
      
      // Journal created successfully
      
      // Clear success message after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() {
            _success = null;
          });
        }
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to create journal: ${e.toString()}';
        _isLoading = false;
      });
    }
  }



  Future<void> _handleStartRecording() async {
    if (_todayJournal == null) {
      setState(() {
        _error = 'Please create today\'s journal first before recording voice entries.';
      });
      _updateVoiceState(VoiceState.error);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          _updateVoiceState(VoiceState.idle);
        }
      });
      return;
    }

    setState(() {
      _error = null;
      _voiceLevel = 0.0;
      _isCancelled = false; // Reset cancellation flag when starting new recording
      _isProcessingVoiceEntry = false; // Reset processing flag when starting new recording
      _hasSpokenForCurrentEntry = false; // Reset TTS flag when starting new recording
    });

    _updateVoiceState(VoiceState.listening);

    try {
      // Initialize speech service if needed
      if (!_speechService.isInitialized) {
        await _speechService.initialize();
      }

      // Start listening with sound level monitoring
      // Use dictation mode for longer phrases and better pause handling
      final text = await _speechService.startListeningWithLevels(
        listenMode: stt.ListenMode.dictation,
        partialResults: true, // Enable partial results for better real-time feedback
        onSoundLevelChange: (level) {
          if (mounted && _voiceState == VoiceState.listening) {
            setState(() {
              _voiceLevel = level;
            });
          }
        },
        onPartialResult: (partialText) {
          // Update recognized text in real-time as user speaks
          if (mounted && _voiceState == VoiceState.listening) {
            setState(() {
              _recognizedText = partialText;
            });
          }
        },
      );
      
      // Check if cancelled before processing
      if (_isCancelled) {
        return; // User cancelled, don't process
      }
      
      if (text != null && text.trim().isNotEmpty) {
        // Store recognized text for display
        setState(() {
          _recognizedText = text;
        });
        
        // Remove wake word if present
        final cleanedText = text.replaceAll(RegExp(r'hey\s+goorderly\s*', caseSensitive: false), '').trim();
        
        if (cleanedText.isNotEmpty) {
          // Check again if cancelled before transitioning to thinking
          if (_isCancelled) {
            return; // User cancelled, don't process
          }
          
          // Transition to thinking state
          _updateVoiceState(VoiceState.thinking);
          
          // Check once more before making API call
          if (_isCancelled) {
            _updateVoiceState(VoiceState.idle);
            return; // User cancelled, don't make API call
          }
          
          // Process the voice entry
          await _handleVoiceEntry(cleanedText);
          
          // Check if cancelled after API call (user might have cancelled during the call)
          if (_isCancelled) {
            return; // User cancelled, don't continue to speaking
          }
          
          // Transition to speaking state and speak response
          if (_hasSpokenForCurrentEntry) {
            // We've already spoken for this entry (e.g., via another completion path)
            return;
          }
          _hasSpokenForCurrentEntry = true;
          _updateVoiceState(VoiceState.speaking);
          
          // Initialize TTS if needed
          if (!_ttsService.isInitialized) {
            await _ttsService.initialize();
          }
          
          // Set up completion handler before speaking
          _updateSpeakingProgress();
          
          // Small delay to ensure completion handler is set up
          await Future.delayed(const Duration(milliseconds: 100));
          
          // Speak the response with informative message
          final announcement = _generateAnnouncement();
          await _ttsService.speak(announcement);
        } else {
          setState(() {
            _error = 'No speech detected. Please try again.';
            _recognizedText = null;
          });
          _updateVoiceState(VoiceState.error);
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              _updateVoiceState(VoiceState.idle);
            }
          });
        }
      } else {
        setState(() {
          _error = 'No speech detected. Please try again.';
          _recognizedText = null;
        });
        _updateVoiceState(VoiceState.error);
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            _updateVoiceState(VoiceState.idle);
          }
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to start recording: ${e.toString()}';
        _recognizedText = null;
      });
      _updateVoiceState(VoiceState.error);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          _updateVoiceState(VoiceState.idle);
        }
      });
    }
  }

  Future<void> _handleVoiceEntry(String text) async {
    if (text.trim().isEmpty) return;
    
    // Prevent duplicate processing if already processing
    if (_isProcessingVoiceEntry) {
      return; // Already processing, prevent duplicate call
    }
    
    // Check if cancelled before making API call
    if (_isCancelled) {
      return; // User cancelled, don't make API call
    }
    
    // Set processing flag to prevent duplicate calls
    _isProcessingVoiceEntry = true;

    setState(() {
      _error = null;
      _lastVoiceEntryResult = null; // Clear previous result
    });

    try {
      // Get location if available
      final location = await _locationService.getCurrentLocation();
      
      // Check again if cancelled before API call
      if (_isCancelled) {
        return; // User cancelled, don't make API call
      }

      final result = await _apiClient.logVoiceEntry(
        text: text,
        timestamp: DateTime.now(),
        lat: location?['lat'],
        lng: location?['lng'],
      );
      
      // Check if cancelled after API call completes
      if (_isCancelled) {
        return; // User cancelled, don't update UI
      }

      // Store result for announcement
      setState(() {
        _lastVoiceEntryResult = result;
        _success = 'Entry logged: "$text"';
      });

      // Reload journal
      await _loadTodayJournal();

      // Clear success message
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted && !_isCancelled) {
          setState(() {
            _success = null;
          });
        }
      });
    } catch (e) {
      // Only show error if not cancelled
      if (!_isCancelled && mounted) {
        setState(() {
          _error = 'Failed to log entry: ${e.toString()}';
        });
      }
    } finally {
      // Reset processing flag when done
      _isProcessingVoiceEntry = false;
    }
  }

  /// Generate announcement message based on API response
  String _generateAnnouncement() {
    if (_lastVoiceEntryResult == null) {
      return "Making a note of it right away";
    }

    final isAnalysisRequest = _lastVoiceEntryResult!['isAnalysisRequest'] as bool? ?? false;
    final isReminder = _lastVoiceEntryResult!['isReminder'] as bool? ?? false;
    final timeSlot = _lastVoiceEntryResult!['timeSlot'] as String?;
    final targetDate = _lastVoiceEntryResult!['targetDate'] as String?;
    final targetTime = _lastVoiceEntryResult!['targetTime'] as String?;
    final mentionedPersons = _lastVoiceEntryResult!['mentionedPersons'] as List<dynamic>? ?? [];
    final actions = _lastVoiceEntryResult!['actions'] as List<dynamic>? ?? [];
    final sentiment = _lastVoiceEntryResult!['sentiment'] as String? ?? 'neutral';

    // Handle analysis request
    if (isAnalysisRequest) {
      return "Day analysis completed. Check your journal for insights.";
    }

    // Build announcement parts
    final announcementParts = <String>[];

    // If it's a reminder (including converted from time slot)
    if (isReminder) {
      if (targetDate != null && targetTime != null) {
        // Parse target date to check if it's today or tomorrow
        final targetDateTime = DateTime.parse(targetDate);
        final today = DateTime.now();
        final isToday = targetDateTime.year == today.year &&
                       targetDateTime.month == today.month &&
                       targetDateTime.day == today.day;
        
        // Format time for announcement (convert 24-hour to 12-hour)
        final timeParts = targetTime.split(':');
        final hour = int.parse(timeParts[0]);
        final minute = timeParts.length > 1 ? int.parse(timeParts[1]) : 0;
        final hour12 = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        final ampm = hour >= 12 ? 'PM' : 'AM';
        final timeStr = minute > 0 ? '$hour12:${minute.toString().padLeft(2, '0')} $ampm' : '$hour12 $ampm';
        
        if (isToday) {
          announcementParts.add("Reminder set for $timeStr today");
        } else {
          announcementParts.add("Reminder set for $timeStr tomorrow");
        }
      } else {
        announcementParts.add("Reminder created");
      }
    }
    
    // Handle time slot action
    if (timeSlot != null && (actions.isEmpty || actions.contains('timeSlot'))) {
      // Extract time from time slot (e.g., "7:00 - 8:00 AM" -> "7 AM")
      final timeMatch = RegExp(r'(\d{1,2}):(\d{2})\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)', caseSensitive: false)
          .firstMatch(timeSlot);
      if (timeMatch != null) {
        final hour = int.parse(timeMatch.group(1)!);
        final minute = int.parse(timeMatch.group(2)!);
        final ampm = timeMatch.group(3)!.toUpperCase();
        final hour12 = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        final timeStr = minute > 0 ? '$hour12:$minute $ampm' : '$hour12 $ampm';
        announcementParts.add("Added to $timeStr time slot");
      } else {
        announcementParts.add("Note scheduled for $timeSlot");
      }
    }
    
    // Handle journal action with person mentions
    if (actions.contains('journal') || mentionedPersons.isNotEmpty) {
      if (mentionedPersons.isNotEmpty) {
        final personNames = mentionedPersons.join(' and ');
        final sentimentText = sentiment == 'positive' ? 'positive note' : 
                             sentiment == 'negative' ? 'note' : 'note';
        announcementParts.add("Noted about $personNames in journal");
      } else {
        announcementParts.add("Added to journal");
      }
    }
    
    // Combine announcement parts
    if (announcementParts.isNotEmpty) {
      return announcementParts.join(' and ');
    }
    
    // Default fallback
    return "Making a note of it right away";
  }

  @override
  Widget build(BuildContext context) {
    // Full screen overlay for listening, thinking, speaking, or error states
    if (_voiceState != VoiceState.idle) {
      final screenSize = MediaQuery.of(context).size;
      final circleSize = (screenSize.width < screenSize.height 
          ? screenSize.width 
          : screenSize.height) * 0.8;
      
      return Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              // Cancel/Stop button at the top
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Action buttons (only show when listening)
                    if (_voiceState == VoiceState.listening)
                      Row(
                        children: [
                          // Retry button
                          ElevatedButton.icon(
                            onPressed: _handleRetry,
                            icon: const Icon(Icons.refresh, size: 20),
                            label: const Text('Retry'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.orange,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Done/Submit button
                          ElevatedButton.icon(
                            onPressed: () async {
                              // Stop listening and process the recognized text
                              await _speechService.stopListening();
                              // The onResult callback will be called with final result
                              // Wait a moment for final result, then process
                              await Future.delayed(const Duration(milliseconds: 500));
                              
                              // Check if cancelled before processing
                              if (_isCancelled) {
                                return;
                              }
                              
                              if (_recognizedText != null && _recognizedText!.trim().isNotEmpty) {
                                final cleanedText = _recognizedText!.replaceAll(RegExp(r'hey\s+goorderly\s*', caseSensitive: false), '').trim();
                                if (cleanedText.isNotEmpty) {
                                  // Check again if cancelled
                                  if (_isCancelled) {
                                    return;
                                  }
                                  
                                  _updateVoiceState(VoiceState.thinking);
                                  
                                  // Check once more before API call
                                  if (_isCancelled) {
                                    _updateVoiceState(VoiceState.idle);
                                    return;
                                  }
                                  
                                  await _handleVoiceEntry(cleanedText);
                                  
                                  // Check if cancelled after API call
                                  if (_isCancelled) {
                                    return;
                                  }
                                  
                                  if (_hasSpokenForCurrentEntry) {
                                    // We've already spoken for this entry via another path
                                    return;
                                  }
                                  _hasSpokenForCurrentEntry = true;
                                  _updateVoiceState(VoiceState.speaking);
                                  if (!_ttsService.isInitialized) {
                                    await _ttsService.initialize();
                                  }
                                  
                                  // Set up completion handler before speaking
                                  _updateSpeakingProgress();
                                  
                                  // Small delay to ensure completion handler is set up
                                  await Future.delayed(const Duration(milliseconds: 100));
                                  
                                  // Speak the response with informative message
                                  final announcement = _generateAnnouncement();
                                  await _ttsService.speak(announcement);
                                } else {
                                  _handleCancel();
                                }
                              } else {
                                _handleCancel();
                              }
                            },
                            icon: const Icon(Icons.check, size: 20),
                            label: const Text('Done'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            ),
                          ),
                        ],
                      )
                    else
                      const SizedBox.shrink(),
                    // Cancel button
                    IconButton(
                      icon: const Icon(Icons.close, size: 28),
                      onPressed: _handleCancel,
                      tooltip: 'Cancel',
                    ),
                  ],
                ),
              ),
              // Voice orb in the center
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: circleSize,
                        height: circleSize,
                        child: VoiceOrbWidget(
                          state: _voiceState,
                          voiceLevel: _voiceLevel,
                          speakingProgress: _speakingProgress,
                          isWakeWordDetectionActive: false, // Not active in full-screen mode
                        ),
                      ),
                      // Display recognized text below the orb
                      if (_recognizedText != null && _recognizedText!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 32.0, left: 24.0, right: 24.0),
                          child: Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: Colors.grey[100],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey[300]!),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  'I heard:',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey[600],
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _recognizedText!,
                                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    fontWeight: FontWeight.w500,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadTodayJournal,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [

              // Voice Recording Section
              Card(
                child: Padding(
                  padding: const EdgeInsets.only(top: 32.0, left: 16.0, right: 16.0, bottom: 16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Circular visual with top padding
                      VoiceOrbWidget(
                        state: _voiceState,
                        voiceLevel: _voiceLevel,
                        speakingProgress: _speakingProgress,
                        isWakeWordDetectionActive: false, // No wake word detection
                        onTap: _todayJournal != null && _voiceState == VoiceState.idle
                            ? () {
                                // Start recording when tapped
                                _handleStartRecording();
                              }
                            : null,
                      ),
                      const SizedBox(height: 24),
                      // Disclaimer text
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Text(
                          _voiceState == VoiceState.idle
                              ? 'Tap to start recording'
                              : 'Listening...',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.grey[600],
                                fontWeight: FontWeight.w500,
                              ),
                        ),
                      ),
                      if (_todayJournal == null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16.0),
                          child: Text(
                            'Create today\'s journal first to enable voice recording',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.orange[700],
                                ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Today's Journal Section
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Today\'s Journal',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (!_isLoading && _todayJournal == null)
                            ElevatedButton(
                              onPressed: _createTodayJournal,
                              child: const Text('Create Journal'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (_isLoading)
                        const Center(child: CircularProgressIndicator())
                      else if (_todayJournal != null)
                        InkWell(
                          onTap: _openJournalLink,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8.0),
                            child: Row(
                              children: [
                                const Icon(Icons.link, color: Colors.blue),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'View today\'s journal',
                                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                          color: Colors.blue,
                                          decoration: TextDecoration.underline,
                                        ),
                                  ),
                                ),
                                const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.blue),
                              ],
                            ),
                          ),
                        )
                      else
                        Text(
                          'No journal created for today. Click "Create Journal" to get started.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.grey[600],
                                fontStyle: FontStyle.italic,
                              ),
                        ),
                    ],
                  ),
                ),
              ),

              // Error message
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16.0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red[700]),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(color: Colors.red[700]),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Success message
              if (_success != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16.0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline, color: Colors.green[700]),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _success!,
                            style: TextStyle(color: Colors.green[700]),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

