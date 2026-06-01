/// Uygulama genelinde sabitler
/// Backend URL'si ve API path'leri burada yönetilir.
class AppConstants {
  // Backend sunucu adresi — keşif servisi tarafından güncellenecektir
  static String baseUrl = 'http://10.199.81.131:3001'; 

  static String get apiBase   => '$baseUrl/api';
  static String get wsBase {
    final uri = Uri.parse(baseUrl);
    final wsProto = uri.scheme == 'https' ? 'wss' : 'ws';
    return '$wsProto://${uri.host}:${uri.port}/ws';
  }

  // API endpoint'leri
  static String get loginUrl  => '$apiBase/auth/login';
  static String get meUrl     => '$apiBase/auth/me';
  static String get roomsUrl  => '$apiBase/rooms';
  static String get logsUrl   => '$apiBase/data/logs';

  // Light Modes
  static const String modeManual   = 'manual';
  static const String modeAuto     = 'auto';
  static const String modeHalfAuto = 'half_auto';

  static const Map<String, String> modeLabels = {
    modeManual:   'Manuel',
    modeAuto:     'Otomatik',
    modeHalfAuto: 'Yarı Otomatik',
  };

  static const Map<String, String> modeDescriptions = {
    modeManual:   'Işığı elle açıp kapatırsınız',
    modeAuto:     'LDR eşiğine göre otomatik açılır/kapanır',
    modeHalfAuto: 'Karanlık VE odada kişi varsa açılır',
  };
}
