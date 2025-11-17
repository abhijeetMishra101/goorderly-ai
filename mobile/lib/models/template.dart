// lib/models/template.dart

class Template {
  final int id;
  final String name;
  final String? description;
  final String? googleDocId;
  final String? contentPreview;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Template({
    required this.id,
    required this.name,
    this.description,
    this.googleDocId,
    this.contentPreview,
    required this.isActive,
    this.createdAt,
    this.updatedAt,
  });

  factory Template.fromJson(Map<String, dynamic> json) {
    return Template(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      googleDocId: json['googleDocId'] as String?,
      contentPreview: json['contentPreview'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'googleDocId': googleDocId,
      'contentPreview': contentPreview,
      'isActive': isActive,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}

