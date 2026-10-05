import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../theme.dart';

/// The sentinel URL Paystack redirects to after checkout. It never actually
/// loads — the webview intercepts the navigation and pops with the result.
const kPaymentReturnUrl = 'https://cooperativeos.app/paystack/return';

/// Hosts the Paystack checkout in-app so the member starts *and finishes* the
/// payment without leaving CooperativeOS. Pops `true` when Paystack redirects to
/// the return URL (payment attempted), `false` if the member backs out.
class PaymentWebView extends StatefulWidget {
  const PaymentWebView({super.key, required this.checkoutUrl});
  final String checkoutUrl;

  @override
  State<PaymentWebView> createState() => _PaymentWebViewState();
}

class _PaymentWebViewState extends State<PaymentWebView> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onNavigationRequest: (req) {
            if (req.url.startsWith(kPaymentReturnUrl)) {
              Navigator.of(context).pop(true); // checkout finished → verify
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.green,
        foregroundColor: AppColors.paper,
        title: const Text('Pay with Paystack'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const LinearProgressIndicator(color: AppColors.green),
        ],
      ),
    );
  }
}
