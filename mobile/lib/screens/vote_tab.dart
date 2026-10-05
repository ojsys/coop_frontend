import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

class VoteTab extends StatefulWidget {
  const VoteTab({super.key, required this.api, required this.membership});
  final Api api;
  final Membership? membership;

  @override
  State<VoteTab> createState() => _VoteTabState();
}

class _VoteTabState extends State<VoteTab> {
  late Future<List<Resolution>> _future = widget.api.resolutions();
  int? _busyId;

  Future<void> _vote(Resolution r, String choice) async {
    final m = widget.membership;
    if (m == null) return;
    setState(() => _busyId = r.id);
    try {
      await widget.api.vote(r.id, m.id, choice);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Vote recorded: $choice')),
      );
      setState(() => _future = widget.api.resolutions());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async =>
            setState(() => _future = widget.api.resolutions()),
        child: FutureBuilder<List<Resolution>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            final items = snap.data ?? [];
            return ListView(
              padding: const EdgeInsets.only(top: 8, bottom: 24),
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Text('Vote',
                      style: TextStyle(
                          color: AppColors.ink,
                          fontSize: 24,
                          fontWeight: FontWeight.w700)),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 2, 20, 8),
                  child: Text('One member, one vote',
                      style: TextStyle(color: AppColors.muted)),
                ),
                if (items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('No resolutions to vote on right now.',
                        style: TextStyle(color: AppColors.muted)),
                  )
                else
                  ...items.asMap().entries.map((e) => _card(e.value, e.key + 1)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _card(Resolution r, int number) {
    final forPct = r.total == 0 ? 0.0 : r.votesFor / r.total;
    final tag = r.isOpen ? 'NEEDS YOUR VOTE' : r.status.toUpperCase();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('RESOLUTION $number · $tag',
              style: TextStyle(
                  color: r.isOpen ? AppColors.gold : AppColors.muted2,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6)),
          const SizedBox(height: 6),
          Text(r.title,
              style: const TextStyle(
                  color: AppColors.ink, fontSize: 15.5, fontWeight: FontWeight.w700)),
          if (r.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(r.description, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
          const SizedBox(height: 12),
          if (r.isOpen && r.hasVoted)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.green50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle,
                      color: AppColors.greenBright, size: 18),
                  const SizedBox(width: 8),
                  Text('You voted: ${r.myVote![0].toUpperCase()}${r.myVote!.substring(1)}',
                      style: const TextStyle(
                          color: AppColors.ink, fontWeight: FontWeight.w600)),
                ],
              ),
            )
          else if (r.isOpen)
            Row(
              children: [
                _voteBtn(r, 'for', 'For', Icons.thumb_up_outlined, AppColors.green, AppColors.green50),
                const SizedBox(width: 8),
                _voteBtn(r, 'against', 'Against', Icons.thumb_down_outlined, AppColors.danger, const Color(0xFFF7E6E1)),
                const SizedBox(width: 8),
                _voteBtn(r, 'abstain', 'Abstain', Icons.remove, AppColors.muted, AppColors.sand),
              ],
            )
          else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${r.votesFor} for (${(forPct * 100).round()}%)',
                    style: const TextStyle(
                        color: AppColors.greenBright, fontWeight: FontWeight.w600, fontSize: 13)),
                Text('${r.votesAgainst} against',
                    style: const TextStyle(color: AppColors.muted, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: forPct,
                minHeight: 6,
                backgroundColor: AppColors.sand,
                color: AppColors.greenBright,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _voteBtn(Resolution r, String choice, String label, IconData icon,
      Color fg, Color bg) {
    final busy = _busyId == r.id;
    return Expanded(
      child: InkWell(
        onTap: busy ? null : () => _vote(r, choice),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: fg.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Icon(icon, color: fg, size: 20),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}
