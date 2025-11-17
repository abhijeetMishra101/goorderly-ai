import 'package:flutter/material.dart';

enum VoiceState {
  idle,
  listening,
  thinking,
  speaking,
  error,
}

extension VoiceStateColors on VoiceState {
  List<Color> get colors {
    switch (this) {
      case VoiceState.idle:
        return [
          const Color(0xFF0EA5E9), // Sky blue
          const Color(0xFF312E81), // Indigo
        ];
      case VoiceState.listening:
        return [
          const Color(0xFFA7F3D0), // Green
        ];
      case VoiceState.thinking:
        return [
          const Color(0xFFFCD34D), // Yellow
        ];
      case VoiceState.speaking:
        return [
          const Color(0xFF0EA5E9), // Sky blue
          const Color(0xFF312E81), // Indigo
        ];
      case VoiceState.error:
        return [
          const Color(0xFFEF4444), // Red
        ];
    }
  }
}

