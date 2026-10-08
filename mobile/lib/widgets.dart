import 'package:flutter/material.dart';
import 'theme.dart';

/// Small shared building blocks so the tabs read consistently.

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(text,
              style: const TextStyle(
                  color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w700)),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.margin, this.padding});
  final Widget child;
  final EdgeInsets? margin;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 20, vertical: 5),
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: AppColors.line),
      ),
      child: child,
    );
  }
}

/// The signature green gradient panel (savings hero, etc.).
class GreenPanel extends StatelessWidget {
  const GreenPanel({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.green, AppColors.greenHover],
        ),
      ),
      child: child,
    );
  }
}

Widget loadingCenter() =>
    const Center(child: Padding(padding: EdgeInsets.all(48), child: CircularProgressIndicator()));

Widget errorState(String message, VoidCallback onRetry) => ListView(
      children: [
        const SizedBox(height: 200),
        const Icon(Icons.cloud_off, color: AppColors.muted2, size: 40),
        const SizedBox(height: 12),
        // Real server messages are sentences, not "Could not load." — they have
        // to wrap rather than run off both edges.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      ],
    );

/// Nothing to show, and nothing wrong — deliberately distinct from
/// [errorState]. Conflating the two tells a member their cooperative has no
/// contribution types when the truth is that the request never arrived.
Widget emptyState(String title, String hint) => ListView(
      children: [
        const SizedBox(height: 180),
        const Icon(Icons.inbox_outlined, color: AppColors.muted2, size: 40),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            hint,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ),
      ],
    );

/// Naira to the kobo — a checkout total must match what Paystack charges.
String koboText(double v) {
  final cents = (v * 100).round();
  final whole = cents ~/ 100;
  final k = (cents % 100).toString().padLeft(2, '0');
  final grouped = whole.toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
  return '₦$grouped.$k';
}

/// One line of a fee breakdown: "Paystack fee ……… ₦520.31".
class FeeQuoteRow {
  static Widget row(String label, double value, {bool bold = false}) {
    final style = TextStyle(
      color: bold ? AppColors.ink : AppColors.muted,
      fontSize: 13,
      fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(koboText(value), style: style)],
      ),
    );
  }
}
