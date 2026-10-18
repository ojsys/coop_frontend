import 'dart:async';

import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Every cooperative this account belongs to — tap one to switch to it — and
/// asking to join another with the same account. The native counterpart of
/// the web app's "Your cooperatives".
Future<void> showCooperativesSheet(
  BuildContext context, {
  required Api api,
  required CurrentUser user,
  required Future<void> Function(int cooperativeId) onSwitch,
  bool startJoining = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.card,
    builder: (_) => _CooperativesSheet(
      api: api,
      user: user,
      onSwitch: onSwitch,
      startJoining: startJoining,
    ),
  );
}

class _CooperativesSheet extends StatefulWidget {
  const _CooperativesSheet({
    required this.api,
    required this.user,
    required this.onSwitch,
    required this.startJoining,
  });
  final Api api;
  final CurrentUser user;
  final Future<void> Function(int) onSwitch;
  final bool startJoining;

  @override
  State<_CooperativesSheet> createState() => _CooperativesSheetState();
}

class _CooperativesSheetState extends State<_CooperativesSheet> {
  late List<Membership> _memberships = widget.user.memberships;
  List<MyJoinRequest> _requests = [];
  late bool _joining = widget.startJoining;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  // A society that admitted the member since the app loaded belongs here.
  Future<void> _refresh() async {
    try {
      final results = await Future.wait([
        widget.api.me(),
        widget.api.myJoinRequests(),
      ]);
      if (!mounted) return;
      setState(() {
        _memberships = (results[0] as CurrentUser).memberships;
        _requests = results[1] as List<MyJoinRequest>;
      });
    } catch (_) {
      // The list from when the app loaded still stands.
    }
  }

  void _snack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: _joining
            ? _JoinForm(
                api: widget.api,
                exclude: {
                  ..._memberships.map((m) => m.cooperativeId),
                  ..._requests.where((r) => r.isPending).map((r) => r.cooperativeId),
                },
                onBack: () => setState(() => _joining = false),
                onSent: (r) {
                  _snack('Request sent to ${r.cooperativeName}');
                  setState(() => _joining = false);
                  _refresh();
                },
              )
            : _list(),
      ),
    );
  }

  Widget _list() {
    final active = widget.api.cooperativeId;
    final waiting = _requests.where((r) => r.isPending).toList();
    final declined = _requests.where((r) => !r.isPending).take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Your cooperatives',
          style: TextStyle(
              color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700),
        ),
        if (_memberships.length > 1)
          const Padding(
            padding: EdgeInsets.only(top: 2),
            child: Text('Tap one to switch to it',
                style: TextStyle(color: AppColors.muted, fontSize: 13)),
          ),
        const SizedBox(height: 14),
        ..._memberships.map((m) {
          final current = m.cooperativeId == active;
          return _Tile(
            letter: m.cooperativeName,
            title: m.cooperativeName,
            subtitle:
                '${m.memberNo} · ${m.isMember ? (m.roleName ?? 'Member') : 'Non-member'}',
            selected: current,
            trailing: Icon(
              current ? Icons.check_circle : Icons.chevron_right,
              color: current ? AppColors.green : AppColors.muted2,
            ),
            onTap: () async {
              Navigator.pop(context);
              if (!current) await widget.onSwitch(m.cooperativeId);
            },
          );
        }),
        if (waiting.isNotEmpty || declined.isNotEmpty) ...[
          const SizedBox(height: 10),
          const Text('YOUR REQUESTS',
              style: TextStyle(
                  color: AppColors.muted2,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.6)),
          const SizedBox(height: 6),
          ...waiting.map((r) => _Tile(
                letter: r.cooperativeName,
                muted: true,
                title: r.cooperativeName,
                subtitle: 'Waiting for an officer to admit you',
                trailing: TextButton(
                  onPressed: () async {
                    try {
                      await widget.api.withdrawJoinRequest(r.id);
                      _snack('Request withdrawn');
                      _refresh();
                    } catch (e) {
                      _snack(errorMessage(e, 'Could not withdraw it'));
                    }
                  },
                  child: const Text('Withdraw'),
                ),
              )),
          ...declined.map((r) => _Tile(
                letter: r.cooperativeName,
                muted: true,
                title: r.cooperativeName,
                subtitle: r.decisionNote.isEmpty ? 'Not admitted' : r.decisionNote,
                trailing: const Text('Declined',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
              )),
        ],
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => setState(() => _joining = true),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              foregroundColor: AppColors.ink,
              side: const BorderSide(color: AppColors.line),
            ),
            icon: const Icon(Icons.add),
            label: const Text('Join another cooperative'),
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.letter,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
    this.selected = false,
    this.muted = false,
  });
  final String letter;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool selected;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? AppColors.green50 : AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: selected ? AppColors.green : AppColors.line),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: muted ? AppColors.muted2 : AppColors.green,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    letter.trim().isEmpty ? '?' : letter.trim()[0].toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w600)),
                      Text(subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12)),
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _JoinForm extends StatefulWidget {
  const _JoinForm({
    required this.api,
    required this.exclude,
    required this.onBack,
    required this.onSent,
  });
  final Api api;
  final Set<int> exclude;
  final VoidCallback onBack;
  final ValueChanged<MyJoinRequest> onSent;

  @override
  State<_JoinForm> createState() => _JoinFormState();
}

class _JoinFormState extends State<_JoinForm> {
  final _search = TextEditingController();
  final _code = TextEditingController();
  final _message = TextEditingController();
  Timer? _debounce;
  List<Society>? _results;
  Society? _picked;
  bool _sending = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _code.dispose();
    _message.dispose();
    super.dispose();
  }

  void _onSearch(String q) {
    _code.clear();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final found = await widget.api.searchSocieties(q);
        if (mounted && _search.text == q) {
          setState(() => _results =
              found.where((s) => !widget.exclude.contains(s.id)).toList());
        }
      } catch (_) {
        if (mounted) setState(() => _results = []);
      }
    });
  }

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      final r = await widget.api.joinAnother(
        cooperativeId: _picked?.id,
        code: _picked == null ? _code.text.trim() : null,
        message: _message.text.trim(),
      );
      widget.onSent(r);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(errorMessage(e, 'Could not send your request'))));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSend = _picked != null || _code.text.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Join another cooperative',
            style: TextStyle(
                color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700)),
        const Padding(
          padding: EdgeInsets.only(top: 2, bottom: 14),
          child: Text(
            'With the account you already have — nothing new to sign up for.',
            style: TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ),
        if (_picked != null)
          Container(
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
                  child: Text(_picked!.name,
                      style: const TextStyle(
                          color: AppColors.ink, fontWeight: FontWeight.w600)),
                ),
                TextButton(
                  onPressed: () => setState(() => _picked = null),
                  child: const Text('Change'),
                ),
              ],
            ),
          )
        else ...[
          TextField(
            controller: _search,
            onChanged: _onSearch,
            decoration: const InputDecoration(
              labelText: 'Find the cooperative',
              hintText: 'Search by name',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
          ),
          if (_search.text.trim().length >= 2 && _results != null)
            Container(
              margin: const EdgeInsets.only(top: 6),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(10),
              ),
              child: _results!.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'No live cooperative you can join matches that name. '
                        'Ask an officer for its invite link.',
                        style: TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                    )
                  : Column(
                      children: _results!
                          .map((s) => ListTile(
                                dense: true,
                                title: Text(s.name),
                                subtitle: s.place.isEmpty ? null : Text(s.place),
                                onTap: () => setState(() => _picked = s),
                              ))
                          .toList(),
                    ),
            ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Center(
              child: Text('or',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12)),
            ),
          ),
          TextField(
            controller: _code,
            onChanged: (_) {
              if (_search.text.isNotEmpty) _search.clear();
              setState(() => _results = null);
            },
            decoration: const InputDecoration(
              labelText: 'Paste an invite link',
              hintText: 'mycooperativeos.com/join/…',
              border: OutlineInputBorder(),
            ),
          ),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _message,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Anything the officers should know? (optional)',
            hintText: 'Who introduced you, your number on their register',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          "They'll see your name, email and phone from this account. Once an "
          'officer admits you, the cooperative appears in your list and you '
          'can switch to it with one tap.',
          style: TextStyle(color: AppColors.muted2, fontSize: 12),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            TextButton(onPressed: widget.onBack, child: const Text('Back')),
            const Spacer(),
            FilledButton(
              onPressed: canSend && !_sending ? _send : null,
              style: FilledButton.styleFrom(backgroundColor: AppColors.green),
              child: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Send request'),
            ),
          ],
        ),
      ],
    );
  }
}
