import 'dart:async';

import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'legal_webview.dart';

/// Joining a cooperative from the app, for someone with no account yet — the
/// website's "Join a cooperative" signup. Find the society (or paste its
/// invite link), say who you are, and an officer reviews the request. Once
/// admitted, we email a link to choose a password, and they sign in here.
class JoinScreen extends StatefulWidget {
  const JoinScreen({super.key, required this.api});
  final Api api;

  @override
  State<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends State<JoinScreen> {
  final _search = TextEditingController();
  final _invite = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _message = TextEditingController();
  Timer? _debounce;
  List<Society>? _results;
  bool _searching = false;
  bool _showInvite = false;
  bool _openingInvite = false;
  Society? _picked;
  bool _sending = false;
  String? _error;
  String? _sentTo;

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in [_search, _invite, _name, _email, _phone, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _results = null);
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final found = await widget.api.searchSocieties(q);
        if (mounted && _search.text == q) setState(() => _results = found);
      } catch (_) {
        if (mounted) setState(() => _results = []);
      } finally {
        if (mounted && _search.text == q) setState(() => _searching = false);
      }
    });
  }

  Future<void> _openInvite() async {
    setState(() {
      _openingInvite = true;
      _error = null;
    });
    try {
      final society = await widget.api.societyForInvite(_invite.text);
      if (mounted) setState(() => _picked = society);
    } on ApiException catch (e) {
      setState(() => _error = e.status == 404
          ? "That invite link isn't active any more. Ask an officer for a "
              'new one, or search for your cooperative.'
          : e.message);
    } catch (_) {
      setState(() => _error = 'Could not open the invite link.');
    } finally {
      if (mounted) setState(() => _openingInvite = false);
    }
  }

  Future<void> _send() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    if (name.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter your full name and email address.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.api.requestToJoin(
        cooperativeId: _picked!.id,
        fullName: name,
        email: email,
        phone: _phone.text.trim(),
        message: _message.text.trim(),
      );
      if (mounted) setState(() => _sentTo = _picked!.name);
    } catch (e) {
      if (mounted) {
        setState(() => _error = errorMessage(e,
            'Could not send your request. Check your connection and try again.'));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _openPolicy(String slug, String title) {
    final api = Uri.parse(widget.api.baseUrl);
    final site = Uri(
        scheme: api.scheme, host: api.host, port: api.hasPort ? api.port : null);
    Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => LegalWebView(url: '$site/legal/$slug', title: title)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Join a cooperative'),
          backgroundColor: AppColors.card),
      body: SafeArea(
        child: _sentTo != null ? _done() : _form(),
      ),
    );
  }

  Widget _form() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text(
            _picked == null
                ? 'Find your cooperative, then tell them who you are. An '
                    'officer will review your request.'
                : 'Tell ${_picked!.name} who you are. An officer will review '
                    'your request.',
            style: const TextStyle(color: AppColors.muted, height: 1.4)),
        const SizedBox(height: 16),
        _label('Your cooperative'),
        if (_picked != null) _pickedCard() else ..._finder(),
        if (_picked != null) ...[
          const SizedBox(height: 20),
          _label('About you'),
          _field(_name, 'Full name', capitalize: true),
          _field(_email, 'Email', keyboard: TextInputType.emailAddress),
          _field(_phone, 'Phone (optional)', keyboard: TextInputType.phone),
          _field(_message, 'Anything the officers should know? (optional)',
              hint: 'Your number on their register, who introduced you',
              lines: 3),
        ],
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 8),
            child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ),
        if (_picked != null) ...[
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text('By continuing you agree to our ',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12)),
              _link('Terms and Conditions',
                  () => _openPolicy('terms', 'Terms and Conditions')),
              const Text(' and ',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12)),
              _link('Privacy Notice',
                  () => _openPolicy('privacy', 'Privacy Notice')),
              const Text('.',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _sending ? null : _send,
            style:
                FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            child: _sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Send request',
                    style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ],
    );
  }

  List<Widget> _finder() => [
        TextField(
          controller: _search,
          autofocus: true,
          onChanged: _onSearch,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search by name',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2)))
                : null,
            filled: true,
            fillColor: AppColors.card,
            border: const OutlineInputBorder(),
          ),
        ),
        if (_results != null)
          Container(
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(10),
            ),
            child: _results!.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      'No live cooperative matches that name. It may not be '
                      'on CooperativeOS yet, or may still be setting up — ask '
                      'an officer for the exact name, or for its invite link.',
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  )
                : Column(
                    children: [
                      for (final s in _results!)
                        ListTile(
                          title: Text(s.name,
                              style: const TextStyle(
                                  color: AppColors.ink,
                                  fontWeight: FontWeight.w600)),
                          subtitle: s.place.isEmpty ? null : Text(s.place),
                          trailing: const Icon(Icons.chevron_right,
                              color: AppColors.muted2),
                          onTap: () {
                            FocusScope.of(context).unfocus();
                            setState(() {
                              _picked = s;
                              _error = null;
                            });
                          },
                        ),
                    ],
                  ),
          )
        else
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text('Type at least two letters of its name.',
                style: TextStyle(color: AppColors.muted2, fontSize: 12)),
          ),
        const SizedBox(height: 14),
        if (!_showInvite)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => setState(() => _showInvite = true),
              icon: const Icon(Icons.link, size: 18),
              label: const Text('I have an invite link'),
            ),
          )
        else
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _invite,
                  decoration: const InputDecoration(
                    labelText: 'Paste the invite link',
                    hintText: 'mycooperativeos.com/join/…',
                    filled: true,
                    fillColor: AppColors.card,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _openingInvite ? null : _openInvite,
                child: Text(_openingInvite ? '…' : 'Open'),
              ),
            ],
          ),
      ];

  Widget _pickedCard() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.green50,
          border: Border.all(color: AppColors.green),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle, color: AppColors.green),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_picked!.name,
                      style: const TextStyle(
                          color: AppColors.ink, fontWeight: FontWeight.w600)),
                  if (_picked!.place.isNotEmpty)
                    Text(_picked!.place,
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 12)),
                ],
              ),
            ),
            TextButton(
              onPressed: () => setState(() {
                _picked = null;
                _error = null;
              }),
              child: const Text('Change'),
            ),
          ],
        ),
      );

  Widget _done() => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 24),
          const Icon(Icons.mark_email_read_outlined,
              color: AppColors.green, size: 52),
          const SizedBox(height: 16),
          const Text('Request sent',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('An officer of $_sentTo will review your request.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 24),
          for (final (i, step) in const [
            'An officer checks your details against their member register.',
            'If they admit you, we email you a link to choose your password.',
            'Then come back here and sign in with your email and that password.',
          ].indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppColors.green50,
                    child: Text('${i + 1}',
                        style: const TextStyle(
                            color: AppColors.green,
                            fontSize: 12,
                            fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                      child: Text(step,
                          style: const TextStyle(
                              color: AppColors.inkSoft, height: 1.4))),
                ],
              ),
            ),
          const SizedBox(height: 4),
          const Text(
              "You'll never be sent a password itself — only a link to choose "
              'one.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted2, fontSize: 12)),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            style:
                FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            child: const Text('Back to sign in'),
          ),
        ],
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                color: AppColors.muted2,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: .8)),
      );

  Widget _link(String text, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Text(text,
            style: const TextStyle(
                color: AppColors.green,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline)),
      );

  Widget _field(TextEditingController c, String label,
          {TextInputType? keyboard,
          String? hint,
          int lines = 1,
          bool capitalize = false}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          keyboardType: keyboard,
          maxLines: lines,
          textCapitalization:
              capitalize ? TextCapitalization.words : TextCapitalization.none,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            filled: true,
            fillColor: AppColors.card,
            border: const OutlineInputBorder(),
          ),
        ),
      );
}
