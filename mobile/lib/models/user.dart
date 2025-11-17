// lib/models/user.dart

class User {
  final int id;
  final String email;
  final String? name;
  final String? pictureUrl;
  final String? googleId;

  User({
    required this.id,
    required this.email,
    this.name,
    this.pictureUrl,
    this.googleId,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      name: json['name'] as String?,
      pictureUrl: json['pictureUrl'] as String?,
      googleId: json['googleId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'pictureUrl': pictureUrl,
      'googleId': googleId,
    };
  }
}

