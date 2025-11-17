// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import '../lib/main.dart';
import '../lib/providers/auth_provider.dart';
import '../lib/services/api_client.dart';
import '../lib/services/oauth_service.dart';

void main() {
  testWidgets('App loads successfully', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    final apiClient = ApiClient();
    final oauthService = OAuthService(apiClient);
    
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(
            create: (_) => AuthProvider(apiClient, oauthService),
          ),
        ],
        child: const GoOrderlyApp(),
      ),
    );

    // Verify that the app loads
    expect(find.byType(GoOrderlyApp), findsOneWidget);
  });
}
