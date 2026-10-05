import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

/// A member's own dividend / surplus allocations by period (read-only).
class DividendsScreen extends StatefulWidget {
  const DividendsScreen({super.key, required this.api});
  final Api api;

  @override
  State<DividendsScreen> createState() => _DividendsScreenState();
}

class _DividendsScreenState extends State<DividendsScreen> {
  late Future<List<DividendRow>> _future = widget.api.myDividends();

  void _reload() => setState(() => _future = widget.api.myDividends());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Dividends'), backgroundColor: AppColors.card),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<DividendRow>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load your dividends.'),
                  _reload);
            }
            final rows = snap.data!;
            if (rows.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Icon(Icons.savings_outlined, color: AppColors.muted2, size: 44),
                SizedBox(height: 12),
                Center(
                    child: Text('No dividends yet.',
                        style: TextStyle(color: AppColors.muted))),
                SizedBox(height: 4),
                Center(
                    child: Text('Surplus distributions will appear here.',
                        style:
                            TextStyle(color: AppColors.muted2, fontSize: 13))),
              ]);
            }
            final total = rows
                .where((r) => r.status == 'posted')
                .fold<double>(0, (s, r) => s + r.amount);
            return ListView(
              padding: const EdgeInsets.only(top: 8),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                  child: GreenPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total dividends received',
                            style: TextStyle(
                                color: AppColors.green50, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text(naira(total),
                            style: const TextStyle(
                                color: AppColors.paper,
                                fontSize: 26,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
                ...rows.map(_row),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _row(DividendRow r) => AppCard(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(r.periodLabel,
                    style: const TextStyle(
                        color: AppColors.ink, fontWeight: FontWeight.w700)),
                Text(
                    r.status == 'posted' ? 'Paid to savings' : 'Declared (draft)',
                    style: TextStyle(
                        color: r.status == 'posted'
                            ? AppColors.greenBright
                            : AppColors.muted2,
                        fontSize: 12)),
              ],
            ),
            Text(naira(r.amount),
                style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      );
}
