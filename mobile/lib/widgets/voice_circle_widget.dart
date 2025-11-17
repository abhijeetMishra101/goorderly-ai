// lib/widgets/voice_circle_widget.dart

import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';

class VoiceCircleWidget extends StatefulWidget {
  final bool isRecording;
  final bool isListening;
  final VoidCallback? onTap;

  const VoiceCircleWidget({
    super.key,
    this.isRecording = false,
    this.isListening = false,
    this.onTap,
  });

  @override
  State<VoiceCircleWidget> createState() => _VoiceCircleWidgetState();
}

class _VoiceCircleWidgetState extends State<VoiceCircleWidget>
    with TickerProviderStateMixin {
  late AnimationController _haloController;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _haloController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
    
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    
    _pulseAnimation = Tween<double>(begin: 0.92, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void didUpdateWidget(VoiceCircleWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRecording && !oldWidget.isRecording) {
      _pulseController.repeat(reverse: true);
      _haloController.stop(); // Stop halo when recording
    } else if (!widget.isRecording && oldWidget.isRecording) {
      _pulseController.stop();
      _pulseController.reset();
      _haloController.repeat(); // Restart halo when not recording
    }
  }

  @override
  void dispose() {
    _haloController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Default size when not in fullscreen
    final defaultSize = 280.0;
    final defaultInnerSize = defaultSize - 6.0; // 3px border on each side
    
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.isRecording ? _pulseAnimation.value : 1.0,
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Use parent constraints if available (fullscreen), otherwise use default
                final circleSize = constraints.maxWidth > 0 && constraints.maxWidth < double.infinity
                    ? constraints.maxWidth
                    : defaultSize;
                final innerSize = circleSize - 6.0; // 3px border on each side
                
                return Container(
                  width: circleSize,
                  height: circleSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black,
                    boxShadow: [
                      BoxShadow(
                        color: widget.isRecording
                            ? Colors.red.withOpacity(0.5)
                            : widget.isListening
                                ? Colors.blue.withOpacity(0.4)
                                : Colors.black.withOpacity(0.3),
                        blurRadius: 32,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    clipBehavior: Clip.none,
                    children: [
                      // Halo rings (only when not recording)
                      if (!widget.isRecording) ...[
                        // Halo ring 1
                        AnimatedBuilder(
                          animation: _haloController,
                          builder: (context, child) {
                            final progress = (_haloController.value) % 1.0;
                            final scale = 1.0 + (progress * 0.5);
                            final opacity = (1.0 - progress) * 0.5;
                            if (opacity <= 0) return const SizedBox.shrink();
                            return Positioned(
                              child: Transform.scale(
                                scale: scale,
                                child: Container(
                                  width: innerSize,
                                  height: innerSize,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFF4A90E2).withOpacity(opacity),
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                        // Halo ring 2
                        AnimatedBuilder(
                          animation: _haloController,
                          builder: (context, child) {
                            final progress = ((_haloController.value + 0.33) % 1.0);
                            final scale = 1.0 + (progress * 0.5);
                            final opacity = (1.0 - progress) * 0.5;
                            if (opacity <= 0) return const SizedBox.shrink();
                            return Positioned(
                              child: Transform.scale(
                                scale: scale,
                                child: Container(
                                  width: innerSize,
                                  height: innerSize,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFF5BA3F5).withOpacity(opacity),
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                        // Halo ring 3
                        AnimatedBuilder(
                          animation: _haloController,
                          builder: (context, child) {
                            final progress = ((_haloController.value + 0.66) % 1.0);
                            final scale = 1.0 + (progress * 0.5);
                            final opacity = (1.0 - progress) * 0.5;
                            if (opacity <= 0) return const SizedBox.shrink();
                            return Positioned(
                              child: Transform.scale(
                                scale: scale,
                                child: Container(
                                  width: innerSize,
                                  height: innerSize,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFF6BB6FF).withOpacity(opacity),
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                      // Inner circle
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        margin: const EdgeInsets.all(3),
                        width: innerSize,
                        height: innerSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: widget.isRecording
                              ? const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFFF093FB),
                                    Color(0xFFF5576C),
                                  ],
                                )
                              : const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFF4A90E2),
                                    Color(0xFF5BA3F5),
                                    Color(0xFF6BB6FF),
                                  ],
                                  stops: [0.0, 0.5, 1.0],
                                ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

