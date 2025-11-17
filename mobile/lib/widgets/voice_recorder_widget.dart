// lib/widgets/voice_recorder_widget.dart

import 'package:flutter/material.dart';
import '../services/speech_service.dart';

class VoiceRecorderWidget extends StatefulWidget {
  final SpeechService speechService;
  final Function(String) onTranscript;
  final bool enabled;

  const VoiceRecorderWidget({
    super.key,
    required this.speechService,
    required this.onTranscript,
    this.enabled = true,
  });

  @override
  State<VoiceRecorderWidget> createState() => _VoiceRecorderWidgetState();
}

class _VoiceRecorderWidgetState extends State<VoiceRecorderWidget> {
  bool _isInitializing = false;
  bool _isListening = false;
  String? _error;
  String? _status;

  Future<void> _initializeSpeech() async {
    if (widget.speechService.isInitialized) return;

    setState(() {
      _isInitializing = true;
      _error = null;
    });

    try {
      await widget.speechService.initialize();
      setState(() {
        _isInitializing = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isInitializing = false;
      });
    }
  }

  Future<void> _startListening() async {
    if (!widget.enabled) return;

    // Initialize if needed
    if (!widget.speechService.isInitialized) {
      await _initializeSpeech();
      if (_error != null) return;
    }

    setState(() {
      _isListening = true;
      _error = null;
      _status = 'Listening...';
    });

    try {
      final text = await widget.speechService.startListening();
      
      if (text != null && text.isNotEmpty) {
        widget.onTranscript(text);
        setState(() {
          _status = 'Entry logged!';
        });
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _status = null;
            });
          }
        });
      } else {
        setState(() {
          _status = 'No speech detected';
        });
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _status = null;
            });
          }
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _status = null;
      });
    } finally {
      setState(() {
        _isListening = false;
      });
    }
  }

  Future<void> _stopListening() async {
    await widget.speechService.stopListening();
    setState(() {
      _isListening = false;
      _status = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Record button
        SizedBox(
          width: double.infinity,
          height: 64,
          child: ElevatedButton.icon(
            onPressed: widget.enabled && !_isInitializing
                ? (_isListening ? _stopListening : _startListening)
                : null,
            icon: _isListening
                ? const Icon(Icons.stop, size: 24)
                : const Icon(Icons.mic, size: 24),
            label: Text(
              _isListening
                  ? 'Stop Recording'
                  : _isInitializing
                      ? 'Initializing...'
                      : 'Start Recording',
              style: const TextStyle(fontSize: 16),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _isListening
                  ? Colors.red
                  : Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),

        // Status message
        if (_status != null)
          Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: Text(
              _status!,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _status!.contains('logged')
                    ? Colors.green[700]
                    : Colors.grey[600],
                fontSize: 14,
              ),
            ),
          ),

        // Error message
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red[50],
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                _error!,
                style: TextStyle(color: Colors.red[700], fontSize: 12),
              ),
            ),
          ),
      ],
    );
  }
}

