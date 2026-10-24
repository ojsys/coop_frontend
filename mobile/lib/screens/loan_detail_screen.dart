import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'bank_transfer_screen.dart';
import 'payment_webview.dart';

/// A member's loan in detail: balances, the repayment schedule, how to repay
/// (online via Paystack or by direct transfer to the society's account).
class LoanDetailScreen extends StatefulWidget {
  const LoanDetailScreen({
    super.key,
    required this.api,
    required this.loanId,
    this.membership,
  });
  final Api api;
  final int loanId;
  final Membership? membership;

  @override
  State<LoanDetailScreen> createState() => _LoanDetailScreenState();
}

class _LoanDetailScreenState extends State<LoanDetailScreen> {
  late Future<Loan> _future = widget.api.myLoan(widget.loanId);
  bool _paying = false;

  void _reload() => setState(() => _future = widget.api.myLoan(widget.loanId));

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

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _repay(Loan loan) async {
    final choice = await showModalBottomSheet<_RepayChoice>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _RepaySheet(loan: loan, api: widget.api),
    );
    if (choice == null) return;

    // Bank transfer, no fee: get the account and a reference, then 30 minutes
    // to send it.
    if (choice.method == 'start-transfer') {
      try {
        final started = await widget.api.startTransfer(loan.id, choice.amount);
        if (!mounted) return;
        await _openTransfer(loan, started);
      } catch (e) {
        if (mounted) _snack(errorMessage(e, 'Could not get the account details.'));
      }
      return;
    }

    // A transfer already sent outside the app: the member says they've paid →
    // record a pending claim an officer verifies and confirms.
    if (choice.method == 'transfer') {
      try {
        await widget.api.reportTransfer(loan.id, choice.amount, choice.note);
        if (!mounted) return;
        _snack('Reported — your society will confirm it shortly');
        _reload();
      } catch (e) {
        if (mounted) _snack('Could not submit: $e');
      }
      return;
    }

    // Paystack (online) payment.
    setState(() => _paying = true);
    final reference = 'LRPY-${DateTime.now().millisecondsSinceEpoch}';
    try {
      final init = await widget.api.initiateLoanRepayment(
        loanId: loan.id,
        amount: choice.amount,
        reference: reference,
        callbackUrl: kPaymentReturnUrl,
      );
      if (!mounted) return;
      if (init.error != null) {
        _snack("Couldn't start payment: ${init.error}");
        return;
      }

      // Follows the member PWA: a live Paystack checkout opens in a webview and
      // is verified on return; in dev/simulated mode we settle directly (no
      // checkout screen). Either way, verify posts the repayment to the ledger.
      if (init.authorizationUrl != null) {
        final finished = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => PaymentWebView(checkoutUrl: init.authorizationUrl!),
          ),
        );
        if (finished != true) return;
      } else if (!init.simulated) {
        _snack('Payment could not be started. Please try again.');
        return;
      }

      // The server answers with an error unless Paystack confirms the full
      // amount arrived — returning from checkout also happens on cancel.
      try {
        await widget.api.verifyLoanRepayment(loan.id, reference);
      } on ApiException catch (e) {
        if (mounted) _snack('Payment not completed: ${e.message}');
        _reload();
        return;
      }
      if (!mounted) return;
      _snack('Repayment received — thank you!');
      _reload();
    } catch (e) {
      if (mounted) _snack('Could not process payment: $e');
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  Future<void> _openTransfer(Loan loan, StartedTransfer started) async {
    final outcome = await Navigator.of(context).push<TransferOutcome>(
      MaterialPageRoute(
        builder: (_) => BankTransferScreen(
            api: widget.api, loanId: loan.id, transfer: started),
      ),
    );
    if (!mounted) return;
    _reload();
    if (outcome == TransferOutcome.sent) {
      _snack('Thanks — your society will confirm it once the money arrives');
    } else if (outcome == TransferOutcome.restart) {
      await _repay(loan);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Loan details'),
        backgroundColor: AppColors.card,
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<Loan>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load this loan.'), _reload);
            }
            final loan = snap.data!;
            return ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _summary(loan),
                if (loan.status == 'disbursed' && loan.unsentTransfer != null)
                  _unsentTransfer(loan, loan.unsentTransfer!),
                if (loan.pendingClaims.isNotEmpty) _pendingClaims(loan),
                if (loan.instalments.isNotEmpty)
                  _schedule(loan)
                else if (loan.termMonths > 0 && loan.monthlyInstalment > 0)
                  _schedulePreview(loan),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
      bottomNavigationBar: FutureBuilder<Loan>(
        future: _future,
        builder: (context, snap) {
          final loan = snap.data;
          if (loan == null || loan.status != 'disbursed') {
            return const SizedBox.shrink();
          }
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.card,
              border: Border(top: BorderSide(color: AppColors.line)),
            ),
            child: SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: FilledButton.icon(
                onPressed: _paying ? null : () => _repay(loan),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.green,
                  foregroundColor: AppColors.paper,
                  minimumSize: const Size.fromHeight(52),
                ),
                icon: _paying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.paper,
                        ),
                      )
                    : const Icon(Icons.payments_outlined, size: 20),
                label: Text(
                  'Make a repayment · ${naira(loan.outstanding)} left',
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _summary(Loan l) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                l.productName,
                style: const TextStyle(
                  color: AppColors.ink,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: _statusColor(l.status).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                l.statusDisplay,
                style: TextStyle(
                  color: _statusColor(l.status),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '${naira(l.principal)} @ ${l.interestRate.toStringAsFixed(0)}% flat · ${l.termMonths} mo'
          '${l.purpose.isNotEmpty ? ' · ${l.purpose}' : ''}',
          style: const TextStyle(color: AppColors.muted, fontSize: 13),
        ),
        if (l.applicationFee > 0) ...[
          const SizedBox(height: 2),
          Text(
            '${naira(l.applicationFee)} application fee · you receive '
            '${naira(l.amountToDisburse)}',
            style: const TextStyle(color: AppColors.muted2, fontSize: 12),
          ),
        ],
        const SizedBox(height: 14),
        Row(
          children: [
            _stat('Repayable', naira(l.totalRepayable)),
            _stat('Repaid', naira(l.repaidAmount)),
            _stat(
              'Outstanding',
              naira(l.outstanding),
              tone: AppColors.goldDeep,
            ),
          ],
        ),
        if (l.status == 'pending' || l.status == 'approved') ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.sand,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              l.status == 'pending'
                  ? 'Awaiting officer approval.'
                  : 'Approved — awaiting disbursement.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
        ],
      ],
    ),
  );

  Widget _stat(String label, String value, {Color tone = AppColors.ink}) =>
      Expanded(
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.sand,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text(
                label,
                style: const TextStyle(color: AppColors.muted2, fontSize: 11),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  color: tone,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _schedule(Loan l) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(
              Icons.calendar_month_outlined,
              color: AppColors.muted2,
              size: 18,
            ),
            SizedBox(width: 6),
            Text(
              'Repayment schedule',
              style: TextStyle(
                color: AppColors.ink,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ...l.instalments.map(_instalmentRow),
      ],
    ),
  );

  // Shown when the dated schedule isn't available yet (before disbursement, or
  // if the server hasn't returned instalments): the planned fixed repayments.
  Widget _schedulePreview(Loan l) {
    final n = l.termMonths;
    final last = l.totalRepayable - l.monthlyInstalment * (n - 1);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.calendar_month_outlined,
                color: AppColors.muted2,
                size: 18,
              ),
              SizedBox(width: 6),
              Text(
                'Repayment plan',
                style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '$n fixed monthly payments of ${naira(l.monthlyInstalment)}.'
            '${l.status == 'disbursed' ? '' : ' Dates are set once the loan is disbursed.'}',
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          ...List.generate(n, (k) {
            final amount = k < n - 1 ? l.monthlyInstalment : last;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Month ${k + 1}',
                    style: const TextStyle(
                      color: AppColors.muted2,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    naira(amount),
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _instalmentRow(Instalment i) {
    final Color bg;
    final Color fg;
    final String label;
    if (i.isPaid) {
      bg = AppColors.green50;
      fg = AppColors.green;
      label = 'Paid';
    } else if (i.isOverdue) {
      bg = const Color(0xFFF7E6E1);
      fg = AppColors.danger;
      label = 'Overdue';
    } else if (i.amountPaid > 0) {
      bg = const Color(0xFFFBF0DA);
      fg = AppColors.goldDeep;
      label = 'Part paid';
    } else {
      bg = AppColors.sand;
      fg = AppColors.muted2;
      label = 'Pending';
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: i.isPaid
                ? Icon(Icons.check, color: fg, size: 15)
                : Text(
                    '${i.sequence}',
                    style: TextStyle(
                      color: fg,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  naira(i.amountDue),
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Due ${shortDate(i.dueDate)} · ${naira(i.principalComponent)} principal + ${naira(i.interestComponent)} interest',
                  style: const TextStyle(color: AppColors.muted2, fontSize: 12),
                ),
                // Small payments land here first, so show how far this one is.
                if (!i.isPaid && i.amountPaid > 0) ...[
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (i.amountPaid / i.amountDue).clamp(0.0, 1.0),
                      minHeight: 5,
                      backgroundColor: AppColors.sand,
                      color: AppColors.green,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${naira(i.amountPaid)} paid · ${naira(i.amountDue - i.amountPaid)} to go',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              label,
              style: TextStyle(
                color: fg,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// A transfer started but not reported as sent — tap to pick it up again.
  Widget _unsentTransfer(Loan l, StartedTransfer t) {
    final left = t.expiresAt.difference(DateTime.now());
    return AppCard(
      child: InkWell(
        onTap: () => _openTransfer(l, t),
        child: Row(
          children: [
            const Icon(Icons.timer_outlined, color: AppColors.goldDeep),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bank transfer of ${naira(t.amount)} started',
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    left.isNegative
                        ? "Time's up. Tap if you already sent it."
                        : 'About ${left.inMinutes + 1} min left. Tap to see the account details.',
                    style: const TextStyle(color: AppColors.muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.muted2),
          ],
        ),
      ),
    );
  }

  Widget _pendingClaims(Loan l) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.hourglass_top, color: AppColors.goldDeep, size: 18),
            SizedBox(width: 6),
            Text(
              'Awaiting confirmation',
              style: TextStyle(
                color: AppColors.ink,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ...l.pendingClaims.map(
          (c) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Text(
              'You reported a transfer of ${naira(c.amount)}. Your '
              'society will confirm it once received.',
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
        ),
      ],
    ),
  );
}

/// What the member chose in the repayment sheet: pay online with Paystack, or
/// declare a bank transfer they've made.
class _RepayChoice {
  const _RepayChoice.paystack(this.amount) : method = 'paystack', note = '';
  const _RepayChoice.startTransfer(this.amount)
      : method = 'start-transfer',
        note = '';
  const _RepayChoice.transfer(this.amount, this.note) : method = 'transfer';
  final String method;
  final String amount;
  final String note;
}

class _RepaySheet extends StatefulWidget {
  const _RepaySheet({required this.loan, required this.api});
  final Loan loan;
  final Api api;

  @override
  State<_RepaySheet> createState() => _RepaySheetState();
}

class _RepaySheetState extends State<_RepaySheet> {
  late final Instalment? _next = widget.loan.instalments
      .where((i) => !i.isPaid)
      .cast<Instalment?>()
      .firstWhere((_) => true, orElse: () => null);
  // Any amount up to the balance, any day: members repay in small sums as
  // money comes in. The chips are the two amounts most often wanted.
  final TextEditingController _amount = TextEditingController();

  void _use(double amount) {
    _amount.text = amount.toStringAsFixed(2);
    _refreshQuote();
  }
  final TextEditingController _note = TextEditingController();
  // Bank transfer first where the society has an account: it costs the
  // member nothing, where Paystack adds its fee on top.
  late String _method = widget.loan.coopBank != null ? 'transfer' : 'paystack';
  bool _alreadySent = false;

  // Paystack's fee is the member's to pay, on top of the repayment, so the
  // society receives all of it. Quoted by the server (the same figure the
  // checkout is opened with) and shown before they pay.
  FeeQuote? _quote;
  int _quoteSeq = 0;

  @override
  void initState() {
    super.initState();
    _refreshQuote();
  }

  Future<void> _refreshQuote() async {
    final seq = ++_quoteSeq;
    final v = _amount.text.trim();
    if ((double.tryParse(v) ?? 0) <= 0) {
      setState(() => _quote = null);
      return;
    }
    try {
      final q = await widget.api.repayQuote(widget.loan.id, v);
      // Only the latest keystroke's answer counts.
      if (mounted && seq == _quoteSeq) setState(() => _quote = q);
    } catch (_) {
      if (mounted && seq == _quoteSeq) setState(() => _quote = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Make a repayment',
              style: TextStyle(
                color: AppColors.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Outstanding ${naira(widget.loan.outstanding)}',
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amount,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => _refreshQuote(),
              decoration: const InputDecoration(
                labelText: 'Amount (₦)',
                hintText: 'Any amount',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (_next != null &&
                    _next.amountDue - _next.amountPaid < widget.loan.outstanding)
                  ActionChip(
                    label: Text(
                      '${_next.amountPaid > 0 ? 'Rest of' : 'Next'} instalment · '
                      '${naira(_next.amountDue - _next.amountPaid)}',
                    ),
                    onPressed: () => _use(_next.amountDue - _next.amountPaid),
                  ),
                ActionChip(
                  label: Text('Pay it all off · ${naira(widget.loan.outstanding)}'),
                  onPressed: () => _use(widget.loan.outstanding),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Pay any amount, whenever you have it. It goes to your earliest '
              'unpaid instalment first, and your interest is fixed, so paying '
              'early never adds to it. You just finish sooner.'
              '${_next != null ? ' Next due ${shortDate(_next.dueDate)}.' : ''}',
              style: const TextStyle(color: AppColors.muted2, fontSize: 12),
            ),
            if (widget.loan.coopBank != null) ...[
              const SizedBox(height: 14),
              const Text(
                'How do you want to pay?',
                style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              _methodTile(
                value: 'transfer',
                icon: Icons.account_balance_outlined,
                title: 'Bank transfer',
                badge: 'No fee',
                detail: "Send it from your bank app to your society's account "
                    'within 30 minutes. An officer confirms it once it arrives.',
              ),
              const SizedBox(height: 8),
              _methodTile(
                value: 'paystack',
                icon: Icons.credit_card,
                title: 'Card or USSD with Paystack',
                badge: _quote != null && _quote!.fee > 0
                    ? '+ ${koboText(_quote!.fee)} fee'
                    : null,
                detail: "Confirmed straight away. Paystack's fee is added on top.",
              ),
            ],
            if (_method == 'paystack' && _quote != null && _quote!.fee > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.sand,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    FeeQuoteRow.row('Repayment', _quote!.amount),
                    FeeQuoteRow.row('Paystack fee', _quote!.fee),
                    const Divider(height: 12),
                    FeeQuoteRow.row('You pay', _quote!.total, bold: true),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () {
                final v = _amount.text.trim();
                if (v.isEmpty || (double.tryParse(v) ?? 0) <= 0) return;
                Navigator.pop(
                  context,
                  _method == 'transfer'
                      ? _RepayChoice.startTransfer(v)
                      : _RepayChoice.paystack(v),
                );
              },
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              icon: Icon(
                _method == 'transfer'
                    ? Icons.account_balance_outlined
                    : Icons.lock_outline,
                size: 18,
              ),
              label: Text(_method == 'transfer'
                  ? 'Show account details'
                  : _quote == null
                      ? 'Pay with Paystack'
                      : 'Pay ${koboText(_quote!.total)} with Paystack'),
            ),
            if (_method == 'paystack') ...[
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'Card, bank transfer & USSD · settles to your society',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12),
                ),
              ),
            ],
            // A transfer made outside the app, without the 30-minute flow.
            if (widget.loan.coopBank != null) ...[
              const SizedBox(height: 10),
              Center(
                child: TextButton(
                  onPressed: () => setState(() => _alreadySent = !_alreadySent),
                  child: Text(_alreadySent
                      ? 'Hide'
                      : 'Already sent a transfer? Tell your society'),
                ),
              ),
              if (_alreadySent) ...[
                _bankBlock(widget.loan.coopBank!),
                const SizedBox(height: 12),
                TextField(
                  controller: _note,
                  decoration: const InputDecoration(
                    labelText: 'Transfer reference / note (optional)',
                    hintText: 'e.g. GTBank, 29 Jul',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () {
                    final v = _amount.text.trim();
                    if (v.isEmpty || (double.tryParse(v) ?? 0) <= 0) return;
                    Navigator.pop(
                      context,
                      _RepayChoice.transfer(v, _note.text.trim()),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.green,
                    side: const BorderSide(color: AppColors.green),
                    minimumSize: const Size.fromHeight(48),
                  ),
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text("I've made the transfer"),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Enter the amount you sent above, then tap this. An officer '
                  'verifies it and confirms it on your loan.',
                  style: TextStyle(color: AppColors.muted2, fontSize: 12),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _methodTile({
    required String value,
    required IconData icon,
    required String title,
    String? badge,
    required String detail,
  }) {
    final selected = _method == value;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => setState(() => _method = value),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppColors.green.withValues(alpha: 0.06) : null,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: selected ? AppColors.green : AppColors.line,
              width: selected ? 1.5 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 20,
              color: selected ? AppColors.green : AppColors.muted2,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Icon(icon, size: 16, color: AppColors.muted2),
                      Text(title,
                          style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700)),
                      if (badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: badge == 'No fee'
                                ? AppColors.green.withValues(alpha: 0.12)
                                : AppColors.sand,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(badge,
                              style: TextStyle(
                                  color: badge == 'No fee'
                                      ? AppColors.green
                                      : AppColors.muted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(detail,
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12, height: 1.35)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bankBlock(CoopBank b) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.sand,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _bankLine('Bank', b.bankName),
        const SizedBox(height: 6),
        _bankLine('Account name', b.accountName),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Account number',
              style: TextStyle(color: AppColors.muted2, fontSize: 13),
            ),
            Row(
              children: [
                Text(
                  b.accountNo,
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: b.accountNo));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Account number copied')),
                    );
                  },
                  child: const Icon(
                    Icons.copy,
                    size: 16,
                    color: AppColors.green,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 10),
        const Text(
          'After transferring, your society confirms the repayment once '
          'the money is received — it will then show on your schedule.',
          style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.35),
        ),
      ],
    ),
  );

  Widget _bankLine(String label, String value) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        label,
        style: const TextStyle(color: AppColors.muted2, fontSize: 13),
      ),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.right,
          style: const TextStyle(
            color: AppColors.ink,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
  );
}
