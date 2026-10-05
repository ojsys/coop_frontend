import 'package:intl/intl.dart';

final _naira = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

String naira(num value) => _naira.format(value);

String shortDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  return DateFormat('dd MMM').format(d);
}

String timeAgo(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 30) {
    final days = diff.inDays;
    return '$days day${days > 1 ? 's' : ''} ago';
  }
  return DateFormat('dd MMM yyyy').format(d);
}

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first[0] + parts.last[0]).toUpperCase();
}
