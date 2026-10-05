import 'package:flutter/material.dart';
import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

/// A member's own savings goals with progress, plus creating a new goal.
class SavingsGoalsScreen extends StatefulWidget {
  const SavingsGoalsScreen({super.key, required this.api});
  final Api api;

  @override
  State<SavingsGoalsScreen> createState() => _SavingsGoalsScreenState();
}

class _SavingsGoalsScreenState extends State<SavingsGoalsScreen> {
  late Future<List<SavingsGoal>> _future = widget.api.mySavingsGoals();

  void _reload() => setState(() => _future = widget.api.mySavingsGoals());

  Future<void> _add() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => _AddGoalSheet(api: widget.api),
    );
    if (added == true) _reload();
  }

  Future<void> _delete(SavingsGoal g) async {
    try {
      await widget.api.deleteSavingsGoal(g.id);
      _reload();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Savings goals'), backgroundColor: AppColors.card),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: AppColors.green,
        foregroundColor: AppColors.paper,
        icon: const Icon(Icons.add),
        label: const Text('New goal'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<SavingsGoal>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(children: [loadingCenter()]);
            }
            if (!snap.hasData) {
              return errorState(
                  errorMessage(snap.error, 'Could not load your goals.'), _reload);
            }
            final goals = snap.data!;
            if (goals.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Icon(Icons.flag_outlined, color: AppColors.muted2, size: 44),
                SizedBox(height: 12),
                Center(
                    child: Text('No savings goals yet.',
                        style: TextStyle(color: AppColors.muted))),
                SizedBox(height: 4),
                Center(
                    child: Text('Set a target to save towards.',
                        style:
                            TextStyle(color: AppColors.muted2, fontSize: 13))),
              ]);
            }
            return ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: goals.map(_goalCard).toList(),
            );
          },
        ),
      ),
    );
  }

  Widget _goalCard(SavingsGoal g) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(g.name,
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  icon: const Icon(Icons.close,
                      size: 18, color: AppColors.muted2),
                  onPressed: () => _delete(g),
                ),
              ],
            ),
            Text(g.productName,
                style: const TextStyle(color: AppColors.muted2, fontSize: 12)),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: g.progressPct / 100,
                minHeight: 8,
                backgroundColor: AppColors.sand,
                valueColor:
                    const AlwaysStoppedAnimation(AppColors.greenBright),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${naira(g.savedAmount)} of ${naira(g.targetAmount)}',
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12)),
                Text('${g.progressPct}%',
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      );
}

class _AddGoalSheet extends StatefulWidget {
  const _AddGoalSheet({required this.api});
  final Api api;

  @override
  State<_AddGoalSheet> createState() => _AddGoalSheetState();
}

class _AddGoalSheetState extends State<_AddGoalSheet> {
  late final Future<List<SavingsProduct>> _products = widget.api.savingsProducts();
  SavingsProduct? _product;
  final _name = TextEditingController();
  final _target = TextEditingController();
  bool _submitting = false;

  Future<void> _submit() async {
    if (_product == null || _name.text.isEmpty || _target.text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await widget.api.createSavingsGoal(
        productId: _product!.id,
        name: _name.text,
        targetAmount: _target.text,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
        setState(() => _submitting = false);
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New savings goal',
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 18,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          FutureBuilder<List<SavingsProduct>>(
            future: _products,
            builder: (context, snap) {
              final products = snap.data ?? [];
              if (snap.connectionState == ConnectionState.waiting) {
                return const LinearProgressIndicator();
              }
              if (products.isEmpty) {
                return const Text('No savings products are available yet.',
                    style: TextStyle(color: AppColors.muted));
              }
              return DropdownButtonFormField<SavingsProduct>(
                value: _product,
                decoration: const InputDecoration(
                    labelText: 'Savings product',
                    border: OutlineInputBorder()),
                items: products
                    .map((p) =>
                        DropdownMenuItem(value: p, child: Text(p.name)))
                    .toList(),
                onChanged: (p) => setState(() => _product = p),
              );
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            decoration: const InputDecoration(
                labelText: 'Goal name', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _target,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                labelText: 'Target amount (₦)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style:
                FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Add goal'),
          ),
        ],
      ),
    );
  }
}
