import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import 'legal_webview.dart';
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

  Future<void> _uploadDocument() async {
    final type = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            _DocTypeTile('id', 'Means of ID'),
            _DocTypeTile('passport', 'Passport photo'),
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

        // The way to the badge. Hidden once verified, and when an officer has
        // withdrawn it — completing the profile would not bring it back.
        if (!p.isVerified &&
            !p.verificationWithdrawn &&
            p.verificationMissing.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.green50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.verified, size: 18, color: AppColors.green),
                    SizedBox(width: 6),
                    Text('Get verified',
                        style: TextStyle(
                            color: AppColors.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w700)),
                  ]),
                  const SizedBox(height: 4),
                  const Text(
                      'Complete your profile and upload a means of ID to get '
                      'the verified tick. Still needed:',
                      style: TextStyle(color: AppColors.ink, fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final m in p.verificationMissing)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(m,
                              style: const TextStyle(
                                  color: AppColors.ink, fontSize: 12)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

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
  const _DocTypeTile(this.value, this.label);
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => ListTile(
        title: Text(label),
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
