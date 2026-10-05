import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/member_scaffold.dart';
 
// Point at the Django API. The default must be the real deployment: a release
// APK built without --dart-define shipped pointing at http://localhost:8000,
// which on a phone is the phone itself, so nothing ever answered.
// For local work, override it:
//   flutter run --dart-define=API_BASE=http://10.0.2.2:8000/api/v1   (Android)
//   flutter run --dart-define=API_BASE=http://localhost:8000/api/v1  (iOS sim)
const kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://mycooperativeos.com/api/v1',
);

// Dev-only overrides for simulator screenshots (empty in normal builds).
const _demoToken = String.fromEnvironment('DEMO_TOKEN');
const _demoCoop = int.fromEnvironment('DEMO_COOP', defaultValue: 0);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = Api(kApiBase);
  await api.restore();
  if (!api.isAuthenticated && _demoToken.isNotEmpty) {
    api.seedDemo(_demoToken, _demoCoop);
  }
  runApp(CooperativeApp(api: api));
}

class CooperativeApp extends StatefulWidget {
  const CooperativeApp({super.key, required this.api});
  final Api api;

  @override
  State<CooperativeApp> createState() => _CooperativeAppState();
}

class _CooperativeAppState extends State<CooperativeApp> {
  late bool _signedIn = widget.api.isAuthenticated;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CooperativeOS',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: _signedIn
          ? MemberScaffold(
              api: widget.api,
              onSignOut: () async {
                await widget.api.logout();
                setState(() => _signedIn = false);
              },
            )
          : LoginScreen(
              api: widget.api,
              onSignedIn: () => setState(() => _signedIn = true),
            ),
    );
  }
}
