import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'join_screen.dart';
import 'password_sheets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api, required this.onSignedIn});
  final Api api;
  final VoidCallback onSignedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // Previously prefilled with the demo member's credentials, which shipped in
  // the release build and invited a real user to sign in as someone fictional.
  // A phone number or an email: either signs in.
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.login(_username.text.trim(), _password.text);
      widget.onSignedIn();
    } catch (e) {
      setState(() {
        // Show what actually went wrong. Reporting every failure as a bad
        // password sent people off to reset a password that was never wrong.
        _error = e is ApiException ? e.message : 'Could not sign in. Please try again.';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.green,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.gold,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.groups_rounded,
                        color: AppColors.green),
                  ),
                  const SizedBox(width: 12),
                  const Text('CooperativeOS',
                      style: TextStyle(
                          color: AppColors.paper,
                          fontSize: 20,
                          fontWeight: FontWeight.w600)),
                ],
              ),
              const Spacer(),
              const Text(
                'A digital operating layer for your cooperative.',
                style: TextStyle(
                    color: AppColors.paper,
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    height: 1.15),
              ),
              const SizedBox(height: 28),
              _field(_username, 'Phone number or email', false,
                  keyboard: TextInputType.text),
              const SizedBox(height: 12),
              _field(_password, 'Password', true),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // For members with no email: an officer of their society
                  // gives them a code to choose a password.
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => showAccessCode(context, widget.api,
                            username: _username.text.trim()),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.gold),
                    child: const Text('Have an access code?'),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => showForgotPassword(context, widget.api,
                            username: _username.text.trim()),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.gold),
                    child: const Text('Forgot password?'),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(color: Color(0xFFFFC7BB))),
              ],
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.green,
                ),
                child: _busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.green))
                    : const Text('Sign in',
                        style: TextStyle(fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 12),
              // No account yet: ask a society to admit you, as on the
              // website's signup page, choosing a password as you ask.
              // Officers approve, and the member signs in above.
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => JoinScreen(api: widget.api))),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.paper,
                  side: const BorderSide(color: Color(0x66F4F1EA)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('New here? Join your cooperative',
                    style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              const Spacer(),
              const Text(
                'NDPA 2023 · signed PSP webhooks · 2FA for finance roles',
                style: TextStyle(color: Color(0xFF9CC4B3), fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, bool obscure,
      {TextInputType? keyboard}) {
    return TextField(
      controller: c,
      obscureText: obscure,
      keyboardType: keyboard,
      autocorrect: !obscure && keyboard == null,
      style: const TextStyle(color: AppColors.ink),
      decoration: InputDecoration(
        hintText: label,
        filled: true,
        fillColor: AppColors.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
