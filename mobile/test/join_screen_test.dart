import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:cooperativeos_mobile/api.dart';
import 'package:cooperativeos_mobile/screens/join_screen.dart';
import 'package:cooperativeos_mobile/theme.dart';

void main() {
  testWidgets('find a society, pick it and ask to join', (tester) async {
    final posted = <Map<String, dynamic>>[];
    final server = MockClient((req) async {
      if (req.url.path.endsWith('/public/societies/')) {
        expect(req.url.queryParameters['q'], 'Imole');
        return http.Response(
            jsonEncode([
              {'id': 7, 'name': 'Imole Cooperative', 'lga': 'Ikeja',
               'state': 'Lagos'}
            ]),
            200);
      }
      if (req.url.path.endsWith('/public/join/') && req.method == 'POST') {
        posted.add(jsonDecode(req.body) as Map<String, dynamic>);
        return http.Response(jsonEncode({'detail': 'sent'}), 201);
      }
      return http.Response('{}', 404);
    });

    // A phone-sized screen tall enough to show the whole form.
    tester.view.physicalSize = const Size(1170, 3000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(
          theme: buildTheme(),
          home: JoinScreen(api: Api('http://test/api/v1'))));

      await tester.enterText(find.byType(TextField).first, 'Imole');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Imole Cooperative'));
      await tester.pumpAndSettle();

      expect(find.text('Ikeja, Lagos'), findsOneWidget);
      await tester.enterText(
          find.widgetWithText(TextField, 'Full name'), 'Musa Bello');
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      // Phone or email: most members have only a phone.
      expect(
          find.text('Enter your phone number, or an email address if you '
              'have no phone.'),
          findsOneWidget);

      await tester.enterText(
          find.widgetWithText(TextField, 'Phone number'), '0803 441 2290');
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
      expect(find.text('Choose a password of at least 8 characters.'),
          findsOneWidget);
      expect(posted, isEmpty);

      await tester.enterText(
          find.widgetWithText(TextField, 'Choose a password'),
          'maize-harvest-2026');
      await tester.tap(find.text('Send request'));
      await tester.pumpAndSettle();
    }, () => server);

    // No email at all: the phone and password are enough.
    expect(posted.single, {
      'cooperative': 7,
      'full_name': 'Musa Bello',
      'phone': '0803 441 2290',
      'email': '',
      'password': 'maize-harvest-2026',
      'message': '',
    });
    expect(find.text('Request sent'), findsOneWidget);
    expect(find.text('An officer of Imole Cooperative will review your request.'),
        findsOneWidget);
  });
}
