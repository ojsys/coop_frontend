import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:cooperativeos_mobile/api.dart';
import 'package:cooperativeos_mobile/screens/password_sheets.dart';
import 'package:cooperativeos_mobile/theme.dart';

void main() {
  testWidgets('forgot password by phone texts a code and opens the code sheet',
      (tester) async {
    final asked = <Map<String, dynamic>>[];
    final server = MockClient((req) async {
      if (req.url.path.endsWith('/auth/password-reset/')) {
        asked.add(jsonDecode(req.body) as Map<String, dynamic>);
        return http.Response(
            jsonEncode({
              'detail': "If that number has an account, we've texted it a "
                  'code.',
              'next': 'access_code',
            }),
            200);
      }
      return http.Response('{}', 404);
    });

    tester.view.physicalSize = const Size(1170, 3000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await http.runWithClient(() async {
      final api = Api('http://test/api/v1');
      await tester.pumpWidget(MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () =>
                    showForgotPassword(context, api, username: '0803 441 2290'),
                child: const Text('Forgot password?'),
              ),
            ),
          )));

      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // The code sheet replaced the forgot sheet, phone already filled in.
      expect(find.text('Use an access code'), findsOneWidget);
      expect(find.textContaining("we've texted it a code"), findsOneWidget);
      expect(find.widgetWithText(TextField, '0803 441 2290'), findsOneWidget);

      // Asking again from the code sheet sends another request.
      await tester.tap(find.text('Text me a new code'));
      await tester.pumpAndSettle();
    }, () => server);

    expect(asked, [
      {'username': '0803 441 2290'},
      {'username': '0803 441 2290'},
    ]);
  });

  testWidgets('with SMS off the forgot sheet says what was sent',
      (tester) async {
    final server = MockClient((req) async => http.Response(
        jsonEncode({'detail': 'If that account has an email address, a reset '
            'link is on its way.'}),
        200));

    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
              body: ForgotPasswordSheet(
                  api: Api('http://test/api/v1'),
                  initialUsername: 'ada@example.com'))));
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
    }, () => server);

    expect(find.textContaining('a reset link is on its way'), findsOneWidget);
    expect(find.text('I have an access code'), findsOneWidget);
  });
}
