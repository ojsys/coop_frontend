import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import 'home_tab.dart';
import 'savings_tab.dart';
import 'contribute_tab.dart';
import 'vote_tab.dart';
import 'profile_tab.dart';
import 'cooperatives_sheet.dart';

/// The signed-in member shell: loads the profile once, then hosts the five
/// member tabs (Home / Savings / Contribute / Vote / Profile) behind a bottom
/// navigation bar — the native counterpart of the web member app's tab bar.
class MemberScaffold extends StatefulWidget {
  const MemberScaffold({super.key, required this.api, required this.onSignOut});
  final Api api;
  final Future<void> Function() onSignOut;

  @override
  State<MemberScaffold> createState() => _MemberScaffoldState();
}

class _MemberScaffoldState extends State<MemberScaffold> {
  // INITIAL_TAB is a dev-only override for screenshots; 0 (Home) in normal use.
  int _index = const int.fromEnvironment('INITIAL_TAB', defaultValue: 0);
  late Future<Session> _future = _load();

  Future<Session> _load() async {
    final user = await widget.api.me();
    // Without a tenant bound, every data endpoint fails closed. An install that
    // signed in before that was fixed still has no cooperative id stored.
    await widget.api.adoptTenant(user);
    // The society the member last chose; the first one if they have since
    // left it (or never chose).
    Membership? membership;
    for (final m in user.memberships) {
      if (m.cooperativeId == widget.api.cooperativeId) membership = m;
    }
    membership ??= user.memberships.isNotEmpty ? user.memberships.first : null;
    if (membership != null &&
        membership.cooperativeId != widget.api.cooperativeId) {
      await widget.api.switchCooperative(membership.cooperativeId);
    }
    return Session(user, membership, onSwitch: _switchTo);
  }

  /// One tap in the cooperatives sheet: every tab reloads for that society.
  Future<void> _switchTo(int cooperativeId) async {
    await widget.api.switchCooperative(cooperativeId);
    if (!mounted) return;
    setState(() {
      _index = 0;
      _future = _load();
    });
  }

  void _go(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Session>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (!snap.hasData) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      errorMessage(snap.error, 'Could not load your profile.'),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => setState(() => _future = _load()),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }

        final s = snap.data!;
        // No membership means there is nothing tenant-scoped to show, and every
        // tab would render blank without saying why. Name the actual problem.
        if (s.membership == null) {
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Signed in as ${s.user.email.isNotEmpty ? s.user.email : phone(s.user.phone)}, but this account is not a '
                      'member of any cooperative yet, so there is nothing to '
                      'show. Ask to join one, and an officer will admit you.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () => showCooperativesSheet(
                        context,
                        api: widget.api,
                        user: s.user,
                        onSwitch: _switchTo,
                        startJoining: true,
                      ).then((_) => setState(() => _future = _load())),
                      icon: const Icon(Icons.add),
                      label: const Text('Join a cooperative'),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: widget.onSignOut,
                      child: const Text('Sign out'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        // Non-members have no vote, so there is no Vote tab for them. Home,
        // Savings and Pay keep their positions (0–2) either way, which is
        // what the home tab's shortcuts navigate to.
        final isMember = s.membership?.isMember ?? true;
        final tabs = [
          HomeTab(api: widget.api, session: s, onNavigate: _go),
          SavingsTab(api: widget.api, membership: s.membership),
          ContributeTab(api: widget.api, membership: s.membership, onDone: () => _go(0)),
          if (isMember) VoteTab(api: widget.api, membership: s.membership),
          ProfileTab(api: widget.api, session: s, onSignOut: widget.onSignOut),
        ];
        final index = _index < tabs.length ? _index : 0;

        return Scaffold(
          // Keyed by society, so switching rebuilds every tab from scratch
          // rather than leaving the last society's figures on screen.
          body: KeyedSubtree(
            key: ValueKey(s.membership!.cooperativeId),
            child: IndexedStack(index: index, children: tabs),
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            onDestinationSelected: _go,
            backgroundColor: AppColors.card,
            indicatorColor: AppColors.green50,
            destinations: [
              const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
              const NavigationDestination(icon: Icon(Icons.savings_outlined), selectedIcon: Icon(Icons.savings), label: 'Savings'),
              const NavigationDestination(icon: Icon(Icons.add_circle_outline), selectedIcon: Icon(Icons.add_circle), label: 'Pay'),
              if (isMember)
                const NavigationDestination(icon: Icon(Icons.how_to_vote_outlined), selectedIcon: Icon(Icons.how_to_vote), label: 'Vote'),
              const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
            ],
          ),
        );
      },
    );
  }
}

class Session {
  Session(this.user, this.membership, {required this.onSwitch});
  final CurrentUser user;
  final Membership? membership;

  /// Make another of the member's societies the active one.
  final Future<void> Function(int cooperativeId) onSwitch;
}
