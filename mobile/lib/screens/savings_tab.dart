import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

class SavingsTab extends StatefulWidget {
  const SavingsTab({super.key, required this.api, required this.membership});
  final Api api;
  final Membership? membership;

  @override
  State<SavingsTab> createState() => _SavingsTabState();
}

class _SavingsTabState extends State<SavingsTab> {
  late Future<MemberStatement> _future = _load();
  bool _downloading = false;

  Future<MemberStatement> _load() async {
    final m = widget.membership;
    if (m == null) throw ApiException('No membership', 0);
    return widget.api.statement(m.id);
  }

  Future<void> _downloadPdf() async {
    final m = widget.membership;
    if (m == null) return;
    setState(() => _downloading = true);
    try {
      final bytes = await widget.api.statementPdf(m.id);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/statement-${m.memberNo}.pdf');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open statement PDF')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _load()),
        child: FutureBuilder<MemberStatement>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load statement.'),
                  () => setState(() => _future = _load()));
            }
            final s = snap.data!;
            return ListView(
              padding: const EdgeInsets.only(top: 8),
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 12),
                  child: Text('My savings',
                      style: TextStyle(
                          color: AppColors.ink,
                          fontSize: 24,
                          fontWeight: FontWeight.w700)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: IntrinsicHeight(
                    child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _statCard(
                          'Total balance',
                          Text(naira(s.savingsBalance),
                              style: const TextStyle(
                                  color: AppColors.ink,
                                  fontSize: 19,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _statCard(
                          'Status',
                          const Row(
                            children: [
                              Icon(Icons.check_circle,
                                  color: AppColors.greenBright, size: 17),
                              SizedBox(width: 6),
                              Text('Up to date',
                                  style: TextStyle(
                                      color: AppColors.ink,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: OutlinedButton.icon(
                    onPressed: _downloading ? null : _downloadPdf,
                    icon: _downloading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.download),
                    label: const Text('Download PDF statement'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.green,
                      minimumSize: const Size.fromHeight(46),
                      side: const BorderSide(color: AppColors.line),
                    ),
                  ),
                ),
                const SectionTitle('Statement'),
                if (s.lines.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: Text('No transactions yet.',
                        style: TextStyle(color: AppColors.muted)),
                  )
                else
                  ...s.lines.map(_line),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _statCard(String label, Widget value) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.muted2,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            value,
          ],
        ),
      );

  Widget _line(StatementLine l) => AppCard(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.description,
                    style: const TextStyle(
                        color: AppColors.ink, fontWeight: FontWeight.w600)),
                Text(shortDate(l.date),
                    style: const TextStyle(color: AppColors.muted2, fontSize: 12)),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('+${naira(l.credit)}',
                    style: const TextStyle(
                        color: AppColors.greenBright, fontWeight: FontWeight.w700)),
                Text(naira(l.balance),
                    style: const TextStyle(color: AppColors.muted2, fontSize: 12)),
              ],
            ),
          ],
        ),
      );
}
