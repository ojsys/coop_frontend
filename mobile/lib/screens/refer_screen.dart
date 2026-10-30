import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

/// Refer & earn, as on the web's /refer page: a personal link to share, what
/// it has earned, and withdrawals to the referrer's bank. The platform pays
/// withdrawals by hand, so a request shows as pending until it does.
class ReferScreen extends StatefulWidget {
  const ReferScreen({super.key, required this.api});
  final Api api;

  @override
  State<ReferScreen> createState() => _ReferScreenState();
}

class _ReferScreenState extends State<ReferScreen> {
  late Future<ReferrerDashboard?> _future = widget.api.referrer();
  bool _busy = false;

  void _reload() => setState(() => _future = widget.api.referrer());

  void _toast(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  Future<void> _turnOn() async {
    setState(() => _busy = true);
    try {
      final dashboard = await widget.api.becomeReferrer();
      if (mounted) setState(() => _future = Future.value(dashboard));
    } catch (e) {
      _toast(errorMessage(e, 'Could not turn referrals on.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy(String text, String what) async {
    await Clipboard.setData(ClipboardData(text: text));
    _toast('$what copied');
  }

  Future<void> _editBank(ReferrerDashboard d) async {
    final saved = await showModalBottomSheet<ReferrerDashboard>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      builder: (_) => _BankSheet(api: widget.api, current: d),
    );
    if (saved != null && mounted) {
      setState(() => _future = Future.value(saved));
      _toast('Bank details saved');
    }
  }

  Future<void> _withdraw(ReferrerDashboard d) async {
    if (!d.hasBankDetails) {
      _toast('Add your bank details first.');
      return _editBank(d);
    }
    final amount = TextEditingController(text: d.available.toStringAsFixed(0));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Paid to ${d.bankName} ${d.accountNo}.',
                style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Amount (₦)',
                helperText: 'Minimum ${naira(d.program.minimumPayout)}',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Request payout')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.api.requestReferralPayout(amount.text.trim());
      _toast('Requested. We normally pay within 14 days.');
      _reload();
    } catch (e) {
      _toast(errorMessage(e, 'Could not request the payout.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Refer & earn'), backgroundColor: AppColors.card),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<ReferrerDashboard?>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (snap.hasError) {
              return errorState(
                  errorMessage(snap.error, 'Could not load your referrals.'),
                  _reload);
            }
            final d = snap.data;
            return d == null ? _turnOnView() : _dashboard(d);
          },
        ),
      ),
    );
  }

  Widget _turnOnView() => FutureBuilder<ReferralProgram>(
        future: widget.api.referralProgram(),
        builder: (context, snap) {
          final p = snap.data;
          return ListView(
            padding: const EdgeInsets.only(top: 12),
            children: [
              AppCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.redeem, color: AppColors.green, size: 32),
                    const SizedBox(height: 12),
                    Text(
                        p == null
                            ? 'Refer cooperatives and earn'
                            : 'Earn ${p.percentText}% for ${p.months} months',
                        style: const TextStyle(
                            color: AppColors.ink,
                            fontSize: 20,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    const Text(
                        'Share your link with cooperatives you know. When one '
                        'signs up through it, you earn a share of every '
                        'subscription payment it makes. The free first month '
                        'earns nothing — you earn when they pay.',
                        style: TextStyle(color: AppColors.muted, height: 1.4)),
                    const SizedBox(height: 8),
                    const Text(
                        "You can't earn from a society you founded or hold "
                        'office in.',
                        style:
                            TextStyle(color: AppColors.muted2, fontSize: 12)),
                    const SizedBox(height: 18),
                    if (p != null && !p.active)
                      const Text(
                          'The program is not taking new referrers right now.',
                          style: TextStyle(color: AppColors.danger))
                    else
                      FilledButton(
                        onPressed: _busy ? null : _turnOn,
                        style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(48)),
                        child: Text(_busy ? 'Turning on…' : 'Get my link'),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      );

  Widget _dashboard(ReferrerDashboard d) {
    final share = 'Run your cooperative on CooperativeOS — members, '
        'contributions, loans and statements in one place, free for the first '
        'month. Sign up here: ${d.link}';
    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      children: [
        if (d.suspended)
          const AppCard(
            child: Text(
                'Your referral account is suspended, so new referrals and '
                'withdrawals are paused. Contact support for help.',
                style: TextStyle(color: AppColors.danger)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
          child: GreenPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Available to withdraw',
                    style: TextStyle(color: AppColors.green50, fontSize: 13)),
                const SizedBox(height: 4),
                Text(naira(d.available),
                    style: const TextStyle(
                        color: AppColors.paper,
                        fontSize: 26,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                    'Earned ${naira(d.earned)} · Paid ${naira(d.paid)}'
                    '${d.requested > 0 ? ' · Pending ${naira(d.requested)}' : ''}',
                    style:
                        const TextStyle(color: AppColors.green50, fontSize: 12)),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: d.suspended ||
                          d.available < d.program.minimumPayout ||
                          d.available <= 0
                      ? null
                      : () => _withdraw(d),
                  style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.ink,
                      disabledBackgroundColor: Colors.white24,
                      disabledForegroundColor: AppColors.green50),
                  child: Text(d.available < d.program.minimumPayout
                      ? 'Withdraw from ${naira(d.program.minimumPayout)}'
                      : 'Withdraw'),
                ),
              ],
            ),
          ),
        ),
        const SectionTitle('Your link'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SelectableText(d.link,
                  style: const TextStyle(
                      color: AppColors.ink, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(
                  'Code ${d.code} · ${d.program.percentText}% of payments for '
                  '${d.program.months} months',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _copy(d.link, 'Link'),
                      icon: const Icon(Icons.link, size: 18),
                      label: const Text('Copy link'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _copy(share, 'Message'),
                      icon: const Icon(Icons.chat_outlined, size: 18),
                      label: const Text('Copy message'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SectionTitle('Cooperatives you referred (${d.referrals.length})'),
        if (d.referrals.isEmpty)
          const AppCard(
            child: Text(
                'None yet. When a society signs up through your link it '
                'appears here.',
                style: TextStyle(color: AppColors.muted)),
          )
        else
          ...d.referrals.map(_referral),
        SectionTitle('Bank for payouts',
            trailing: TextButton(
                onPressed: () => _editBank(d),
                child: Text(d.hasBankDetails ? 'Change' : 'Add'))),
        AppCard(
          child: Text(
              d.hasBankDetails
                  ? '${d.accountName}\n${d.bankName} · ${d.accountNo}'
                  : 'Add the account we should pay your earnings into.',
              style: TextStyle(
                  color: d.hasBankDetails ? AppColors.ink : AppColors.muted,
                  height: 1.4)),
        ),
        if (d.payouts.isNotEmpty) ...[
          const SectionTitle('Withdrawals'),
          ...d.payouts.map(_payout),
        ],
      ],
    );
  }

  Widget _referral(ReferralRow r) {
    final String status;
    if (r.firstPaidOn == null) {
      status = 'Not paying yet';
    } else if (r.windowEndsOn != null) {
      status = 'Earning until ${_date(r.windowEndsOn!)}';
    } else {
      status = 'Earning';
    }
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(r.cooperativeName,
                    style: const TextStyle(
                        color: AppColors.ink, fontWeight: FontWeight.w700)),
                Text(
                    [if (r.place.isNotEmpty) r.place, status].join(' · '),
                    style:
                        const TextStyle(color: AppColors.muted2, fontSize: 12)),
              ],
            ),
          ),
          Text(naira(r.earned),
              style: const TextStyle(
                  color: AppColors.ink, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _payout(ReferralPayoutRow p) {
    final color = switch (p.status) {
      'paid' => AppColors.greenBright,
      'rejected' => AppColors.danger,
      _ => AppColors.goldDeep,
    };
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(naira(p.amount),
                    style: const TextStyle(
                        color: AppColors.ink, fontWeight: FontWeight.w700)),
                Text(
                    [_date(p.createdAt), if (p.note.isNotEmpty) p.note]
                        .join(' · '),
                    style:
                        const TextStyle(color: AppColors.muted2, fontSize: 12)),
              ],
            ),
          ),
          Text(p.statusDisplay,
              style: TextStyle(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  String _date(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${shortDate(iso)} ${d.year}';
  }
}

/// Where earnings are paid. Picked from the provider's bank list when there is
/// one, typed otherwise — the same fallback as the member's own details.
class _BankSheet extends StatefulWidget {
  const _BankSheet({required this.api, required this.current});
  final Api api;
  final ReferrerDashboard current;

  @override
  State<_BankSheet> createState() => _BankSheetState();
}

class _BankSheetState extends State<_BankSheet> {
  List<BankOption> _banks = const [];
  bool _loadingBanks = true;
  late String _bankCode = widget.current.bankCode;
  late final _bankName = TextEditingController(text: widget.current.bankName);
  late final _accountNo = TextEditingController(text: widget.current.accountNo);
  late final _accountName =
      TextEditingController(text: widget.current.accountName);
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    widget.api.banks().then((banks) {
      if (!mounted) return;
      setState(() {
        _banks = banks;
        _loadingBanks = false;
        if (_bankCode.isNotEmpty && !banks.any((b) => b.code == _bankCode)) {
          _bankCode = '';
        }
      });
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final saved = await widget.api.saveReferrerBank(
        bankName: _bankName.text.trim(),
        bankCode: _bankCode,
        accountNo: _accountNo.text.trim(),
        accountName: _accountName.text.trim(),
      );
      if (mounted) Navigator.pop(context, saved);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMessage(e, 'Could not save.'))));
      setState(() => _saving = false);
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Bank for payouts',
                style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 18,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            if (_loadingBanks)
              const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: LinearProgressIndicator())
            else if (_banks.isEmpty)
              _field(_bankName, 'Bank name')
            else
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: DropdownButtonFormField<String>(
                  value: _bankCode.isEmpty ? null : _bankCode,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      labelText: 'Bank', border: OutlineInputBorder()),
                  hint: const Text('Select your bank'),
                  items: [
                    for (final b in _banks)
                      DropdownMenuItem(value: b.code, child: Text(b.name)),
                  ],
                  onChanged: (code) {
                    if (code == null) return;
                    setState(() {
                      _bankCode = code;
                      _bankName.text =
                          _banks.firstWhere((b) => b.code == code).name;
                    });
                  },
                ),
              ),
            _field(_accountNo, 'Account number (10 digits)',
                keyboard: TextInputType.number),
            _field(_accountName, 'Account name'),
            const SizedBox(height: 4),
            FilledButton(
              onPressed: _saving ? null : _save,
              style:
                  FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: Text(_saving ? 'Saving…' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
          {TextInputType? keyboard}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          keyboardType: keyboard,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder()),
        ),
      );
}
