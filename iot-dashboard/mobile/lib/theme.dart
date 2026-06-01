import 'package:flutter/material.dart';

/// Uygulamanın renk paleti ve tema tanımları
class AppTheme {
  // Dark Theme Colors — derin lacivert + elektrik mavisi
  static const Color bgDark       = Color(0xFF0A0E1A);
  static const Color bgCard       = Color(0xFF111827);
  static const Color bgSurface    = Color(0xFF1C2537);
  static const Color accent        = Color(0xFF3B82F6); // elektrik mavisi
  static const Color accentLight   = Color(0xFF60A5FA);
  static const Color success       = Color(0xFF10B981);
  static const Color warning       = Color(0xFFF59E0B);
  static const Color danger        = Color(0xFFEF4444);
  static const Color textPrimary   = Color(0xFFF1F5F9);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color border        = Color(0xFF1E2D45);

  // Light Theme Colors — modern gri + elektrik mavisi
  static const Color bgLight            = Color(0xFFF8FAFC);
  static const Color bgCardLight        = Color(0xFFFFFFFF);
  static const Color bgSurfaceLight     = Color(0xFFF1F5F9);
  static const Color textPrimaryLight   = Color(0xFF0F172A);
  static const Color textSecondaryLight = Color(0xFF475569);
  static const Color borderLight        = Color(0xFFE2E8F0);

  // Mod renkleri
  static const Color modeManual   = Color(0xFF6366F1); // indigo
  static const Color modeAuto     = Color(0xFF10B981); // yeşil
  static const Color modeHalfAuto = Color(0xFFF59E0B); // sarı

  static ThemeData get lightTheme => ThemeData(
        useMaterial3:       true,
        brightness:         Brightness.light,
        scaffoldBackgroundColor: bgLight,
        colorScheme: const ColorScheme.light(
          primary:   accent,
          secondary: accent,
          surface:   bgCardLight,
          error:     danger,
        ),
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor:  bgLight,
          foregroundColor:  textPrimaryLight,
          elevation:        0,
          centerTitle:      false,
          titleTextStyle:   TextStyle(
            color:      textPrimaryLight,
            fontSize:   20,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
          iconTheme: IconThemeData(color: textPrimaryLight),
        ),
        cardTheme: CardThemeData(
          color:     bgCardLight,
          elevation: 0,
          shape:     RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side:         const BorderSide(color: borderLight, width: 1),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor:  accent,
            foregroundColor:  Colors.white,
            elevation:        0,
            padding:          const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape:            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled:      true,
          fillColor:   bgSurfaceLight,
          border:      OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: borderLight),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: borderLight),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: accent, width: 2),
          ),
          labelStyle: const TextStyle(color: textSecondaryLight),
          hintStyle:  const TextStyle(color: textSecondaryLight),
        ),
        sliderTheme: const SliderThemeData(
          activeTrackColor:   accent,
          thumbColor:         accent,
          overlayColor:       Color(0x223B82F6),
          inactiveTrackColor: bgSurfaceLight,
        ),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? Colors.white : textSecondaryLight,
          ),
          trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? success : bgSurfaceLight,
          ),
        ),
        dividerTheme: const DividerThemeData(color: borderLight, thickness: 1),
        snackBarTheme: SnackBarThemeData(
          backgroundColor:    bgSurfaceLight,
          contentTextStyle:   const TextStyle(color: textPrimaryLight),
          shape:              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          behavior:           SnackBarBehavior.floating,
        ),
      );

  static ThemeData get darkTheme => ThemeData(
        useMaterial3:       true,
        brightness:         Brightness.dark,
        scaffoldBackgroundColor: bgDark,
        colorScheme: const ColorScheme.dark(
          primary:   accent,
          secondary: accentLight,
          surface:   bgCard,
          error:     danger,
        ),
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor:  bgDark,
          foregroundColor:  textPrimary,
          elevation:        0,
          centerTitle:      false,
          titleTextStyle:   TextStyle(
            color:      textPrimary,
            fontSize:   20,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
        cardTheme: CardThemeData(
          color:     bgCard,
          elevation: 0,
          shape:     RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side:         const BorderSide(color: border, width: 1),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor:  accent,
            foregroundColor:  Colors.white,
            elevation:        0,
            padding:          const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape:            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled:      true,
          fillColor:   bgSurface,
          border:      OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: accent, width: 2),
          ),
          labelStyle: const TextStyle(color: textSecondary),
          hintStyle:  const TextStyle(color: textSecondary),
        ),
        sliderTheme: const SliderThemeData(
          activeTrackColor:   accent,
          thumbColor:         accentLight,
          overlayColor:       Color(0x223B82F6),
          inactiveTrackColor: bgSurface,
        ),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? Colors.white : textSecondary,
          ),
          trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? success : bgSurface,
          ),
        ),
        dividerTheme: const DividerThemeData(color: border, thickness: 1),
        snackBarTheme: SnackBarThemeData(
          backgroundColor:    bgSurface,
          contentTextStyle:   const TextStyle(color: textPrimary),
          shape:              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          behavior:           SnackBarBehavior.floating,
        ),
      );

  /// Mod'a göre renk döner
  static Color modeColor(String mode) {
    switch (mode) {
      case 'auto':      return modeAuto;
      case 'half_auto': return modeHalfAuto;
      default:          return modeManual;
    }
  }

  /// Mod'a göre ikon döner
  static IconData modeIcon(String mode) {
    switch (mode) {
      case 'auto':      return Icons.auto_awesome;
      case 'half_auto': return Icons.people_alt;
      default:          return Icons.touch_app;
    }
  }
}

/// Dynamic theme properties from BuildContext
extension ThemeContext on BuildContext {
  ThemeData get theme => Theme.of(this);
  Color get bgDark => theme.scaffoldBackgroundColor;
  Color get bgCard => theme.cardTheme.color ?? theme.colorScheme.surface;
  Color get bgSurface => theme.brightness == Brightness.dark ? const Color(0xFF1C2537) : const Color(0xFFF1F5F9);
  Color get textPrimary => theme.brightness == Brightness.dark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
  Color get textSecondary => theme.brightness == Brightness.dark ? const Color(0xFF94A3B8) : const Color(0xFF475569);
  Color get border => theme.brightness == Brightness.dark ? const Color(0xFF1E2D45) : const Color(0xFFE2E8F0);
}
