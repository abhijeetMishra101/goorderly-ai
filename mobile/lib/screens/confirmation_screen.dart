// lib/screens/confirmation_screen.dart

import 'package:flutter/material.dart';
import '../models/template.dart';
import '../services/api_client.dart';
import '../providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:flutter/services.dart';

class ConfirmationScreen extends StatefulWidget {
  const ConfirmationScreen({super.key});

  @override
  State<ConfirmationScreen> createState() => _ConfirmationScreenState();
}

class _ConfirmationScreenState extends State<ConfirmationScreen> {
  final ApiClient _apiClient = ApiClient();
  Template? _template;
  int? _templateId;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  // Preferences
  String _journalFolderName = 'Daily Journals';
  int _journalTimeHour = 6;
  int _journalTimeMinute = 0;
  
  // Text controllers
  late final TextEditingController _folderNameController;
  late final TextEditingController _hourController;
  late final TextEditingController _minuteController;

  @override
  void initState() {
    super.initState();
    _folderNameController = TextEditingController(text: _journalFolderName);
    _hourController = TextEditingController(text: _journalTimeHour.toString());
    _minuteController = TextEditingController(text: _journalTimeMinute.toString());
    
    // Listen to controller changes
    _folderNameController.addListener(() {
      _journalFolderName = _folderNameController.text;
    });
    _hourController.addListener(() {
      final hour = int.tryParse(_hourController.text);
      if (hour != null && hour >= 0 && hour <= 23) {
        _journalTimeHour = hour;
      }
    });
    _minuteController.addListener(() {
      final minute = int.tryParse(_minuteController.text);
      if (minute != null && minute >= 0 && minute <= 59) {
        _journalTimeMinute = minute;
      }
    });
  }

  @override
  void dispose() {
    _folderNameController.dispose();
    _hourController.dispose();
    _minuteController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Template is auto-selected by backend, so get it from onboarding status
    _loadOnboardingStatus();
  }

  Future<void> _loadOnboardingStatus() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Get onboarding status (backend auto-selects template if not selected)
      final response = await _apiClient.getOnboardingStatus();
      final data = response['data'] as Map<String, dynamic>?;
      
      if (data != null && data['selectedTemplate'] != null) {
        final templateData = data['selectedTemplate'] as Map<String, dynamic>;
        _templateId = templateData['id'] as int?;
        
        // Load template details
        if (_templateId != null) {
          await _loadTemplate();
        } else {
          setState(() {
            _error = 'Template not found';
            _isLoading = false;
          });
        }
      } else {
        setState(() {
          _error = 'No template available. Please contact support.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load onboarding status: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadTemplate() async {
    if (_templateId == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _apiClient.getTemplate(_templateId!);
      setState(() {
        _template = Template.fromJson(response['data'] as Map<String, dynamic>);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load template: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleConfirm() async {
    if (_templateId == null) return;

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await _apiClient.confirmOnboarding(
        _templateId!,
        {
          'journalFolderName': _journalFolderName,
          'journalTimeHour': _journalTimeHour,
          'journalTimeMinute': _journalTimeMinute,
        },
      );

      // Refresh auth provider to update onboarding status
      if (!mounted) return;
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.refreshUser();

      if (mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to confirm: ${e.toString()}';
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Confirm Your Setup'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Customize your journal preferences',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Template info (read-only, auto-selected)
                  if (_template != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  color: Theme.of(context).colorScheme.primary,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Template Ready',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _template!.name,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    color: Theme.of(context).colorScheme.primary,
                                  ),
                            ),
                            if (_template!.description != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                _template!.description!,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),

                  const SizedBox(height: 24),

                  // Journal Preferences
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Journal Preferences',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 16),

                          // Folder Name
                          TextField(
                            controller: _folderNameController,
                            decoration: const InputDecoration(
                              labelText: 'Folder Name',
                              border: OutlineInputBorder(),
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Journal Time
                          Text(
                            'Daily Journal Creation Time',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _hourController,
                                  decoration: const InputDecoration(
                                    labelText: 'Hour',
                                    border: OutlineInputBorder(),
                                  ),
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                    LengthLimitingTextInputFormatter(2),
                                  ],
                                ),
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 8.0),
                                child: Text(':'),
                              ),
                              Expanded(
                                child: TextField(
                                  controller: _minuteController,
                                  decoration: const InputDecoration(
                                    labelText: 'Minute',
                                    border: OutlineInputBorder(),
                                  ),
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                    LengthLimitingTextInputFormatter(2),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Journals will be created automatically at this time',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.grey[600],
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

                  const SizedBox(height: 24),

                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _isSubmitting
                              ? null
                              : () => Navigator.pop(context),
                          child: const Text('Back'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _handleConfirm,
                          child: _isSubmitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Confirm & Start'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}

