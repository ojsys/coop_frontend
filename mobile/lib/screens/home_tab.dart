import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'member_scaffold.dart';
import 'loans_screen.dart';
import 'savings_goals_screen.dart';
import 'dividends_screen.dart';
import 'cooperatives_sheet.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.api,
    required this.session,
    required this.onNavigate,
  });
  final Api api;
  final Session session;
  final ValueChanged<int> onNavigate;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  late Future<_Data> _future = _load();

  Future<_Data> _load() async {
    final m = widget.session.membership;
    final statement = m == null ? null : await widget.api.statement(m.id);
    final resolutions = await widget.api.resolutions();
    return _Data(statement, resolutions.where((r) => r.isOpen).length);
  }

  double _thisMonth(MemberStatement? s) {
    if (s == null) return 0;
    final now = DateTime.now();
    var total = 0.0;
    for (final l in s.lines) {
      final d = DateTime.tryParse(l.date);
      if (d != null && d.year == now.year && d.month == now.month) {
        total += l.credit;
      }
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _load()),
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                errorMessage(snap.error, 'Could not load.'),
                () => setState(() => _future = _load()),
              );
            }
            return _content(snap.data!);
          },
        ),
      ),
    );
  }

  Widget _content(_Data data) {
    final user = widget.session.user;
    final m = widget.session.membership;
    // Someone the society serves who has not joined: no vote, no shares, no
    // dividends — so none of those are offered.
    final isMember = m?.isMember ?? true;
    final lines = data.statement?.lines ?? [];

    final many = user.memberships.length > 1;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        // Which society this is, and the way to switch or join another.
        // Always offered: joining a second one starts here.
        Align(
          alignment: Alignment.centerLeft,
          child: Material(
            color: AppColors.green50,
            shape: const StadiumBorder(),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: () => showCooperativesSheet(
                context,
                api: widget.api,
                user: user,
                onSwitch: widget.session.onSwitch,
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 7, 10, 7),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.storefront_outlined,
                        size: 16, color: AppColors.green),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        m?.cooperativeName ?? 'CooperativeOS',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: AppColors.green,
                            fontSize: 13,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(many ? Icons.unfold_more : Icons.add,
                        size: 16, color: AppColors.green),
                    if (!many)
                      const Text(' Join another',
                          style: TextStyle(
                              color: AppColors.green, fontSize: 13)),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Header: greeting + avatar
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Good afternoon,',
                        style: TextStyle(color: AppColors.muted2, fontSize: 13)),
                    Text(user.fullName,
                        style: const TextStyle(
                            color: AppColors.ink,
                            fontSize: 19,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.green,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(initials(user.fullName),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14)),
              ),
            ],
          ),
        ),

        // Savings hero with gold glow + two sub-stat pills
        ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-0.9, -1),
                end: Alignment(1, 1),
                colors: [AppColors.green, AppColors.greenHover],
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -30,
                  top: -30,
                  child: Container(
                    width: 130,
                    height: 130,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.gold.withValues(alpha: 0.18),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Total savings · ${m?.cooperativeName ?? ''}',
                          style: const TextStyle(
                              color: Color(0xFF9CC4B3),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(naira(data.statement?.savingsBalance ?? 0),
                          style: const TextStyle(
                              color: AppColors.paper,
                              fontSize: 34,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(
                          isMember
                              ? 'Member ${m?.memberNo ?? ''} · ${m?.roleName ?? 'Member'}'
                              : 'Non-member ${m?.memberNo ?? ''}',
                          style: const TextStyle(
                              color: Color(0xFFCFE3D9), fontSize: 12)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _heroStat('This month', naira(_thisMonth(data.statement))),
                          if (isMember) ...[
                          const SizedBox(width: 10),
                          _heroStat('Share capital', naira(m?.shareCapital ?? 0),
                              info:
                                  'Your ownership stake in the cooperative — it '
                                  'makes you a part-owner. Your share of any '
                                  'year-end dividend is worked out from it.\n\n'
                                  'It is separate from your savings, which the '
                                  'society simply holds for you and you can '
                                  'withdraw. Share capital is usually returned '
                                  'only when you leave the cooperative.'),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Quick actions — three separate cards
        Row(
          children: [
            _quickAction(Icons.add_circle_outline, 'Contribute', () => widget.onNavigate(2)),
            const SizedBox(width: 10),
            _quickAction(Icons.receipt_long_outlined, 'Statement', () => widget.onNavigate(1)),
            const SizedBox(width: 10),
            isMember
                ? _quickAction(Icons.how_to_vote_outlined, 'Vote',
                    () => widget.onNavigate(3))
                : _quickAction(Icons.request_quote_outlined, 'Loans',
                    () => _open(LoansScreen(
                        api: widget.api,
                        membership: widget.session.membership))),
          ],
        ),

        // My Finance — the new member modules
        const Padding(
          padding: EdgeInsets.fromLTRB(2, 24, 2, 8),
          child: Text('My Finance',
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700)),
        ),
        Row(
          children: [
            _financeCard(Icons.request_quote_outlined, 'Loans',
                () => _open(LoansScreen(
                    api: widget.api, membership: widget.session.membership))),
            const SizedBox(width: 10),
            _financeCard(Icons.flag_outlined, 'Savings goals',
                () => _open(SavingsGoalsScreen(
                    api: widget.api,
                    canEdit: widget.session.membership
                            ?.hasFeature('savings_plans') ??
                        true))),
            if (isMember) ...[
              const SizedBox(width: 10),
              _financeCard(Icons.savings_outlined, 'Dividends',
                  () => _open(DividendsScreen(api: widget.api))),
            ],
          ],
        ),

        if (isMember && data.openVotes > 0) ...[
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => widget.onNavigate(3),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF6ECD2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.how_to_vote, color: AppColors.goldDeep),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${data.openVotes} resolution${data.openVotes > 1 ? 's' : ''} need${data.openVotes > 1 ? '' : 's'} your vote',
                          style: const TextStyle(
                              color: AppColors.ink, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        const Text('Tap to cast your ballot',
                            style: TextStyle(color: AppColors.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppColors.goldDeep),
                ],
              ),
            ),
          ),
        ],

        // Recent activity
        Padding(
          padding: const EdgeInsets.fromLTRB(2, 24, 2, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent activity',
                  style: TextStyle(
                      color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w700)),
              GestureDetector(
                onTap: () => widget.onNavigate(1),
                child: const Text('See all',
                    style: TextStyle(
                        color: AppColors.green,
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
        if (lines.isEmpty)
          const Text('No activity yet.', style: TextStyle(color: AppColors.muted))
        else
          ...lines.take(6).map(_activityTile),
      ],
    );
  }

  Widget _heroStat(String label, String value, {String? info}) {
    final tile = Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(label,
                  style:
                      const TextStyle(color: Color(0xFF9CC4B3), fontSize: 10.5)),
              if (info != null) ...[
                const SizedBox(width: 4),
                const Icon(Icons.info_outline,
                    size: 12, color: Color(0xFF9CC4B3)),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(
                  color: AppColors.paper,
                  fontSize: 16,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
    if (info == null) return Expanded(child: tile);
    return Expanded(
      child: GestureDetector(
        onTap: () => _showExplainer(label, info),
        child: tile,
      ),
    );
  }

  void _showExplainer(String title, String body) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.pie_chart_outline,
                    color: AppColors.green, size: 20),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 10),
            Text(body,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 14, height: 1.45)),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(46)),
                child: const Text('Got it'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _open(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Widget _financeCard(IconData icon, String label, VoidCallback onTap) =>
      Expanded(
        child: Material(
          color: AppColors.green50,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
              child: Column(
                children: [
                  Icon(icon, color: AppColors.green, size: 24),
                  const SizedBox(height: 6),
                  Text(label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: AppColors.green,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _quickAction(IconData icon, String label, VoidCallback onTap) => Expanded(
        child: Material(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  Icon(icon, color: AppColors.green, size: 25),
                  const SizedBox(height: 6),
                  Text(label,
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _activityTile(StatementLine l) => AppCard(
        margin: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration:
                  const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
              child: const Icon(Icons.arrow_downward, color: AppColors.greenBright, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.description,
                      style: const TextStyle(
                          color: AppColors.ink, fontWeight: FontWeight.w600)),
                  Text(shortDate(l.date),
                      style: const TextStyle(color: AppColors.muted2, fontSize: 12)),
                ],
              ),
            ),
            Text('+${naira(l.credit)}',
                style: const TextStyle(
                    color: AppColors.greenBright, fontWeight: FontWeight.w700)),
          ],
        ),
      );
}

class _Data {
  _Data(this.statement, this.openVotes);
  final MemberStatement? statement;
  final int openVotes;
}
