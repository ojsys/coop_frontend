import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Talks to the same Django REST API as the web app (`/api/v1`). Token auth +
/// the `X-Cooperative-Id` tenant header, exactly like `frontend/src/api/client.ts`.
class Api {
  Api(this.baseUrl);

  /// Android emulator reaches the host machine at 10.0.2.2; iOS sim uses
  /// localhost. Override for a device on your LAN or a staging URL.
  final String baseUrl;

  String? _token;
  int? _cooperativeId;

  static const _tokenKey = 'coop.token';
  static const _coopKey = 'coop.cooperativeId';

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    _cooperativeId = prefs.getInt(_coopKey);
  }

  bool get isAuthenticated => _token != null;

  /// The society every tenant-scoped call is made for.
  int? get cooperativeId => _cooperativeId;

  /// Make another of the member's societies the active one. Remembered, so
  /// the app opens on it next time too.
  Future<void> switchCooperative(int id) async {
    _cooperativeId = id;
    await _persist();
  }

  /// Adopt the tenant implied by the signed-in user's own membership.
  ///
  /// A session created before the fix above persisted a token with no
  /// cooperative id, and every tenant-scoped endpoint fails closed without the
  /// header — so this repairs an existing install in place, rather than
  /// requiring the member to sign out and in again.
  Future<void> adoptTenant(CurrentUser user) async {
    if (_cooperativeId != null) return;
    if (user.memberships.isEmpty) return;
    _cooperativeId = user.memberships.first.cooperativeId;
    await _persist();
  }

  /// Dev-only: inject a token + tenant (e.g. from a `--dart-define`) so a
  /// simulator can boot straight into the member tabs for screenshots. No-op in
  /// normal use where these defines are empty.
  void seedDemo(String token, int cooperativeId) {
    if (token.isEmpty) return;
    _token = token;
    _cooperativeId = cooperativeId;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token != null) {
      await prefs.setString(_tokenKey, _token!);
    } else {
      await prefs.remove(_tokenKey);
    }
    if (_cooperativeId != null) {
      await prefs.setInt(_coopKey, _cooperativeId!);
    } else {
      await prefs.remove(_coopKey);
    }
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Token $_token',
        if (_cooperativeId != null)
          'X-Cooperative-Id': _cooperativeId.toString(),
      };

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (res.statusCode == 401) {
      await logout();
      throw ApiException('Session expired', 401);
    }
    if (res.statusCode >= 400) {
      // _detail() parses DRF's error shapes and sits right below; the old
      // "Request failed (N)" threw the server's explanation away.
      throw ApiException(_detail(res), res.statusCode);
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// DRF list endpoints may be paginated (`{results: [...]}`) or a bare list.
  Future<List<dynamic>> _getList(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (res.statusCode == 401) {
      await logout();
      throw ApiException('Session expired', 401);
    }
    if (res.statusCode >= 400) {
      // The list helper feeds every data tab, so this is the message a member
      // actually sees when a screen comes up empty. _detail() reads DRF's own
      // explanation; the status code alone explained nothing.
      throw ApiException(_detail(res), res.statusCode);
    }
    final body = jsonDecode(res.body);
    if (body is Map<String, dynamic> && body['results'] is List) {
      return body['results'] as List<dynamic>;
    }
    return body as List<dynamic>;
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> data) async {
    final res = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(data),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_detail(res), res.statusCode);
    }
    return res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> data) async {
    final res = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(data),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_detail(res), res.statusCode);
    }
    return res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> _delete(String path) async {
    final res = await http.delete(Uri.parse('$baseUrl$path'), headers: _headers);
    if (res.statusCode >= 400) {
      throw ApiException(_detail(res), res.statusCode);
    }
  }

  /// Multipart upload (photo / document). One file field + optional text fields.
  Future<Map<String, dynamic>> _upload(
    String path, {
    String method = 'POST',
    required String field,
    required List<int> bytes,
    required String filename,
    Map<String, String> fields = const {},
  }) async {
    final req = http.MultipartRequest(method, Uri.parse('$baseUrl$path'));
    // Note: no JSON Content-Type — MultipartRequest sets its own boundary.
    if (_token != null) req.headers['Authorization'] = 'Token $_token';
    if (_cooperativeId != null) {
      req.headers['X-Cooperative-Id'] = _cooperativeId.toString();
    }
    req.fields.addAll(fields);
    req.files.add(http.MultipartFile.fromBytes(field, bytes, filename: filename));
    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode >= 400) {
      throw ApiException(_detail(res), res.statusCode);
    }
    return res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Extract a human message from DRF's several error shapes:
  /// `{"detail": "msg"}`, a bare `["msg"]` (ValidationError with a string),
  /// or serializer field errors `{"field": ["msg"], …}`.
  String _detail(http.Response res) {
    try {
      final j = jsonDecode(res.body);
      if (j is Map) {
        if (j['detail'] != null) return j['detail'].toString();
        for (final v in j.values) {
          if (v is List && v.isNotEmpty) return v.first.toString();
          if (v is String && v.isNotEmpty) return v;
        }
      }
      if (j is List && j.isNotEmpty) return j.first.toString();
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  Future<CurrentUser> login(String email, String password) async {
    // Every failure used to be reported as "Invalid email or password",
    // including an unreachable server — which is exactly what a release build
    // pointed at localhost does. That hid the real fault behind a wrong answer.
    http.Response res;
    try {
      res = await http.post(
        Uri.parse('$baseUrl/auth/token/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': email, 'password': password}),
      );
    } on Exception {
      throw ApiException(
        'Could not reach the server. Check your connection and try again.',
        0,
      );
    }
    // DRF's obtain_auth_token answers 400 (not 401) for bad credentials. Kept
    // deliberately vague: the server's wording would reveal whether the
    // address is registered.
    if (res.statusCode == 400 || res.statusCode == 401) {
      throw ApiException('Invalid email or password', res.statusCode);
    }
    if (res.statusCode == 429) {
      throw ApiException(
        'Too many sign-in attempts. Please wait a while and try again.',
        429,
      );
    }
    if (res.statusCode != 200) {
      throw ApiException(_detail(res), res.statusCode);
    }
    _token = (jsonDecode(res.body) as Map<String, dynamic>)['token'] as String;
    final user = await me();
    // The tenant comes from the member's own first membership. This used to be
    // skipped for platform admins, mirroring the web's AuthContext — but there
    // an admin lands on /platform and chooses a tenant with the CoopSwitcher,
    // whereas the member app is the only surface here. Skipping it left
    // X-Cooperative-Id unset, and core.tenancy.resolve_cooperative fails closed
    // without it: login succeeded and then nothing loaded.
    if (user.memberships.isNotEmpty) {
      _cooperativeId = user.memberships.first.cooperativeId;
    }
    await _persist();
    return user;
  }

  /// Email a password-reset link. The answer is the same whether or not the
  /// address is registered, so it cannot be used to find out who is a member.
  Future<String> requestPasswordReset(String email) async {
    http.Response res;
    try {
      res = await http.post(
        Uri.parse('$baseUrl/auth/password-reset/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
    } on Exception {
      throw ApiException(
        'Could not reach the server. Check your connection and try again.',
        0,
      );
    }
    if (res.statusCode == 429) {
      throw ApiException(
        'Too many reset requests. Please wait a while and try again.',
        429,
      );
    }
    if (res.statusCode >= 400) {
      throw ApiException(_detail(res), res.statusCode);
    }
    return _detail(res);
  }

  /// Change the signed-in user's password. The server issues a new token —
  /// signing out every other device — and this one switches to it.
  Future<void> changePassword(String current, String next) async {
    final res = await _post('/me/password/',
        {'current_password': current, 'new_password': next});
    _token = res['token'] as String;
    await _persist();
  }

  Future<CurrentUser> me() async => CurrentUser.fromJson(await _get('/me/'));

  Future<MemberStatement> statement(int membershipId) async =>
      MemberStatement.fromJson(await _get('/members/$membershipId/statement/'));

  Future<List<int>> statementPdf(int membershipId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/reports/statement-pdf/?membership=$membershipId'),
      headers: _headers,
    );
    if (res.statusCode >= 400) {
      throw ApiException('Could not download statement', res.statusCode);
    }
    return res.bodyBytes;
  }

  /// The provider's bank list, as `{code, name}` pairs.
  ///
  /// Comes from the same `/reference/` endpoint the web console reads, so the
  /// two cannot offer different banks. Returns an empty list when the catalogue
  /// has not been pulled yet (no live PSP key, or `refresh_banks` never run) —
  /// the profile sheet then falls back to a free-text field so bank entry keeps
  /// working either way.
  Future<List<BankOption>> banks() async {
    try {
      final data = await _get('/reference/');
      final rows = (data['banks'] as List<dynamic>? ?? const []);
      return rows
          .map((b) => BankOption.fromJson(b as Map<String, dynamic>))
          .toList();
    } on ApiException {
      // A missing catalogue must not block someone editing their address.
      return const <BankOption>[];
    }
  }

  Future<List<ContributionType>> contributionTypes() async {
    final list = await _getList('/contribution-types/');
    return list
        .map((t) => ContributionType.fromJson(t as Map<String, dynamic>))
        .where((t) => t.active)
        .toList();
  }

  /// Starts a member contribution and reports how to proceed:
  /// a live Paystack checkout URL, an error to show, or simulated (dev) mode.
  Future<PaymentInit> initiateContribution({
    required int membershipId,
    required int typeId,
    required String amount,
    required String channel,
    String? reference,
    String? callbackUrl,
  }) async {
    final res = await _post('/contributions/initiate/', {
      'membership': membershipId,
      'contribution_type': typeId,
      'amount': amount,
      'channel': channel,
      if (reference != null) 'psp_reference': reference,
      if (callbackUrl != null) 'callback_url': callbackUrl,
    });
    return PaymentInit(
      authorizationUrl: res['authorization_url'] as String?,
      error: res['payment_error'] as String?,
      simulated: res['payment_simulated'] as bool? ?? false,
    );
  }

  /// Confirms a PSP payment after checkout — posts it to the ledger immediately.
  /// Returns the contribution status ('confirmed' on success, else 'pending').
  Future<String> verifyPayment(String reference) async {
    final res = await _post('/contributions/verify/', {'reference': reference});
    return res['status'] as String? ?? 'pending';
  }

  Future<List<Resolution>> resolutions() async {
    final list = await _getList('/resolutions/');
    return list
        .map((r) => Resolution.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<void> vote(int resolutionId, int membershipId, String choice) async {
    await _post('/resolutions/$resolutionId/vote/', {
      'choice': choice,
      'membership': membershipId,
    });
  }

  Future<List<Announcement>> announcements() async {
    final list = await _getList('/announcements/');
    return list
        .map((a) => Announcement.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  // ── Member self-service (/me/…) ──────────────────────────────────────────
  Future<MemberProfile> myProfile() async =>
      MemberProfile.fromJson(await _get('/me/profile/'));

  Future<MemberProfile> updateProfile(Map<String, dynamic> data) async =>
      MemberProfile.fromJson(await _patch('/me/profile/', data));

  Future<void> uploadPhoto(List<int> bytes, String filename) async {
    await _upload('/me/profile/', method: 'PATCH', field: 'photo',
        bytes: bytes, filename: filename);
  }

  Future<List<MemberDocument>> myDocuments() async {
    final list = await _getList('/me/documents/');
    return list
        .map((d) => MemberDocument.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  Future<void> uploadDocument(
      List<int> bytes, String filename, String docType, String label) async {
    await _upload('/me/documents/', field: 'file', bytes: bytes,
        filename: filename, fields: {'doc_type': docType, 'label': label});
  }

  Future<void> deleteDocument(int id) async => _delete('/me/documents/$id/');

  /// Everything held about the member, across every cooperative, as a zip.
  Future<List<int>> dataExport() async {
    final res =
        await http.get(Uri.parse('$baseUrl/me/data-export/'), headers: _headers);
    if (res.statusCode >= 400) {
      throw ApiException('Could not prepare your data', res.statusCode);
    }
    return res.bodyBytes;
  }

  Future<DeletionState> deletionState() async =>
      DeletionState.fromJson(await _get('/me/deletion-request/'));

  Future<DeletionState> requestDeletion(String reason) async =>
      DeletionState.fromJson(
          await _post('/me/deletion-request/', {'reason': reason}));

  Future<void> cancelDeletion() async => _delete('/me/deletion-request/');

  // ── Joining another cooperative, with this account ──────────────────────
  /// Live societies matching a name. Search only — never a full listing.
  Future<List<Society>> searchSocieties(String query) async {
    final q = query.trim();
    if (q.length < 2) return [];
    final list =
        await _getList('/public/societies/?q=${Uri.encodeQueryComponent(q)}');
    return list.map((j) => Society.fromJson(j as Map<String, dynamic>)).toList();
  }

  /// Requests still waiting, or recently declined.
  Future<List<MyJoinRequest>> myJoinRequests() async {
    final list = await _getList('/me/join-requests/');
    return list
        .map((j) => MyJoinRequest.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  /// Ask a society to admit this account: one picked from the search, or an
  /// invite code or pasted link.
  Future<MyJoinRequest> joinAnother(
          {int? cooperativeId, String? code, String message = ''}) async =>
      MyJoinRequest.fromJson(await _post('/me/join-requests/', {
        if (cooperativeId != null) 'cooperative': cooperativeId,
        if (code != null) 'code': code,
        'message': message,
      }));

  Future<void> withdrawJoinRequest(int id) async =>
      _delete('/me/join-requests/$id/');

  Future<List<LoanProduct>> loanProducts() async {
    final list = await _getList('/me/loan-products/');
    return list
        .map((p) => LoanProduct.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<List<Loan>> myLoans() async {
    final list = await _getList('/me/loans/');
    return list.map((l) => Loan.fromJson(l as Map<String, dynamic>)).toList();
  }

  Future<Loan> applyLoan({
    required int productId,
    required String principal,
    required int termMonths,
    String purpose = '',
  }) async =>
      Loan.fromJson(await _post('/me/loans/', {
        'product': productId,
        'principal': principal,
        'term_months': termMonths,
        'purpose': purpose,
      }));

  Future<Loan> myLoan(int id) async =>
      Loan.fromJson(await _get('/me/loans/$id/'));

  /// Starts an online repayment and reports how to proceed (checkout URL,
  /// an error, or simulated dev mode). Mirrors [initiateContribution].
  Future<PaymentInit> initiateLoanRepayment({
    required int loanId,
    required String amount,
    required String reference,
    String? callbackUrl,
  }) async {
    final res = await _post('/me/loans/$loanId/repay-initiate/', {
      'amount': amount,
      'psp_reference': reference,
      if (callbackUrl != null) 'callback_url': callbackUrl,
    });
    return PaymentInit(
      authorizationUrl: res['authorization_url'] as String?,
      error: res['payment_error'] as String?,
      simulated: res['payment_simulated'] as bool? ?? false,
    );
  }

  /// What repaying [amount] online costs, Paystack's fee included: the
  /// member pays the fee on top so the society receives the whole repayment.
  Future<FeeQuote> repayQuote(int loanId, String amount) async =>
      FeeQuote.fromJson(await _get(
          '/me/loans/$loanId/repay-quote/?amount=${Uri.encodeQueryComponent(amount)}'));

  /// What paying [amount] online costs (contributions): the member pays
  /// Paystack's fee on top so the society receives the whole amount.
  Future<FeeQuote> feeQuote(String amount) async => FeeQuote.fromJson(
      await _get('/fee-quote/?amount=${Uri.encodeQueryComponent(amount)}'));

  /// Confirms an online repayment after checkout — posts it to the ledger.
  /// Returns the refreshed loan.
  Future<Loan> verifyLoanRepayment(int loanId, String reference) async =>
      Loan.fromJson(
          await _post('/me/loans/$loanId/repay-verify/', {'reference': reference}));

  /// The member reports a direct bank transfer ("I have paid"); creates a
  /// pending claim an officer verifies and confirms in the console.
  Future<void> reportTransfer(int loanId, String amount, String note) async {
    await _post('/me/loans/$loanId/report-transfer/', {
      'amount': amount,
      if (note.isNotEmpty) 'note': note,
    });
  }

  /// Begin a fee-free repayment by bank transfer: the society's account, the
  /// amount, a narration reference and a 30-minute window to send it.
  Future<StartedTransfer> startTransfer(int loanId, String amount) async =>
      StartedTransfer.fromJson(await _post(
          '/me/loans/$loanId/start-transfer/', {'amount': amount}));

  /// "I've sent it" for a transfer begun with [startTransfer] — what puts it
  /// in front of an officer. Accepted after the 30 minutes too.
  Future<void> reportStartedTransfer(int loanId, int transferId) async {
    await _post('/me/loans/$loanId/report-transfer/', {'transfer': transferId});
  }

  Future<void> cancelTransfer(int loanId, int transferId) async {
    await _post('/me/loans/$loanId/cancel-transfer/', {'transfer': transferId});
  }

  Future<List<SavingsProduct>> savingsProducts() async {
    final list = await _getList('/me/savings-products/');
    return list
        .map((p) => SavingsProduct.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<List<SavingsGoal>> mySavingsGoals() async {
    final list = await _getList('/me/savings-goals/');
    return list
        .map((g) => SavingsGoal.fromJson(g as Map<String, dynamic>))
        .toList();
  }

  Future<void> createSavingsGoal({
    required int productId,
    required String name,
    required String targetAmount,
    String? targetDate,
  }) async {
    await _post('/me/savings-goals/', {
      'product': productId,
      'name': name,
      'target_amount': targetAmount,
      if (targetDate != null) 'target_date': targetDate,
    });
  }

  Future<void> deleteSavingsGoal(int id) async =>
      _delete('/me/savings-goals/$id/');

  Future<List<DividendRow>> myDividends() async {
    final list = await _getList('/me/dividends/');
    return list
        .map((d) => DividendRow.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  Future<void> logout() async {
    _token = null;
    _cooperativeId = null;
    await _persist();
  }
}

class ApiException implements Exception {
  ApiException(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

/// The message to show for a failed load: the server's own explanation when
/// there is one, else a screen-specific fallback.
///
/// Every screen used to show only its fallback, so a tab that came up empty
/// never said why — which is exactly how a missing tenant header looked
/// identical to having no data at all.
String errorMessage(Object? error, String fallback) =>
    error is ApiException ? error.message : fallback;

class PaymentInit {
  PaymentInit({this.authorizationUrl, this.error, this.simulated = false});
  final String? authorizationUrl; // live Paystack checkout to open
  final String? error; // reason the checkout couldn't be created
  final bool simulated; // no live key → complete via verify directly (dev)
}

class Membership {
  Membership({
    required this.id,
    required this.cooperativeId,
    required this.cooperativeName,
    required this.memberNo,
    required this.roleSlug,
    required this.roleName,
    required this.shareCapital,
    this.features,
    this.kind = 'member',
  });
  final int id;
  final int cooperativeId;
  final String cooperativeName;
  final String memberNo;
  final String? roleSlug;
  final String? roleName;
  final double shareCapital;

  /// What the society's plan includes right now. Null when the server does
  /// not say (an older backend) — treated as "everything", since the server
  /// enforces the plan regardless and the worst case is a refusal message.
  final List<String>? features;

  bool hasFeature(String key) => features?.contains(key) ?? true;

  /// 'member', or 'non_member' for someone the society serves who has not
  /// joined: no vote, no shares, no dividends.
  final String kind;
  bool get isMember => kind != 'non_member';

  factory Membership.fromJson(Map<String, dynamic> j) {
    final plan = j['plan'] as Map<String, dynamic>?;
    return Membership(
      id: j['id'] as int,
      cooperativeId: j['cooperative_id'] as int,
      cooperativeName: j['cooperative_name'] as String,
      memberNo: j['member_no'] as String,
      roleSlug: j['role_slug'] as String?,
      roleName: j['role_name'] as String?,
      shareCapital: double.tryParse('${j['share_capital']}') ?? 0,
      kind: j['kind'] as String? ?? 'member',
      features: plan?['features'] == null
          ? null
          : List<String>.from(plan!['features'] as List),
    );
  }
}

class CurrentUser {
  CurrentUser({
    required this.fullName,
    required this.email,
    required this.phone,
    required this.isPlatformAdmin,
    required this.memberships,
  });
  final String fullName;
  final String email;
  final String phone;
  final bool isPlatformAdmin;
  final List<Membership> memberships;

  factory CurrentUser.fromJson(Map<String, dynamic> j) => CurrentUser(
        fullName: j['full_name'] as String,
        email: j['email'] as String,
        phone: j['phone'] as String? ?? '',
        isPlatformAdmin: j['is_platform_admin'] as bool? ?? false,
        memberships: ((j['memberships'] as List?) ?? [])
            .map((m) => Membership.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

class StatementLine {
  StatementLine({
    required this.description,
    required this.date,
    required this.credit,
    required this.balance,
  });
  final String description;
  final String date;
  final double credit;
  final double balance;

  factory StatementLine.fromJson(Map<String, dynamic> j) => StatementLine(
        description: j['description'] as String,
        date: j['date'] as String,
        credit: double.tryParse('${j['credit']}') ?? 0,
        balance: double.tryParse('${j['balance']}') ?? 0,
      );
}

class MemberStatement {
  MemberStatement({required this.savingsBalance, required this.lines});
  final double savingsBalance;
  final List<StatementLine> lines;

  factory MemberStatement.fromJson(Map<String, dynamic> j) => MemberStatement(
        savingsBalance: double.tryParse('${j['savings_balance']}') ?? 0,
        lines: (j['lines'] as List)
            .map((l) => StatementLine.fromJson(l as Map<String, dynamic>))
            .toList(),
      );
}

class ContributionType {
  ContributionType({
    required this.id,
    required this.name,
    required this.frequency,
    required this.expectedAmount,
    required this.active,
  });
  final int id;
  final String name;
  final String frequency;
  final double? expectedAmount;
  final bool active;

  factory ContributionType.fromJson(Map<String, dynamic> j) => ContributionType(
        id: j['id'] as int,
        name: j['name'] as String,
        frequency: j['frequency'] as String? ?? '',
        expectedAmount: j['expected_amount'] == null
            ? null
            : double.tryParse('${j['expected_amount']}'),
        active: j['active'] as bool? ?? true,
      );
}

class Resolution {
  Resolution({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.votesFor,
    required this.votesAgainst,
    required this.votesAbstain,
    required this.outcome,
    this.myVote,
  });
  final int id;
  final String title;
  final String description;
  final String status;
  final int votesFor;
  final int votesAgainst;
  final int votesAbstain;
  final String outcome;
  final String? myVote; // the current member's choice, or null if not voted

  bool get isOpen => status == 'open';
  bool get hasVoted => myVote != null;
  int get total => votesFor + votesAgainst + votesAbstain;

  factory Resolution.fromJson(Map<String, dynamic> j) {
    final r = (j['results'] as Map<String, dynamic>?) ?? const {};
    return Resolution(
      id: j['id'] as int,
      title: j['title'] as String,
      description: j['description'] as String? ?? '',
      status: j['status'] as String? ?? '',
      outcome: j['outcome'] as String? ?? 'pending',
      myVote: j['my_vote'] as String?,
      votesFor: (r['for'] as int?) ?? 0,
      votesAgainst: (r['against'] as int?) ?? 0,
      votesAbstain: (r['abstain'] as int?) ?? 0,
    );
  }
}

class MemberProfile {
  MemberProfile({
    required this.id,
    required this.fullName,
    required this.memberNo,
    required this.email,
    required this.phone,
    required this.roleName,
    required this.status,
    required this.shareCapital,
    required this.savingsBalance,
    required this.photo,
    required this.dateOfBirth,
    required this.gender,
    required this.address,
    required this.occupation,
    required this.nextOfKinName,
    required this.nextOfKinPhone,
    required this.bankName,
    required this.bankCode,
    required this.bankAccountNo,
    required this.documentCount,
    required this.verifiedVia,
    required this.verificationMissing,
    required this.verificationWithdrawn,
    required this.verificationStatus,
    required this.verificationNote,
    required this.profilePercent,
    required this.profileSteps,
  });
  final int id;
  final String fullName;
  final String memberNo;
  final String email;
  final String phone;
  final String? roleName;
  final String status;
  final double shareCapital;
  final double savingsBalance;
  final String? photo;
  final String? dateOfBirth;
  final String gender;
  final String address;
  final String occupation;
  final String nextOfKinName;
  final String nextOfKinPhone;
  final String bankName;

  /// The provider's code for [bankName] — e.g. "044" for Access Bank.
  ///
  /// Without it a loan cannot be paid out electronically: a transfer recipient
  /// is created from a bank *code*, never from a name. Blank on every record
  /// written before the picker existed, which is why the edit sheet asks for it
  /// again rather than assuming the stored name is enough.
  final String bankCode;
  final String bankAccountNo;
  final int documentCount;

  /// "officer" when verified, otherwise null. Only an officer verifies.
  final String? verifiedVia;

  /// Everything still needed before officers can review the member.
  final List<String> verificationMissing;

  /// An officer declined or withdrew it; see [verificationNote].
  final bool verificationWithdrawn;

  /// incomplete → (profile done) awaiting → officer: verified | withdrawn.
  final String verificationStatus;

  /// The officer's reason when declining — what the member should fix.
  final String verificationNote;

  final int profilePercent;
  final List<ProfileStep> profileSteps;

  bool get isVerified => verifiedVia != null;

  factory MemberProfile.fromJson(Map<String, dynamic> j) => MemberProfile(
        id: j['id'] as int,
        fullName: j['full_name'] as String? ?? '',
        memberNo: j['member_no'] as String? ?? '',
        email: j['email'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        roleName: j['role_name'] as String?,
        status: j['status'] as String? ?? '',
        shareCapital: double.tryParse('${j['share_capital']}') ?? 0,
        savingsBalance: double.tryParse('${j['savings_balance']}') ?? 0,
        photo: j['photo'] as String?,
        dateOfBirth: j['date_of_birth'] as String?,
        gender: j['gender'] as String? ?? '',
        address: j['address'] as String? ?? '',
        occupation: j['occupation'] as String? ?? '',
        nextOfKinName: j['next_of_kin_name'] as String? ?? '',
        nextOfKinPhone: j['next_of_kin_phone'] as String? ?? '',
        bankName: j['bank_name'] as String? ?? '',
        bankCode: j['bank_code'] as String? ?? '',
        bankAccountNo: j['bank_account_no'] as String? ?? '',
        documentCount: j['document_count'] as int? ?? 0,
        verifiedVia: j['verified_via'] as String?,
        verificationMissing:
            ((j['verification_missing'] as List?) ?? const [])
                .map((e) => '$e')
                .toList(),
        verificationWithdrawn: j['verification_withdrawn'] as bool? ?? false,
        verificationStatus:
            j['verification_status'] as String? ?? 'incomplete',
        verificationNote: j['verification_note'] as String? ?? '',
        profilePercent: j['profile_percent'] as int? ?? 0,
        profileSteps: ((j['profile_steps'] as List?) ?? const [])
            .map((s) => ProfileStep.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

/// One step of completing the profile (details, contact, photo, ID).
class ProfileStep {
  const ProfileStep(
      {required this.key,
      required this.label,
      required this.done,
      required this.missing});
  final String key;
  final String label;
  final bool done;
  final List<String> missing;

  factory ProfileStep.fromJson(Map<String, dynamic> j) => ProfileStep(
        key: j['key'] as String? ?? '',
        label: j['label'] as String? ?? '',
        done: j['done'] as bool? ?? false,
        missing: ((j['missing'] as List?) ?? const [])
            .map((e) => '$e')
            .toList(),
      );
}

class BankOption {
  const BankOption({required this.code, required this.name});
  final String code;
  final String name;

  factory BankOption.fromJson(Map<String, dynamic> j) => BankOption(
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
      );
}

class MemberDocument {
  MemberDocument({
    required this.id,
    required this.docType,
    required this.docTypeDisplay,
    required this.label,
    required this.file,
  });
  final int id;
  final String docType;
  final String docTypeDisplay;
  final String label;
  final String file;

  factory MemberDocument.fromJson(Map<String, dynamic> j) => MemberDocument(
        id: j['id'] as int,
        docType: j['doc_type'] as String? ?? '',
        docTypeDisplay: j['doc_type_display'] as String? ?? '',
        label: j['label'] as String? ?? '',
        file: j['file'] as String? ?? '',
      );
}

class LoanProduct {
  LoanProduct({
    required this.id,
    required this.name,
    required this.interestRate,
    required this.maxAmount,
    required this.maxTermMonths,
    this.feePercent = 0,
    this.feeFlat = 0,
  });
  final int id;
  final String name;
  final double interestRate;
  final double maxAmount;
  final int maxTermMonths;

  /// Application fee: this % of the amount plus [feeFlat], deducted when the
  /// loan is paid out. The member repays the full amount.
  final double feePercent;
  final double feeFlat;

  double feeFor(double amount) =>
      ((feeFlat + amount * feePercent / 100) * 100).roundToDouble() / 100;

  factory LoanProduct.fromJson(Map<String, dynamic> j) => LoanProduct(
        id: j['id'] as int,
        name: j['name'] as String,
        interestRate: double.tryParse('${j['interest_rate']}') ?? 0,
        maxAmount: double.tryParse('${j['max_amount']}') ?? 0,
        maxTermMonths: j['max_term_months'] as int? ?? 12,
        feePercent:
            double.tryParse('${j['application_fee_percent']}') ?? 0,
        feeFlat: double.tryParse('${j['application_fee_flat']}') ?? 0,
      );
}

class Loan {
  Loan({
    required this.id,
    required this.productName,
    required this.principal,
    required this.interestRate,
    required this.termMonths,
    required this.purpose,
    required this.status,
    required this.statusDisplay,
    required this.totalRepayable,
    required this.outstanding,
    this.repaidAmount = 0,
    this.monthlyInstalment = 0,
    this.instalments = const [],
    this.repayments = const [],
    this.coopBank,
    this.applicationFee = 0,
  });
  final int id;
  final String productName;
  final double principal;

  /// Deducted at disbursement; the member receives [amountToDisburse].
  final double applicationFee;
  double get amountToDisburse => principal - applicationFee;
  final double interestRate;
  final int termMonths;
  final String purpose;
  final String status;
  final String statusDisplay;
  final double totalRepayable;
  final double outstanding;
  final double repaidAmount;
  final double monthlyInstalment;
  final List<Instalment> instalments;
  final List<RepaymentRow> repayments;
  final CoopBank? coopBank;

  /// Member-reported transfers still awaiting officer confirmation.
  List<RepaymentRow> get pendingClaims => repayments
      .where((r) =>
          r.status == 'pending' && r.channel == 'transfer' && r.expiresAt == null)
      .toList();

  /// A bank transfer started in the app but not yet reported as sent.
  StartedTransfer? get unsentTransfer {
    if (coopBank == null) return null;
    for (final r in repayments) {
      if (r.status == 'pending' && r.channel == 'transfer' && r.expiresAt != null) {
        return StartedTransfer(
          id: r.id,
          amount: r.amount,
          reference: r.reference,
          expiresAt: r.expiresAt!,
          bank: coopBank!,
        );
      }
    }
    return null;
  }

  factory Loan.fromJson(Map<String, dynamic> j) => Loan(
        id: j['id'] as int,
        productName: j['product_name'] as String? ?? '',
        principal: double.tryParse('${j['principal']}') ?? 0,
        applicationFee: double.tryParse('${j['application_fee']}') ?? 0,
        interestRate: double.tryParse('${j['interest_rate']}') ?? 0,
        termMonths: j['term_months'] as int? ?? 0,
        purpose: j['purpose'] as String? ?? '',
        status: j['status'] as String? ?? '',
        statusDisplay: j['status_display'] as String? ?? '',
        totalRepayable: double.tryParse('${j['total_repayable']}') ?? 0,
        outstanding: double.tryParse('${j['outstanding']}') ?? 0,
        repaidAmount: double.tryParse('${j['repaid_amount']}') ?? 0,
        monthlyInstalment: double.tryParse('${j['monthly_instalment']}') ?? 0,
        instalments: ((j['instalments'] as List?) ?? [])
            .map((i) => Instalment.fromJson(i as Map<String, dynamic>))
            .toList(),
        repayments: ((j['repayments'] as List?) ?? [])
            .map((r) => RepaymentRow.fromJson(r as Map<String, dynamic>))
            .toList(),
        coopBank: j['coop_bank'] == null
            ? null
            : CoopBank.fromJson(j['coop_bank'] as Map<String, dynamic>),
      );
}

class Instalment {
  Instalment({
    required this.id,
    required this.sequence,
    required this.dueDate,
    required this.amountDue,
    required this.principalComponent,
    required this.interestComponent,
    required this.amountPaid,
    required this.status,
    required this.isOverdue,
  });
  final int id;
  final int sequence;
  final String dueDate;
  final double amountDue;
  final double principalComponent;
  final double interestComponent;
  final double amountPaid;
  final String status;
  final bool isOverdue;

  bool get isPaid => status == 'paid';

  factory Instalment.fromJson(Map<String, dynamic> j) => Instalment(
        id: j['id'] as int,
        sequence: j['sequence'] as int? ?? 0,
        dueDate: j['due_date'] as String? ?? '',
        amountDue: double.tryParse('${j['amount_due']}') ?? 0,
        principalComponent:
            double.tryParse('${j['principal_component']}') ?? 0,
        interestComponent: double.tryParse('${j['interest_component']}') ?? 0,
        amountPaid: double.tryParse('${j['amount_paid']}') ?? 0,
        status: j['status'] as String? ?? 'pending',
        isOverdue: j['is_overdue'] as bool? ?? false,
      );
}

class RepaymentRow {
  RepaymentRow({
    required this.id,
    required this.amount,
    required this.channel,
    required this.status,
    required this.note,
    this.reference = '',
    this.expiresAt,
  });
  final int id;
  final double amount;
  final String channel;
  final String status;
  final String note;
  /// For a bank transfer, the code the member puts in the narration.
  final String reference;
  /// Set only on a bank transfer started but not yet reported as sent.
  final DateTime? expiresAt;

  factory RepaymentRow.fromJson(Map<String, dynamic> j) => RepaymentRow(
        id: j['id'] as int? ?? 0,
        amount: double.tryParse('${j['amount']}') ?? 0,
        channel: j['channel'] as String? ?? '',
        status: j['status'] as String? ?? '',
        note: j['note'] as String? ?? '',
        reference: j['psp_reference'] as String? ?? '',
        expiresAt: DateTime.tryParse('${j['expires_at'] ?? ''}'),
      );
}

/// A repayment by bank transfer the member has started: where to send it,
/// how much, what to put in the narration, and until when.
class StartedTransfer {
  StartedTransfer({
    required this.id,
    required this.amount,
    required this.reference,
    required this.expiresAt,
    required this.bank,
  });
  final int id;
  final double amount;
  final String reference;
  final DateTime expiresAt;
  final CoopBank bank;

  factory StartedTransfer.fromJson(Map<String, dynamic> j) => StartedTransfer(
        id: j['id'] as int,
        amount: double.tryParse('${j['amount']}') ?? 0,
        reference: j['psp_reference'] as String? ?? '',
        expiresAt: DateTime.parse(j['expires_at'] as String),
        bank: CoopBank.fromJson(j['bank'] as Map<String, dynamic>),
      );
}

class CoopBank {
  CoopBank({required this.bankName, required this.accountName, required this.accountNo});
  final String bankName;
  final String accountName;
  final String accountNo;

  factory CoopBank.fromJson(Map<String, dynamic> j) => CoopBank(
        bankName: j['bank_name'] as String? ?? '',
        accountName: j['account_name'] as String? ?? '',
        accountNo: j['account_no'] as String? ?? '',
      );
}

class SavingsProduct {
  SavingsProduct({required this.id, required this.name, required this.interestRate});
  final int id;
  final String name;
  final double interestRate;

  factory SavingsProduct.fromJson(Map<String, dynamic> j) => SavingsProduct(
        id: j['id'] as int,
        name: j['name'] as String,
        interestRate: double.tryParse('${j['interest_rate']}') ?? 0,
      );
}

class SavingsGoal {
  SavingsGoal({
    required this.id,
    required this.name,
    required this.productName,
    required this.targetAmount,
    required this.savedAmount,
    required this.progressPct,
    required this.targetDate,
  });
  final int id;
  final String name;
  final String productName;
  final double targetAmount;
  final double savedAmount;
  final int progressPct;
  final String? targetDate;

  factory SavingsGoal.fromJson(Map<String, dynamic> j) => SavingsGoal(
        id: j['id'] as int,
        name: j['name'] as String? ?? '',
        productName: j['product_name'] as String? ?? '',
        targetAmount: double.tryParse('${j['target_amount']}') ?? 0,
        savedAmount: double.tryParse('${j['saved_amount']}') ?? 0,
        progressPct: j['progress_pct'] as int? ?? 0,
        targetDate: j['target_date'] as String?,
      );
}

class DividendRow {
  DividendRow({
    required this.id,
    required this.periodLabel,
    required this.status,
    required this.amount,
    required this.shareCapital,
  });
  final int id;
  final String periodLabel;
  final String status;
  final double amount;
  final double shareCapital;

  factory DividendRow.fromJson(Map<String, dynamic> j) => DividendRow(
        id: j['id'] as int,
        periodLabel: j['period_label'] as String? ?? '',
        status: j['status'] as String? ?? '',
        amount: double.tryParse('${j['amount']}') ?? 0,
        shareCapital: double.tryParse('${j['share_capital']}') ?? 0,
      );
}

class Announcement {
  Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.sentAt,
  });
  final int id;
  final String title;
  final String body;
  final String? sentAt;

  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
        id: j['id'] as int,
        title: j['title'] as String,
        body: j['body'] as String? ?? '',
        sentAt: j['sent_at'] as String?,
      );
}

/// The cost of paying online: the amount, Paystack's fee (the member's to
/// pay), and the total charged at checkout.
class FeeQuote {
  FeeQuote({required this.amount, required this.fee, required this.total});
  final double amount;
  final double fee;
  final double total;

  factory FeeQuote.fromJson(Map<String, dynamic> j) => FeeQuote(
        amount: double.tryParse('${j['amount']}') ?? 0,
        fee: double.tryParse('${j['fee']}') ?? 0,
        total: double.tryParse('${j['total']}') ?? 0,
      );
}


/// Where a request to delete the account stands, and what must be settled
/// (savings paid out, share capital returned, loans closed) before an officer
/// can complete it.
class DeletionState {
  const DeletionState(
      {required this.pendingSince, required this.blockers});

  /// When the pending request was made, or null when there is none.
  final String? pendingSince;
  final List<String> blockers;

  bool get isPending => pendingSince != null;

  factory DeletionState.fromJson(Map<String, dynamic> j) {
    final req = j['request'] as Map<String, dynamic>?;
    return DeletionState(
      pendingSince: req != null && req['status'] == 'pending'
          ? req['created_at'] as String?
          : null,
      blockers: ((j['blockers'] as List?) ?? const []).map((b) {
        final m = b as Map<String, dynamic>;
        final coop = m['cooperative'] as String?;
        return coop == null ? '${m['message']}' : '$coop: ${m['message']}';
      }).toList(),
    );
  }
}


class Society {
  Society({required this.id, required this.name, required this.place});
  final int id;
  final String name;
  final String place;

  factory Society.fromJson(Map<String, dynamic> j) => Society(
        id: j['id'] as int,
        name: j['name'] as String,
        place: [j['lga'], j['state']]
            .where((v) => v != null && '$v'.isNotEmpty)
            .join(', '),
      );
}

class MyJoinRequest {
  MyJoinRequest({
    required this.id,
    required this.cooperativeId,
    required this.cooperativeName,
    required this.status,
    required this.decisionNote,
  });
  final int id;
  final int cooperativeId;
  final String cooperativeName;
  final String status; // pending | rejected
  final String decisionNote;

  bool get isPending => status == 'pending';

  factory MyJoinRequest.fromJson(Map<String, dynamic> j) => MyJoinRequest(
        id: j['id'] as int,
        cooperativeId: j['cooperative_id'] as int,
        cooperativeName: j['cooperative_name'] as String,
        status: j['status'] as String,
        decisionNote: j['decision_note'] as String? ?? '',
      );
}
