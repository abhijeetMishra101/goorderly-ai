// lib/models/journal.dart

class Journal {
  final String id;
  final String name;
  final String date;
  final String url;

  Journal({
    required this.id,
    required this.name,
    required this.date,
    required this.url,
  });

  factory Journal.fromJson(Map<String, dynamic> json) {
    return Journal(
      id: json['id'] as String,
      name: json['name'] as String,
      date: json['date'] as String,
      url: json['url'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'date': date,
      'url': url,
    };
  }
}

