import 'package:flutter_test/flutter_test.dart';

import 'package:cooperativeos_mobile/api.dart';
import 'package:cooperativeos_mobile/main.dart';

void main() {
  testWidgets('unauthenticated app shows the sign-in screen', (tester) async {
    final api = Api('http://localhost:8000/api/v1'); // no token → login screen
    await tester.pumpWidget(CooperativeApp(api: api));
    await tester.pump();

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('CooperativeOS'), findsOneWidget);
  });
}
