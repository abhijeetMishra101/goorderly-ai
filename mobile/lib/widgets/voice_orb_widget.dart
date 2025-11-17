import 'dart:ui' as ui;
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/voice_state.dart';

class VoiceOrbWidget extends StatefulWidget {
  final VoiceState state;
  final double voiceLevel; // RMS level 0.0 to 1.0
  final double speakingProgress; // 0.0 to 1.0 for speaking state
  final VoidCallback? onTap;
  final double? size;
  final bool isWakeWordDetectionActive; // Whether wake word detection is active

  const VoiceOrbWidget({
    super.key,
    required this.state,
    this.voiceLevel = 0.0,
    this.speakingProgress = 0.0,
    this.onTap,
    this.size,
    this.isWakeWordDetectionActive = false,
  });

  @override
  State<VoiceOrbWidget> createState() => _VoiceOrbWidgetState();
}

class _VoiceOrbWidgetState extends State<VoiceOrbWidget>
    with TickerProviderStateMixin {
  late AnimationController _breathingController;
  late AnimationController _thinkingController;
  late AnimationController _errorShakeController;
  late AnimationController _wakeWordPulseController; // Fast pulsation for wake word detection
  late Animation<double> _breathingAnimation;
  late Animation<double> _errorShakeAnimation;
  late Animation<double> _wakeWordPulseAnimation;
  
  VoiceState? _previousState;
  double _smoothedVoiceLevel = 0.0;

  @override
  void initState() {
    super.initState();
    
    // Breathing animation for idle state (slow, calm)
    _breathingController = AnimationController(
      duration: const Duration(milliseconds: 3000),
      vsync: this,
    )..repeat(reverse: true);
    
    _breathingAnimation = Tween<double>(begin: 0.98, end: 1.02).animate(
      CurvedAnimation(
        parent: _breathingController,
        curve: Curves.easeInOut,
      ),
    );

    // Thinking sweep animation
    _thinkingController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();

    // Error shake animation
    _errorShakeController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    _errorShakeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _errorShakeController,
        curve: Curves.elasticOut,
      ),
    );

    // Fast pulsation for wake word detection (faster than breathing)
    _wakeWordPulseController = AnimationController(
      duration: const Duration(milliseconds: 800), // Fast pulsation
      vsync: this,
    );
    
    _wakeWordPulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(
        parent: _wakeWordPulseController,
        curve: Curves.easeInOut,
      ),
    );
  }

  @override
  void didUpdateWidget(VoiceOrbWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Handle state transitions with haptics
    if (widget.state != oldWidget.state) {
      _handleStateTransition(oldWidget.state, widget.state);
      _previousState = oldWidget.state;
    }

    // Smooth voice level updates (20-40ms smoothing)
    if (widget.voiceLevel != oldWidget.voiceLevel) {
      _smoothedVoiceLevel = _smoothedVoiceLevel * 0.7 + widget.voiceLevel * 0.3;
    }

    // Control animations based on state and wake word detection
    if (widget.isWakeWordDetectionActive && widget.state == VoiceState.idle) {
      // Fast pulsation when wake word detection is active
      _breathingController.stop();
      _thinkingController.stop();
      _wakeWordPulseController.repeat(reverse: true);
    } else if (widget.state == VoiceState.idle) {
      // Normal breathing when idle and wake word detection is not active
      _wakeWordPulseController.stop();
      _breathingController.repeat(reverse: true);
      _thinkingController.stop();
    } else if (widget.state == VoiceState.thinking) {
      _breathingController.stop();
      _wakeWordPulseController.stop();
      _thinkingController.repeat();
    } else if (widget.state == VoiceState.error) {
      _errorShakeController.forward(from: 0.0);
      HapticFeedback.mediumImpact();
    } else {
      _breathingController.stop();
      _wakeWordPulseController.stop();
      _thinkingController.stop();
    }
  }

  void _handleStateTransition(VoiceState? from, VoiceState to) {
    // Haptic feedback on transitions
    if (from != null) {
      HapticFeedback.selectionClick();
    }
  }

  @override
  void dispose() {
    _breathingController.dispose();
    _thinkingController.dispose();
    _errorShakeController.dispose();
    _wakeWordPulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size ?? 280.0;
    
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: Listenable.merge([
          _breathingAnimation,
          _thinkingController,
          _errorShakeAnimation,
          _wakeWordPulseAnimation,
        ]),
        builder: (context, child) {
          // Apply error shake transform
          final shakeOffset = widget.state == VoiceState.error
              ? _errorShakeAnimation.value * 4.0 * math.sin(_errorShakeAnimation.value * math.pi * 4)
              : 0.0;
          
          // Determine scale based on wake word detection or breathing
          double scale = 1.0;
          if (widget.isWakeWordDetectionActive && widget.state == VoiceState.idle) {
            scale = _wakeWordPulseAnimation.value;
          } else if (widget.state == VoiceState.idle) {
            scale = _breathingAnimation.value;
          }
          
          return Transform.translate(
            offset: Offset(shakeOffset, 0),
            child: Transform.scale(
              scale: scale,
              child: CustomPaint(
                size: Size(size, size),
                painter: VoiceOrbPainter(
                  state: widget.state,
                  voiceLevel: _smoothedVoiceLevel,
                  speakingProgress: widget.speakingProgress,
                  breathingScale: 1.0, // Scale is now handled by Transform.scale
                  thinkingProgress: widget.state == VoiceState.thinking
                      ? _thinkingController.value
                      : 0.0,
                  isWakeWordDetectionActive: widget.isWakeWordDetectionActive,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class VoiceOrbPainter extends CustomPainter {
  final VoiceState state;
  final double voiceLevel; // 0.0 to 1.0
  final double speakingProgress; // 0.0 to 1.0
  final double breathingScale;
  final double thinkingProgress;
  final bool isWakeWordDetectionActive;

  VoiceOrbPainter({
    required this.state,
    required this.voiceLevel,
    required this.speakingProgress,
    required this.breathingScale,
    required this.thinkingProgress,
    this.isWakeWordDetectionActive = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    
    // Paint background color change when wake word detection is active
    if (isWakeWordDetectionActive && state == VoiceState.idle) {
      _paintWakeWordBackground(canvas, size);
    }
    
    // Base orb with glassy effect
    _paintGlassyOrb(canvas, center, radius * breathingScale);
    
    // State-specific overlays
    switch (state) {
      case VoiceState.listening:
        _paintListeningRing(canvas, center, radius, voiceLevel);
        break;
      case VoiceState.thinking:
        _paintThinkingSweep(canvas, center, radius, thinkingProgress);
        break;
      case VoiceState.speaking:
        _paintSpeakingProgress(canvas, center, radius, speakingProgress);
        break;
      case VoiceState.error:
        _paintErrorPulse(canvas, center, radius);
        break;
      default:
        break;
    }
  }

  void _paintWakeWordBackground(Canvas canvas, Size size) {
    // Paint a subtle background color change when wake word detection is active
    final backgroundPaint = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width / 2, size.height / 2),
        size.width * 0.8,
        [
          const Color(0xFFE0F2FE).withOpacity(0.4), // Light blue tint
          Colors.transparent,
        ],
        [0.0, 1.0],
      )
      ..style = PaintingStyle.fill;
    
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      backgroundPaint,
    );
  }

  void _paintGlassyOrb(Canvas canvas, Offset center, double radius) {
    // Soft glow shadow
    final shadowPaint = Paint()
      ..color = state.colors.first.withOpacity(0.3)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40);
    
    canvas.drawCircle(center, radius, shadowPaint);

    // Main orb with radial gradient
    // If single color, duplicate it for gradient; otherwise use provided colors
    final gradientColors = state.colors.length == 1
        ? [
            state.colors.first.withOpacity(0.9),
            state.colors.first.withOpacity(0.7),
          ]
        : state.colors.map((c) => c.withOpacity(0.9)).toList();

    final gradient = ui.Gradient.radial(
      center,
      radius * 0.6,
      gradientColors,
      gradientColors.length > 1 ? [0.0, 1.0] : null,
    );

    final orbPaint = Paint()
      ..shader = gradient
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, radius * 0.95, orbPaint);

    // Inner highlight for glassy effect
    final highlightPaint = Paint()
      ..color = Colors.white.withOpacity(0.2)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(
      Offset(center.dx - radius * 0.2, center.dy - radius * 0.2),
      radius * 0.3,
      highlightPaint,
    );
  }

  void _paintListeningRing(Canvas canvas, Offset center, double radius, double level) {
    // Inner ring expands with voice level
    final ringRadius = radius * 0.7 + (level * radius * 0.25);
    final ringPaint = Paint()
      ..color = state.colors.first.withOpacity(0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    canvas.drawCircle(center, ringRadius, ringPaint);
  }

  void _paintThinkingSweep(Canvas canvas, Offset center, double radius, double progress) {
    // Light sweep around the ring
    final sweepPaint = Paint()
      ..color = state.colors.first
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;

    final sweepAngle = progress * 2 * math.pi;
    final sweepSize = math.pi / 3; // 60 degrees

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius * 0.85),
      sweepAngle - math.pi / 2, // Start from top
      sweepSize,
      false,
      sweepPaint,
    );
  }

  void _paintSpeakingProgress(Canvas canvas, Offset center, double radius, double progress) {
    // Progress arc for speaking
    final progressPaint = Paint()
      ..color = state.colors.first
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.0
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius * 0.85),
      -math.pi / 2, // Start from top
      progress * 2 * math.pi,
      false,
      progressPaint,
    );
  }

  void _paintErrorPulse(Canvas canvas, Offset center, double radius) {
    // Red pulse overlay
    final pulsePaint = Paint()
      ..color = state.colors.first.withOpacity(0.5)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, radius * 1.05, pulsePaint);
  }

  @override
  bool shouldRepaint(VoiceOrbPainter oldDelegate) {
    return oldDelegate.state != state ||
        oldDelegate.voiceLevel != voiceLevel ||
        oldDelegate.speakingProgress != speakingProgress ||
        oldDelegate.breathingScale != breathingScale ||
        oldDelegate.thinkingProgress != thinkingProgress ||
        oldDelegate.isWakeWordDetectionActive != isWakeWordDetectionActive;
  }
}

