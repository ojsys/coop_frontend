import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'loan_detail_screen.dart';

/// A member's own loans + applying for a new one (created as 'pending' for an
/// officer to approve in the console).
class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key, required this.api, this.membership});
  final Api api;
  final Membership? membership;

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  late Future<List<Loan>> _future = widget.api.myLoans();

  void _reload() => setState(() => _future = widget.api.myLoans());

  Color _statusColor(String s) {
    switch (s) {
      case 'repaid':
      case 'approved':
        return AppColors.greenBright;
      case 'rejected':
        return AppColors.danger;
      case 'disbursed':
        return AppColors.goldDeep;
      default:
        return AppColors.muted;
    }
  }

  Future<void> _apply() async {
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => _ApplyLoanSheet(api: widget.api),
    );
    if (applied == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Loans & Credit'),
        backgroundColor: AppColors.card,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _apply,
        backgroundColor: AppColors.green,
        foregroundColor: AppColors.paper,
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<Loan>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load your loans.'), _reload);
            }
            final loans = snap.data!;
            if (loans.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Icon(Icons.request_quote_outlined,
                    color: AppColors.muted2, size: 44),
                SizedBox(height: 12),
                Center(
                    child: Text('You have no loans yet.',
                        style: TextStyle(color: AppColors.muted))),
                SizedBox(height: 4),
                Center(
                    child: Text('Tap Apply to request one.',
                        style:
                            TextStyle(color: AppColors.muted2, fontSize: 13))),
              ]);
            }
            return ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: loans.map(_loanCard).toList(),
            );
          },
        ),
      ),
    );
  }

  Future<void> _openDetail(Loan l) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LoanDetailScreen(
          api: widget.api, loanId: l.id, membership: widget.membership),
    ));
    _reload();
  }

  Widget _loanCard(Loan l) => InkWell(
        onTap: () => _openDetail(l),
        borderRadius: BorderRadius.circular(16),
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(l.productName,
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w700)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(l.status).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(l.statusDisplay,
                      style: TextStyle(
                          color: _statusColor(l.status),
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
                '${naira(l.principal)} @ ${l.interestRate.toStringAsFixed(0)}% flat · ${l.termMonths} mo'
                '${l.purpose.isNotEmpty ? ' · ${l.purpose}' : ''}',
                style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 8),
            Row(
              children: [
                _pill('Repayable', naira(l.totalRepayable)),
                const SizedBox(width: 10),
                if (l.status == 'disbursed')
                  _pill('Outstanding', naira(l.outstanding),
                      tone: AppColors.goldDeep),
                if (l.status == 'pending')
                  const Expanded(
                    child: Text('Awaiting officer approval',
                        style: TextStyle(
                            color: AppColors.muted2, fontSize: 12)),
                  ),
                const Spacer(),
                const Icon(Icons.chevron_right,
                    color: AppColors.muted2, size: 20),
              ],
            ),
            if (l.status == 'disbursed') ...[
              const SizedBox(height: 8),
              Row(
                children: const [
                  Icon(Icons.payments_outlined,
                      color: AppColors.green, size: 15),
                  SizedBox(width: 5),
                  Text('Tap to view schedule & repay',
                      style: TextStyle(
                          color: AppColors.green,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ],
            ],
          ),
        ),
      );

  Widget _pill(String label, String value, {Color tone = AppColors.ink}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: AppColors.muted2, fontSize: 11)),
          Text(value,
              style: TextStyle(
                  color: tone, fontSize: 14, fontWeight: FontWeight.w700)),
        ],
      );
}

class _ApplyLoanSheet extends StatefulWidget {
  const _ApplyLoanSheet({required this.api});
  final Api api;

  @override
  State<_ApplyLoanSheet> createState() => _ApplyLoanSheetState();
}

class _ApplyLoanSheetState extends State<_ApplyLoanSheet> {
  late final Future<List<LoanProduct>> _products = widget.api.loanProducts();
  LoanProduct? _product;
  final _amount = TextEditingController();
  final _term = TextEditingController(text: '6');
  final _purpose = TextEditingController();
  bool _submitting = false;

  String? _feeNote() {
    final amount = double.tryParse(_amount.text) ?? 0;
    final fee = _product?.feeFor(amount) ?? 0;
    if (fee <= 0 || amount <= 0) return null;
    final receive = amount - fee < 0 ? 0 : amount - fee;
    return 'Application fee ${naira(fee)} is deducted when the loan is paid '
        'out. You receive ${naira(receive)} and repay ${naira(amount)} plus '
        'interest.';
  }

  Future<void> _submit() async {
    if (_product == null || _amount.text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await widget.api.applyLoan(
        productId: _product!.id,
        principal: _amount.text,
        termMonths: int.tryParse(_term.text) ?? 6,
        purpose: _purpose.text,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 18,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Apply for a loan',
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 18,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('An officer reviews and approves your request.',
              style: TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 16),
          FutureBuilder<List<LoanProduct>>(
            future: _products,
            builder: (context, snap) {
              final products = snap.data ?? [];
              if (snap.connectionState == ConnectionState.waiting) {
                return const LinearProgressIndicator();
              }
              if (products.isEmpty) {
                return const Text('No loan products are available yet.',
                    style: TextStyle(color: AppColors.muted));
              }
              return DropdownButtonFormField<LoanProduct>(
                value: _product,
                decoration: const InputDecoration(
                    labelText: 'Loan product', border: OutlineInputBorder()),
                items: products
                    .map((p) => DropdownMenuItem(
                        value: p,
                        child: Text(
                            '${p.name} · ${p.interestRate.toStringAsFixed(0)}% flat')))
                    .toList(),
                onChanged: (p) => setState(() => _product = p),
              );
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  // Rebuilds the fee line below as the amount changes.
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                      labelText: 'Amount (₦)', border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _term,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Term (months)',
                      border: OutlineInputBorder()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _purpose,
            decoration: const InputDecoration(
                labelText: 'Purpose', border: OutlineInputBorder()),
          ),
          // The fee comes off what is paid out, but the member repays the full
          // amount — so show both before they submit.
          if (_feeNote() != null) ...[
            const SizedBox(height: 12),
            Text(_feeNote()!,
                style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Submit application'),
          ),
        ],
      ),
    );
  }
}
