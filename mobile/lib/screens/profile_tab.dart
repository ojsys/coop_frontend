import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import 'password_sheets.dart';
import 'legal_webview.dart';
import 'refer_screen.dart';
import '../widgets.dart';
import 'member_scaffold.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({
    super.key,
    required this.api,
    required this.session,
    required this.onSignOut,
  });
  final Api api;
  final Session session;
  final Future<void> Function() onSignOut;

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late Future<_ProfileData> _future = _load();
  final _picker = ImagePicker();
  bool _busy = false;

  Future<_ProfileData> _load() async {
    final profile = await widget.api.myProfile();
    final docs = await widget.api.myDocuments();
    final announcements = await widget.api.announcements();
    return _ProfileData(profile, docs, announcements);
  }

  void _reload() => setState(() => _future = _load());

  void _toast(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<ImageSource?> _pickSource() => showModalBottomSheet<ImageSource>(
        context: context,
        backgroundColor: AppColors.card,
        builder: (_) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Take a photo'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      );

  Future<void> _uploadPhoto() async {
    final source = await _pickSource();
    if (source == null) return;
    final picked = await _picker.pickImage(
        source: source, maxWidth: 1000, imageQuality: 85);
    if (picked == null) return;
    setState(() => _busy = true);
    try {
      await widget.api.uploadPhoto(await picked.readAsBytes(), picked.name);
      _toast('Photo updated');
      _reload();
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadDocument({String? presetType}) async {
    final type = presetType ?? await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            _DocTypeTile('id', 'Means of ID',
                "NIN slip, voter's card, driver's licence or passport"),
            _DocTypeTile('passport', 'Passport photograph',
                'A picture of you'),
            _DocTypeTile('proof_of_address', 'Proof of address'),
            _DocTypeTile('form', 'Membership form'),
            _DocTypeTile('other', 'Other'),
          ],
        ),
      ),
    );
    if (type == null) return;
    final source = await _pickSource();
    if (source == null) return;
    final picked = await _picker.pickImage(
        source: source, maxWidth: 1600, imageQuality: 85);
    if (picked == null) return;
    setState(() => _busy = true);
    try {
      await widget.api
          .uploadDocument(await picked.readAsBytes(), picked.name, type, '');
      _toast('Document uploaded');
      _reload();
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _progressCard(MemberProfile p) {
    final awaiting = p.verificationStatus == 'awaiting';
    final declined = p.verificationStatus == 'withdrawn';
    final accent = awaiting ? AppColors.gold : AppColors.green;
    VoidCallback? actionFor(String key) => _busy
        ? null
        : switch (key) {
            'photo' => _uploadPhoto,
            'id' => () => _uploadDocument(presetType: 'id'),
            _ => () => _editKyc(p),
          };
    String actionLabel(String key) => switch (key) {
          'photo' => 'Add photo',
          'id' => 'Upload ID',
          _ => 'Add details',
        };

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(awaiting ? Icons.hourglass_top : Icons.verified,
                  size: 18, color: accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                    awaiting
                        ? 'Awaiting verification'
                        : 'Complete your profile',
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
              ),
              Text('${p.profilePercent}%',
                  style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: p.profilePercent / 100,
                minHeight: 8,
                backgroundColor: AppColors.line,
                color: accent,
              ),
            ),
            if (declined) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                    "An officer couldn't verify you yet. "
                    "${p.verificationNote.isNotEmpty ? 'They said: "${p.verificationNote}". ' : ''}"
                    'Fix it below and it goes straight back to them.',
                    style:
                        const TextStyle(color: AppColors.inkSoft, fontSize: 13)),
              ),
            ],
            const SizedBox(height: 12),
            if (awaiting)
              const Text(
                  'Your profile is 100% complete. An officer of your '
                  "cooperative will check your details and ID, and you'll be "
                  "notified when you're verified.",
                  style: TextStyle(color: AppColors.muted, fontSize: 13))
            else
              for (final (n, step) in p.profileSteps.indexed)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: step.done ? AppColors.green : null,
                        border: step.done
                            ? null
                            : Border.all(color: AppColors.line),
                      ),
                      child: step.done
                          ? const Icon(Icons.check,
                              size: 15, color: Colors.white)
                          : Text('${n + 1}',
                              style: const TextStyle(
                                  color: AppColors.muted, fontSize: 12)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(step.label,
                              style: TextStyle(
                                color: step.done
                                    ? AppColors.muted
                                    : AppColors.ink,
                                fontSize: 14,
                                fontWeight: step.done
                                    ? FontWeight.w400
                                    : FontWeight.w600,
                                decoration: step.done
                                    ? TextDecoration.lineThrough
                                    : null,
                              )),
                          if (!step.done && step.missing.length > 1)
                            Text(
                                'Needs ${step.missing.join(', ').toLowerCase()}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: AppColors.muted2, fontSize: 12)),
                        ],
                      ),
                    ),
                    if (!step.done)
                      TextButton(
                        onPressed: actionFor(step.key),
                        style: TextButton.styleFrom(
                          backgroundColor: AppColors.green50,
                          foregroundColor: AppColors.green,
                          visualDensity: VisualDensity.compact,
                          shape: const StadiumBorder(),
                        ),
                        child: Text(actionLabel(step.key),
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                  ]),
                ),
          ],
        ),
      ),
    );
  }

  Future<void> _changePassword() async {
    final changed = await showChangePassword(context, widget.api);
    if (changed == true) {
      _toast('Password changed. Other devices have been signed out.');
    }
  }

  bool _exporting = false;

  Future<void> _exportData() async {
    setState(() => _exporting = true);
    try {
      final bytes = await widget.api.dataExport();
      final dir = await getTemporaryDirectory();
      final day = DateTime.now().toIso8601String().substring(0, 10);
      final file = File('${dir.path}/my-data-$day.zip');
      await file.writeAsBytes(bytes);
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) {
        _toast('No app here can open a .zip file. Sign in on the website and '
            'use Profile → Download my data instead.');
      }
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _deleteAccount() async {
    DeletionState state;
    try {
      state = await widget.api.deletionState();
    } catch (e) {
      _toast('$e');
      return;
    }
    if (!mounted) return;
    final reason = TextEditingController();
    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Delete my account',
                  style: TextStyle(
                      color: AppColors.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Text(
                  state.isPending
                      ? 'You asked on ${state.pendingSince!.substring(0, 10)}. '
                          'An officer will settle anything outstanding and '
                          "complete it within 30 days; we'll email you when "
                          "it's done. You can cancel until then."
                      : 'Deleted: your sign-in, contact details, date of '
                          'birth, gender, address, occupation, next of kin, '
                          'bank details, photo and documents.\n\n'
                          'Kept by your cooperative: its financial records '
                          '(ledger, contribution and loan history) under your '
                          'member number only.\n\n'
                          'An officer completes it within 30 days.',
                  style:
                      const TextStyle(color: AppColors.inkSoft, fontSize: 14)),
              if (state.blockers.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('To be settled first',
                          style: TextStyle(
                              color: AppColors.ink,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      for (final b in state.blockers)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text('• $b',
                              style: const TextStyle(
                                  color: AppColors.inkSoft, fontSize: 13)),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => Navigator.pop(ctx, 'export'),
                icon: const Icon(Icons.download_outlined),
                label: const Text('Download a copy of my data first'),
              ),
              if (!state.isPending) ...[
                const SizedBox(height: 4),
                TextField(
                  controller: reason,
                  maxLines: 2,
                  decoration: const InputDecoration(
                      labelText: 'Reason (optional)'),
                ),
              ],
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(
                        state.isPending ? 'Close' : 'Keep my account'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: state.isPending
                            ? AppColors.green
                            : AppColors.danger),
                    onPressed: () => Navigator.pop(
                        ctx, state.isPending ? 'cancel' : 'request'),
                    child: Text(state.isPending
                        ? 'Cancel my request'
                        : 'Request deletion'),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
    final text = reason.text.trim();
    reason.dispose();
    try {
      switch (action) {
        case 'export':
          await _exportData();
        case 'request':
          await widget.api.requestDeletion(text);
          _toast("Request sent to your cooperative. We'll email you.");
        case 'cancel':
          await widget.api.cancelDeletion();
          _toast('Deletion request cancelled');
      }
    } catch (e) {
      _toast('$e');
    }
  }

  Future<void> _deleteDoc(MemberDocument d) async {
    try {
      await widget.api.deleteDocument(d.id);
      _reload();
    } catch (e) {
      _toast('$e');
    }
  }

  void _viewDoc(MemberDocument d) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        child: InteractiveViewer(
          child: Image.network(d.file,
              errorBuilder: (_, __, ___) => const Padding(
                    padding: EdgeInsets.all(40),
                    child: Text('Preview unavailable',
                        style: TextStyle(color: Colors.white)),
                  )),
        ),
      ),
    );
  }

  Future<void> _editKyc(MemberProfile p) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => _EditKycSheet(api: widget.api, profile: p),
    );
    if (saved == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<_ProfileData>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load your profile.'),
                  _reload);
            }
            return _content(snap.data!);
          },
        ),
      ),
    );
  }

  Widget _content(_ProfileData data) {
    final p = data.profile;
    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Text('Profile',
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 24,
                  fontWeight: FontWeight.w700)),
        ),
        AppCard(
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.gold,
                    backgroundImage:
                        p.photo != null ? NetworkImage(p.photo!) : null,
                    child: p.photo == null
                        ? Text(initials(p.fullName),
                            style: const TextStyle(
                                color: AppColors.green,
                                fontWeight: FontWeight.w700))
                        : null,
                  ),
                  Positioned(
                    right: -4,
                    bottom: -4,
                    child: Material(
                      color: AppColors.green,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _busy ? null : _uploadPhoto,
                        child: const Padding(
                          padding: EdgeInsets.all(5),
                          child: Icon(Icons.photo_camera,
                              color: Colors.white, size: 13),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(
                        child: Text(p.fullName,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: AppColors.ink,
                                fontSize: 17,
                                fontWeight: FontWeight.w700)),
                      ),
                      if (p.isVerified) ...[
                        const SizedBox(width: 5),
                        Tooltip(
                          message: p.verifiedVia == 'officer'
                              ? 'Verified by an officer of the cooperative'
                              : 'Verified — profile complete with a means of ID',
                          child: const Icon(Icons.verified,
                              size: 19, color: AppColors.green),
                        ),
                      ],
                    ]),
                    Text('${p.memberNo} · ${p.roleName ?? 'Member'}',
                        style: const TextStyle(
                            color: AppColors.muted2, fontSize: 12)),
                    Text(p.phone.isNotEmpty ? p.phone : p.email,
                        style: const TextStyle(
                            color: AppColors.muted2, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),

        // The road to the verified tick, one step at a time. Each unfinished
        // step opens the form that finishes it.
        if (p.verificationStatus != 'verified') _progressCard(p),

        // KYC
        _labelWithAction('KYC & PERSONAL', 'Edit', () => _editKyc(p)),
        AppCard(
          child: Column(
            children: [
              _kv('Date of birth', p.dateOfBirth ?? '—'),
              _kv('Gender', p.gender.isEmpty ? '—' : p.gender),
              _kv('Occupation', p.occupation.isEmpty ? '—' : p.occupation),
              _kv('Address', p.address.isEmpty ? '—' : p.address),
              _kv(
                  'Next of kin',
                  p.nextOfKinName.isEmpty
                      ? '—'
                      : '${p.nextOfKinName}${p.nextOfKinPhone.isNotEmpty ? ' · ${p.nextOfKinPhone}' : ''}'),
              _kv(
                  'Bank',
                  p.bankName.isEmpty
                      ? '—'
                      : '${p.bankName}${p.bankAccountNo.isNotEmpty ? ' · ${p.bankAccountNo}' : ''}',
                  last: p.bankName.isEmpty || p.bankCode.isNotEmpty),
              // A name without a code cannot receive a transfer, and the member
              // is the only one who can fix it. Saying so here is cheaper than
              // an officer chasing them when a loan cannot be paid.
              if (p.bankName.isNotEmpty && p.bankCode.isEmpty)
                _kv(
                    '',
                    'Tap Edit and pick your bank from the list so loan '
                    'payments can reach this account.',
                    last: true),
            ],
          ),
        ),

        // Documents
        _labelWithAction('DOCUMENTS', 'Upload', _busy ? null : _uploadDocument),
        if (data.documents.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text('No documents uploaded.',
                style: TextStyle(color: AppColors.muted)),
          )
        else
          ...data.documents.map(_docTile),

        // Announcements
        _label('ANNOUNCEMENTS'),
        if (data.announcements.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child:
                Text('No announcements.', style: TextStyle(color: AppColors.muted)),
          )
        else
          ...data.announcements.take(3).map(_announcement),

        _label('SETTINGS'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.redeem_outlined,
                    color: AppColors.muted),
                title: const Text('Refer a cooperative & earn'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ReferScreen(api: widget.api))),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.shield_outlined,
                    color: AppColors.muted),
                title: const Text('Privacy policy'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: () => _openPolicy('privacy', 'Privacy policy'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.description_outlined,
                    color: AppColors.muted),
                title: const Text('Terms of use'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: () => _openPolicy('terms', 'Terms of use'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.lock_outline,
                    color: AppColors.muted),
                title: const Text('Change password'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: _changePassword,
              ),
              const Divider(height: 1),
              // Your data, yours to take and to have deleted.
              ListTile(
                leading: const Icon(Icons.download_outlined,
                    color: AppColors.muted),
                title: Text(_exporting
                    ? 'Preparing your data…'
                    : 'Download my data'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: _exporting ? null : _exportData,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.person_remove_outlined,
                    color: AppColors.muted),
                title: const Text('Delete my account'),
                trailing: const Icon(Icons.chevron_right,
                    color: AppColors.muted2),
                onTap: _deleteAccount,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.logout, color: AppColors.danger),
                title: const Text('Sign out',
                    style: TextStyle(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600)),
                onTap: widget.onSignOut,
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Opens a published policy on the website, in-app.
  ///
  /// The URL is derived from the configured API base rather than hard-coded, so
  /// a build pointed at staging with --dart-define=API_BASE opens staging's
  /// policies instead of production's. The web app serves these at `/legal/<slug>`
  /// and the content itself is maintained by an administrator, so the text can
  /// be corrected without shipping an app update.
  void _openPolicy(String slug, String title) {
    final api = Uri.parse(widget.api.baseUrl);
    final site = Uri(scheme: api.scheme, host: api.host, port: api.hasPort ? api.port : null);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LegalWebView(
        url: '$site/legal/$slug',
        title: title,
      ),
    ));
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
        child: Text(text,
            style: const TextStyle(
                color: AppColors.muted2,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );

  Widget _labelWithAction(String text, String action, VoidCallback? onTap) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(text,
                style: const TextStyle(
                    color: AppColors.muted2,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5)),
            GestureDetector(
              onTap: onTap,
              child: Text(action,
                  style: const TextStyle(
                      color: AppColors.green,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );

  Widget _kv(String k, String v, {bool last = false}) => Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 110,
                child: Text(k,
                    style:
                        const TextStyle(color: AppColors.muted2, fontSize: 13))),
            Expanded(
              child: Text(v,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                      color: AppColors.inkSoft, fontSize: 13)),
            ),
          ],
        ),
      );

  Widget _docTile(MemberDocument d) => AppCard(
        child: Row(
          children: [
            const Icon(Icons.description_outlined, color: AppColors.muted2),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                  d.label.isNotEmpty ? d.label : d.docTypeDisplay,
                  style: const TextStyle(
                      color: AppColors.ink, fontWeight: FontWeight.w600)),
            ),
            IconButton(
                icon: const Icon(Icons.visibility_outlined,
                    color: AppColors.muted2, size: 20),
                onPressed: () => _viewDoc(d)),
            IconButton(
                icon: const Icon(Icons.delete_outline,
                    color: AppColors.muted2, size: 20),
                onPressed: () => _deleteDoc(d)),
          ],
        ),
      );

  Widget _announcement(Announcement a) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(a.title,
                style: const TextStyle(
                    color: AppColors.ink, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(a.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
        ),
      );
}

class _DocTypeTile extends StatelessWidget {
  const _DocTypeTile(this.value, this.label, [this.hint]);
  final String value;
  final String label;
  final String? hint;
  @override
  Widget build(BuildContext context) => ListTile(
        title: Text(label),
        subtitle: hint == null ? null : Text(hint!),
        onTap: () => Navigator.pop(context, value),
      );
}

class _ProfileData {
  _ProfileData(this.profile, this.documents, this.announcements);
  final MemberProfile profile;
  final List<MemberDocument> documents;
  final List<Announcement> announcements;
}

class _EditKycSheet extends StatefulWidget {
  const _EditKycSheet({required this.api, required this.profile});
  final Api api;
  final MemberProfile profile;

  @override
  State<_EditKycSheet> createState() => _EditKycSheetState();
}

class _EditKycSheetState extends State<_EditKycSheet> {
  late final _phone = TextEditingController(text: widget.profile.phone);
  late final _dob = TextEditingController(text: widget.profile.dateOfBirth ?? '');
  late final _occupation =
      TextEditingController(text: widget.profile.occupation);
  late final _address = TextEditingController(text: widget.profile.address);
  late final _kin = TextEditingController(text: widget.profile.nextOfKinName);
  late final _kinPhone =
      TextEditingController(text: widget.profile.nextOfKinPhone);
  late final _bank = TextEditingController(text: widget.profile.bankName);

  // The bank catalogue, and the code the member has picked from it.
  //
  // A name alone cannot be paid: a transfer recipient is created from the
  // provider's bank *code*. Until this screen asked for one, every member who
  // only ever used the app had a blank code and their approved loans could not
  // be disbursed electronically at all.
  List<BankOption> _banks = const [];
  bool _loadingBanks = true;
  late String _bankCode = widget.profile.bankCode;
  late final _account =
      TextEditingController(text: widget.profile.bankAccountNo);
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadBanks();
  }

  Future<void> _loadBanks() async {
    final banks = await widget.api.banks();
    if (!mounted) return;
    setState(() {
      _banks = banks;
      _loadingBanks = false;
      // A stored code that is no longer in the catalogue would make the
      // dropdown throw, so drop it and let the member pick again.
      if (_bankCode.isNotEmpty &&
          !banks.any((b) => b.code == _bankCode)) {
        _bankCode = '';
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.api.updateProfile({
        'phone': _phone.text,
        'date_of_birth': _dob.text.isEmpty ? null : _dob.text,
        'occupation': _occupation.text,
        'address': _address.text,
        'next_of_kin_name': _kin.text,
        'next_of_kin_phone': _kinPhone.text,
        'bank_name': _bank.text,
        'bank_code': _bankCode,
        'bank_account_no': _account.text,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
        setState(() => _saving = false);
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Edit your details',
                style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 18,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _field(_phone, 'Phone'),
            _field(_dob, 'Date of birth (YYYY-MM-DD)'),
            _field(_occupation, 'Occupation'),
            _field(_address, 'Address'),
            _field(_kin, 'Next of kin'),
            _field(_kinPhone, 'Next of kin phone'),
            _bankPicker(),
            _field(_account, 'Bank account no.'),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48)),
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save changes'),
            ),
          ],
        ),
      ),
    );
  }

  /// Pick the bank from the provider's list, or type it when there is no list.
  ///
  /// The fallback is deliberate rather than a failure mode: the catalogue is
  /// empty until `refresh_banks` has run against a live key, and a member should
  /// still be able to record their bank in the meantime — they simply cannot be
  /// paid electronically until a code is on file, which is what the console's
  /// awaiting-payment queue reports.
  Widget _bankPicker() {
    if (_loadingBanks) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: InputDecorator(
          decoration: InputDecoration(
              labelText: 'Bank', border: OutlineInputBorder()),
          child: SizedBox(
              height: 20,
              child: Align(
                  alignment: Alignment.centerLeft,
                  child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2)))),
        ),
      );
    }

    if (_banks.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _field(_bank, 'Bank name'),
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'The verified bank list is unavailable, so your bank name has '
              'been saved as typed. Your cooperative may ask you to pick it '
              'again before a loan can be paid to you.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ),
        ],
      );
    }

    return Padding(
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
            // Keep the name in step with the code: the loan's destination
            // snapshot stores both, and an officer reads the name.
            _bank.text =
                _banks.firstWhere((b) => b.code == code).name;
          });
        },
      ),
    );
  }

  Widget _field(TextEditingController c, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder()),
        ),
      );
}
