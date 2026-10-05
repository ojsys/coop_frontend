import 'package:flutter/material.dart';

/// CooperativeOS design tokens — mirrors the web app's Tailwind `@theme`
/// (green / gold / paper). Kept in one place so screens never hard-code colours.
class AppColors {
  static const green = Color(0xFF0B4F3A);
  static const greenHover = Color(0xFF0E6048);
  static const greenBright = Color(0xFF1F8A5B);
  static const green50 = Color(0xFFE7F0EA);
  static const gold = Color(0xFFD99E2B);
  static const goldDeep = Color(0xFFC98A1E);
  static const paper = Color(0xFFF4F1EA);
  static const card = Color(0xFFFFFDF9);
  static const sand = Color(0xFFF7F3EA);
  static const line = Color(0xFFECE7DB);
  static const ink = Color(0xFF1B1A17);
  static const inkSoft = Color(0xFF46423A);
  static const muted = Color(0xFF6F6B62);
  static const muted2 = Color(0xFF8A8478);
  static const danger = Color(0xFFB8432C);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.green,
      primary: AppColors.green,
      surface: AppColors.paper,
    ),
    scaffoldBackgroundColor: AppColors.paper,
    fontFamily: 'Roboto', // swap for Hanken Grotesk once bundled as an asset
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.inkSoft,
      displayColor: AppColors.ink,
    ),
    cardTheme: const CardThemeData(
      color: AppColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(15)),
        side: BorderSide(color: AppColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.green,
        foregroundColor: AppColors.paper,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
  );
}
