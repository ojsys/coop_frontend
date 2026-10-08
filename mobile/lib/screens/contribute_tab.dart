import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'payment_webview.dart';
import 'mock_checkout.dart';

class ContributeTab extends StatefulWidget {
  const ContributeTab({
    super.key,
    required this.api,
    required this.membership,
    required this.onDone,
  });
  final Api api;
  final Membership? membership;
  final VoidCallback onDone;

  @override
  State<ContributeTab> createState() => _ContributeTabState();
}

class _ContributeTabState extends State<ContributeTab> {
  // Not `late final`: the error state offers a Retry, which has to be able to
  // replace this future.
  late Future<List<ContributionType>> _future = widget.api.contributionTypes();
  final _amount = TextEditingController();

  // Paystack's fee is the member's to pay, on top of the contribution, so the
  // society receives all of it. Quoted by the server — the same figure the
  // checkout charges — and shown before they pay.
  FeeQuote? _quote;
  int _quoteSeq = 0;

  Future<void> _refreshQuote() async {
    final seq = ++_quoteSeq;
    final v = _amount.text.trim();
    if ((double.tryParse(v) ?? 0) <= 0) {
      if (mounted) setState(() => _quote = null);
      return;
    }
    try {
      final q = await widget.api.feeQuote(v);
      if (mounted && seq == _quoteSeq) setState(() => _quote = q);
    } catch (_) {
      if (mounted && seq == _quoteSeq) setState(() => _quote = null);
    }
  }
  int? _typeId;
  String _gateway = 'paystack';
  bool _paying = false;

  // Payment gateways. The actual method (card, transfer, USSD…) is chosen inside
  // the gateway's checkout. Add another gateway (e.g. Flutterwave) here later.
  static const _gateways = [
    ('paystack', 'Paystack', 'Card, bank transfer, USSD & more', Icons.credit_card),
  ];

  Future<void> _pay() async {
    final m = widget.membership;
    if (m == null || _typeId == null || _amount.text.isEmpty) return;
    setState(() => _paying = true);
    final reference = 'MOBILE-${DateTime.now().millisecondsSinceEpoch}';
    final amount = _amount.text;
    try {
      final init = await widget.api.initiateContribution(
        membershipId: m.id,
        typeId: _typeId!,
        amount: amount,
        channel: 'psp',
        reference: reference,
        callbackUrl: kPaymentReturnUrl,
      );
      if (!mounted) return;

      if (init.error != null) {
        _snack("Couldn't start payment: ${init.error}");
        return;
      }

      // Present the checkout: live Paystack in a webview, or the test checkout
      // when no key is configured. The member must complete it before we verify.
      bool? finished;
      if (init.authorizationUrl != null) {
        finished = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => PaymentWebView(checkoutUrl: init.authorizationUrl!),
          ),
        );
      } else if (init.simulated) {
        finished = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => MockCheckout(
              amount: double.tryParse(amount) ?? 0,
              coopName: m.cooperativeName,
              memberNo: m.memberNo,
            ),
          ),
        );
      } else {
        _snack('Payment could not be started. Please try again.');
        return;
      }
      if (finished != true) return; // member closed / cancelled the checkout

      // Verify the charge → posts to the ledger immediately on success.
      final status = await widget.api.verifyPayment(reference);
      if (!mounted) return;
      if (status == 'confirmed') {
        _snack('Payment successful — ${naira(double.tryParse(amount) ?? 0)} added to your savings');
        widget.onDone();
      } else {
        _snack('Payment not completed. If you were charged it will reconcile shortly.');
      }
    } catch (e) {
      if (mounted) _snack('Could not process payment: $e');
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _reload() =>
      setState(() => _future = widget.api.contributionTypes());

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FutureBuilder<List<ContributionType>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return loadingCenter();
          }
          // A failure also produces an empty list, so without this branch a
          // request that never arrived was reported as "your cooperative has no
          // contribution types" — a confident wrong answer.
          if (snap.hasError) {
            return errorState(
              errorMessage(snap.error, 'Could not load contribution types.'),
              _reload,
            );
          }
          final types = snap.data ?? [];
          // Nothing to pay into means nothing to select, which left the Pay
          // button permanently disabled with no explanation on screen.
          if (types.isEmpty) {
            return emptyState(
              'Nothing to pay into yet',
              'An officer of your cooperative needs to set up a contribution '
              'type — such as monthly dues or a building fund — before payments '
              'can be made.',
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            children: [
              const Text('Make a contribution',
                  style: TextStyle(
                      color: AppColors.ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              const Text('What are you paying for?',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...types.map(_typeTile),
              const SizedBox(height: 16),
              const Text('Amount',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _amount,
                keyboardType: TextInputType.number,
                onChanged: (_) {
                  setState(() {});
                  _refreshQuote();
                },
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.ink),
                decoration: InputDecoration(
                  prefixText: '₦ ',
                  hintText: '0',
                  filled: true,
                  fillColor: AppColors.card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Pay with',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ..._gateways.map((g) {
                final on = g.$1 == _gateway;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () => setState(() => _gateway = g.$1),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: on ? AppColors.green50 : AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: on ? AppColors.green : AppColors.line),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppColors.green50,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(g.$4, color: AppColors.green, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(g.$2,
                                    style: const TextStyle(
                                        color: AppColors.ink,
                                        fontWeight: FontWeight.w700)),
                                Text(g.$3,
                                    style: const TextStyle(
                                        color: AppColors.muted, fontSize: 12)),
                              ],
                            ),
                          ),
                          Icon(
                            on ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                            color: on ? AppColors.green : AppColors.muted2,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
              if (_quote != null && _quote!.fee > 0) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.sand,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      FeeQuoteRow.row('Contribution', _quote!.amount),
                      FeeQuoteRow.row('Paystack fee', _quote!.fee),
                      const Divider(height: 12),
                      FeeQuoteRow.row('You pay', _quote!.total, bold: true),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: (_typeId == null || _amount.text.isEmpty || _paying)
                    ? null
                    : _pay,
                icon: _paying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.paper))
                    : const Icon(Icons.lock_outline),
                label: Text(_quote != null
                    ? 'Pay ${koboText(_quote!.total)} securely'
                    : _amount.text.isNotEmpty &&
                            double.tryParse(_amount.text) != null
                        ? 'Pay ${naira(double.parse(_amount.text))} securely'
                        : 'Pay securely'),
              ),
              const SizedBox(height: 8),
              const Center(
                child: Text("Settles to your society's own account via Paystack",
                    style: TextStyle(color: AppColors.muted2, fontSize: 12)),
              ),
            ],
          );
        },
      ),
    );
  }

  IconData _iconFor(ContributionType t) {
    final n = t.name.toLowerCase();
    if (n.contains('building') || n.contains('fund')) return Icons.foundation;
    if (n.contains('target') || n.contains('ajo') || n.contains('saving')) {
      return Icons.savings_outlined;
    }
    if (n.contains('share') || n.contains('capital')) return Icons.pie_chart_outline;
    return Icons.event_repeat; // recurring dues/levies
  }

  Widget _typeTile(ContributionType t) {
    final on = t.id == _typeId;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => setState(() {
          _typeId = t.id;
          if (t.expectedAmount != null) {
            _amount.text = t.expectedAmount!.toStringAsFixed(0);
            _refreshQuote();
          }
        }),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: on ? AppColors.green : AppColors.line,
                width: on ? 2 : 1),
          ),
          child: Row(
            children: [
              Icon(_iconFor(t),
                  size: 22, color: on ? AppColors.green : AppColors.muted2),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.name,
                        style: const TextStyle(
                            color: AppColors.ink,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700)),
                    Text(
                      t.expectedAmount != null
                          ? '${naira(t.expectedAmount!)} · ${t.frequency}'
                          : 'Any amount · ${t.frequency}',
                      style: const TextStyle(color: AppColors.muted2, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              Icon(on ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  size: 22, color: on ? AppColors.green : AppColors.muted2),
            ],
          ),
        ),
      ),
    );
  }
}
