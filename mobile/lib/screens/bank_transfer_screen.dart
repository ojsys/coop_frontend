import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';

/// What happened on the transfer screen.
enum TransferOutcome { sent, cancelled, restart }

/// Repaying by direct bank transfer: the society's account, the exact amount
/// and a narration reference, with 30 minutes on the clock. No Paystack fee.
///
/// "I've sent it" is what tells an officer to look for the money. After the
/// time is up the member can still say they sent it — money that arrived late
/// is still theirs — or start again.
class BankTransferScreen extends StatefulWidget {
  const BankTransferScreen({
    super.key,
    required this.api,
    required this.loanId,
    required this.transfer,
  });
  final Api api;
  final int loanId;
  final StartedTransfer transfer;

  @override
  State<BankTransferScreen> createState() => _BankTransferScreenState();
}

class _BankTransferScreenState extends State<BankTransferScreen> {
  Timer? _ticker;
  late Duration _left = _remaining();
  bool _busy = false;

  Duration _remaining() {
    final d = widget.transfer.expiresAt.difference(DateTime.now());
    return d.isNegative ? Duration.zero : d;
  }

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _left = _remaining());
      if (_left == Duration.zero) _ticker?.cancel();
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _sent() async {
    setState(() => _busy = true);
    try {
      await widget.api.reportStartedTransfer(widget.loanId, widget.transfer.id);
      if (mounted) Navigator.pop(context, TransferOutcome.sent);
    } catch (e) {
      if (mounted) _snack(errorMessage(e, 'Could not tell your society.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    setState(() => _busy = true);
    try {
      await widget.api.cancelTransfer(widget.loanId, widget.transfer.id);
      if (mounted) Navigator.pop(context, TransferOutcome.cancelled);
    } catch (e) {
      if (mounted) _snack(errorMessage(e, 'Could not cancel it.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String get _clock {
    final m = _left.inMinutes.toString().padLeft(2, '0');
    final s = (_left.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.transfer;
    final expired = _left == Duration.zero;
    final urgent = !expired && _left.inMinutes < 5;
    final tone = expired
        ? AppColors.danger
        : urgent
            ? AppColors.goldDeep
            : AppColors.green;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay by bank transfer'),
        backgroundColor: AppColors.card,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                if (expired) ...[
                  Text("Time's up",
                      style: TextStyle(
                          color: tone, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text(
                    "The 30 minutes have passed. If you already sent the money, "
                    "tap “I've sent it”. Otherwise start again.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 13),
                  ),
                ] else ...[
                  Text(
                    _clock,
                    style: TextStyle(
                      color: tone,
                      fontSize: 40,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const Text('left to send the transfer',
                      style: TextStyle(color: AppColors.muted, fontSize: 13)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              children: [
                _row('Amount to send', naira(t.amount),
                    copy: t.amount.toStringAsFixed(2), big: true),
                _divider(),
                _row('Bank', t.bank.bankName),
                _divider(),
                _row('Account number', t.bank.accountNo,
                    copy: t.bank.accountNo, mono: true),
                _divider(),
                _row('Account name', t.bank.accountName),
                _divider(),
                _row('Narration / remark', t.reference,
                    copy: t.reference, mono: true),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Send exactly ${naira(t.amount)} and put ${t.reference} in the '
            'narration, so your society can match it to your loan. Your bank '
            'may charge its usual transfer fee; there is no Paystack fee.',
            style: const TextStyle(color: AppColors.muted2, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : _sent,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.green,
              foregroundColor: AppColors.paper,
              minimumSize: const Size.fromHeight(52),
            ),
            icon: const Icon(Icons.check_circle_outline, size: 20),
            label: const Text("I've sent it"),
          ),
          const SizedBox(height: 8),
          if (expired)
            OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : () => Navigator.pop(context, TransferOutcome.restart),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.green,
                side: const BorderSide(color: AppColors.green),
                minimumSize: const Size.fromHeight(48),
              ),
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Start again'),
            )
          else
            TextButton(
              onPressed: _busy ? null : _cancel,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.muted,
                minimumSize: const Size.fromHeight(44),
              ),
              child: const Text('Cancel this transfer'),
            ),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(height: 1, color: AppColors.line);

  Widget _row(String label, String value,
          {String? copy, bool mono = false, bool big = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(color: AppColors.muted2, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: TextStyle(
                      color: AppColors.ink,
                      fontSize: big ? 18 : 14,
                      fontWeight: big ? FontWeight.w700 : FontWeight.w600,
                      letterSpacing: mono ? 1 : 0,
                    ),
                  ),
                ],
              ),
            ),
            if (copy != null)
              TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: copy));
                  _snack('$label copied');
                },
                style: TextButton.styleFrom(foregroundColor: AppColors.green),
                icon: const Icon(Icons.copy, size: 16),
                label: const Text('Copy'),
              ),
          ],
        ),
      );
}
