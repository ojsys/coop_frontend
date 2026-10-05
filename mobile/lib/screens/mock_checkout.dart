import 'package:flutter/material.dart';
import '../format.dart';
import '../theme.dart';

/// A local stand-in for the Paystack checkout, shown only when no live key is
/// configured. It mirrors the real flow's shape (a checkout the member must
/// actively complete before anything posts) so the end-to-end experience is
/// testable without credentials. Pops `true` when "paid", `false` on cancel.
class MockCheckout extends StatelessWidget {
  const MockCheckout({
    super.key,
    required this.amount,
    required this.coopName,
    required this.memberNo,
  });
  final double amount;
  final String coopName;
  final String memberNo;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: 0.35),
      body: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(20),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                color: AppColors.green,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('paystack',
                        style: TextStyle(
                            color: AppColors.paper,
                            fontFamily: 'monospace',
                            fontSize: 13)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('TEST MODE',
                          style: TextStyle(
                              color: AppColors.green,
                              fontSize: 10,
                              fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                child: Column(
                  children: [
                    Text('Pay $coopName',
                        style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(naira(amount),
                        style: const TextStyle(
                            color: AppColors.ink,
                            fontSize: 32,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF6ECD2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline, size: 16, color: AppColors.goldDeep),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Local test mode — no Paystack keys configured. Card / bank / USSD details are collected inside Paystack, never here.',
                              style: TextStyle(color: AppColors.goldDeep, fontSize: 11.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => Navigator.of(context).pop(true),
                        icon: const Icon(Icons.check_circle, size: 18),
                        label: const Text('Complete test payment'),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('Cancel',
                          style: TextStyle(color: AppColors.muted)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}
