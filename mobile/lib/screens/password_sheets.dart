import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Opens [ForgotPasswordSheet]. Pass what was typed on the sign-in screen so
/// the member does not have to enter their email twice.
Future<void> showForgotPassword(BuildContext context, Api api,
        {String email = ''}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => ForgotPasswordSheet(api: api, initialEmail: email),
    );

/// Opens [ChangePasswordSheet]. Resolves to true once the password changed.
Future<bool?> showChangePassword(BuildContext context, Api api) =>
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => ChangePasswordSheet(api: api),
    );

/// "Forgot password?" from the sign-in screen: emails the same reset link the
/// website sends. The link opens the website, where the new password is set;
/// the member then signs in here with it.
class ForgotPasswordSheet extends StatefulWidget {
  const ForgotPasswordSheet(
      {super.key, required this.api, this.initialEmail = ''});
  final Api api;
  final String initialEmail;

  @override
  State<ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<ForgotPasswordSheet> {
  late final _email = TextEditingController(text: widget.initialEmail);
  bool _busy = false;
  String? _error;
  String? _sent;

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter the email address you sign in with.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final detail = await widget.api.requestPasswordReset(email);
      if (mounted) setState(() => _sent = detail);
    } catch (e) {
      if (mounted) {
        setState(() => _error =
            e is ApiException ? e.message : 'Could not send the reset link.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Reset your password',
      children: _sent != null
          ? [
              Text(
                '$_sent\n\nOpen the link in the email to choose a new '
                'password, then come back and sign in with it. If nothing '
                'arrives in a few minutes, check your spam folder or ask an '
                'officer of your cooperative for help.',
                style: const TextStyle(color: AppColors.inkSoft, fontSize: 14),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                child: const Text('Back to sign in'),
              ),
            ]
          : [
              const Text(
                "Enter your account's email address and we'll send you a "
                'link to choose a new password.',
                style: TextStyle(color: AppColors.inkSoft, fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                autofocus: widget.initialEmail.isEmpty,
                decoration: const InputDecoration(
                    labelText: 'Email', border: OutlineInputBorder()),
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) _ErrorText(_error!),
              const SizedBox(height: 16),
              _SubmitButton(
                  busy: _busy, label: 'Send reset link', onPressed: _submit),
            ],
    );
  }
}

/// Change your own password from Profile. Asks for the current one first.
class ChangePasswordSheet extends StatefulWidget {
  const ChangePasswordSheet({super.key, required this.api});
  final Api api;

  @override
  State<ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<ChangePasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _show = false;
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    if (_current.text.isEmpty) {
      setState(() => _error = 'Enter your current password.');
      return;
    }
    if (_next.text.length < 8) {
      setState(() => _error = 'The new password needs at least 8 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _error = 'The new passwords do not match.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.changePassword(_current.text, _next.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e is ApiException ? e.message : 'Could not change password.';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Change password',
      children: [
        const Text(
          'You will stay signed in on this phone. Any other device signed in '
          'to your account will be signed out.',
          style: TextStyle(color: AppColors.inkSoft, fontSize: 14),
        ),
        const SizedBox(height: 16),
        _passwordField(_current, 'Current password'),
        _passwordField(_next, 'New password'),
        _passwordField(_confirm, 'Confirm new password'),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => setState(() => _show = !_show),
            icon: Icon(_show ? Icons.visibility_off : Icons.visibility,
                size: 18),
            label: Text(_show ? 'Hide passwords' : 'Show passwords'),
          ),
        ),
        if (_error != null) _ErrorText(_error!),
        const SizedBox(height: 12),
        _SubmitButton(
            busy: _busy, label: 'Change password', onPressed: _submit),
      ],
    );
  }

  Widget _passwordField(TextEditingController c, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          obscureText: !_show,
          autocorrect: false,
          enableSuggestions: false,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder()),
        ),
      );
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title,
                  style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              ...children,
            ],
          ),
        ),
      );
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(message,
            style: const TextStyle(color: AppColors.danger, fontSize: 13)),
      );
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton(
      {required this.busy, required this.label, required this.onPressed});
  final bool busy;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        child: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : Text(label),
      );
}
