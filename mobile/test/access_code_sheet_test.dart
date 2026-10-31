import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:cooperativeos_mobile/api.dart';
import 'package:cooperativeos_mobile/screens/password_sheets.dart';
import 'package:cooperativeos_mobile/theme.dart';

void main() {
  testWidgets('a member with no email sets a password with an access code',
      (tester) async {
    final posted = <Map<String, dynamic>>[];
    final server = MockClient((req) async {
      if (req.url.path.endsWith('/auth/access-code/')) {
        posted.add(jsonDecode(req.body) as Map<String, dynamic>);
        return http.Response(
            jsonEncode({'detail': 'Your password is set. You can now sign in.'}),
            200);
      }
      return http.Response('{}', 404);
    });

    tester.view.physicalSize = const Size(1170, 3000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
              body: AccessCodeSheet(
                  api: Api('http://test/api/v1'),
                  initialUsername: '0803 441 2290'))));

      await tester.enterText(
          find.widgetWithText(TextField, 'Access code'), '1234');
      await tester.tap(find.text('Set my password'));
      await tester.pumpAndSettle();
      expect(find.text('The access code has 8 digits.'), findsOneWidget);

      await tester.enterText(
          find.widgetWithText(TextField, 'Access code'), '1234 5678');
      await tester.enterText(
          find.widgetWithText(TextField, 'New password'), 'maize-harvest-2026');
      await tester.enterText(
          find.widgetWithText(TextField, 'Confirm password'), 'different-one');
      await tester.tap(find.text('Set my password'));
      await tester.pumpAndSettle();
      expect(find.text('The passwords do not match.'), findsOneWidget);
      expect(posted, isEmpty);

      await tester.enterText(find.widgetWithText(TextField, 'Confirm password'),
          'maize-harvest-2026');
      await tester.tap(find.text('Set my password'));
      await tester.pumpAndSettle();
    }, () => server);

    expect(posted.single, {
      'username': '0803 441 2290',
      'code': '1234 5678',
      'password': 'maize-harvest-2026',
    });
    expect(find.textContaining('Your password is set.'), findsOneWidget);
  });
}
