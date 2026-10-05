import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../theme.dart';

/// Shows one of the society's published policies inside the app.
///
/// Google Play requires a reachable privacy policy for any app that handles
/// personal data, and this one handles a great deal of it — names, phone
/// numbers, bank details and KYC documents. Linking to the live page rather than
/// bundling the text means a policy update reaches members without an app
/// release, which matters because the content is maintained by an administrator
/// (platform_admin.LegalDocument) and reviewed by a lawyer.
///
/// Deliberately not PaymentWebView: that screen watches for Paystack's return
/// URL and pops a result, which is meaningless here.
class LegalWebView extends StatefulWidget {
  const LegalWebView({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<LegalWebView> createState() => _LegalWebViewState();
}

class _LegalWebViewState extends State<LegalWebView> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() {
            _loading = true;
            _failed = false;
          }),
          onPageFinished: (_) => setState(() => _loading = false),
          // Offline or the site down: say so rather than showing a blank page,
          // which a member would read as the policy not existing.
          onWebResourceError: (_) => setState(() {
            _loading = false;
            _failed = true;
          }),
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _failed
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.cloud_off, color: AppColors.muted,
                        size: 40),
                    const SizedBox(height: 12),
                    const Text(
                      'Could not load this page. Check your connection and '
                      'try again.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () =>
                          _controller.loadRequest(Uri.parse(widget.url)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                WebViewWidget(controller: _controller),
                if (_loading) const LinearProgressIndicator(minHeight: 2),
              ],
            ),
    );
  }
}
