// lib/screens/template_selection_screen.dart

import 'package:flutter/material.dart';
import '../models/template.dart';
import '../services/api_client.dart';
import '../widgets/template_card.dart';

class TemplateSelectionScreen extends StatefulWidget {
  const TemplateSelectionScreen({super.key});

  @override
  State<TemplateSelectionScreen> createState() => _TemplateSelectionScreenState();
}

class _TemplateSelectionScreenState extends State<TemplateSelectionScreen> {
  final ApiClient _apiClient = ApiClient();
  List<Template> _templates = [];
  int? _selectedTemplateId;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTemplates();
  }

  Future<void> _loadTemplates() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _apiClient.getTemplates();
      final templatesData = response['data'] as List;
      
      setState(() {
        _templates = templatesData
            .map((json) => Template.fromJson(json as Map<String, dynamic>))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load templates: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _selectTemplate(int templateId) async {
    setState(() {
      _selectedTemplateId = templateId;
    });

    try {
      await _apiClient.selectTemplate(templateId);
      if (mounted) {
        Navigator.pushNamed(
          context,
          '/confirm',
          arguments: templateId,
        );
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to select template: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose Your Journal Template'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                      const SizedBox(height: 16),
                      Text(
                        _error!,
                        style: TextStyle(color: Colors.red[700]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadTemplates,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _templates.isEmpty
                  ? Center(
                      child: Text(
                        'No templates available. Please contact support.',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Select a template that works best for your journaling style',
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  color: Colors.grey[600],
                                ),
                          ),
                          const SizedBox(height: 24),
                          ..._templates.map((template) => Padding(
                                padding: const EdgeInsets.only(bottom: 12.0),
                                child: TemplateCard(
                                  template: template,
                                  isSelected: _selectedTemplateId == template.id,
                                  onTap: () => _selectTemplate(template.id),
                                ),
                              )),
                        ],
                      ),
                    ),
    );
  }
}

