import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import '../models/room.dart';
import '../models/light_log.dart';
import 'auth_service.dart';

/// Backend REST API ile iletişim servisi
class ApiService {
  // ─── Rooms ────────────────────────────────────────────────────────────────

  /// Tüm odaları getir
  static Future<List<Room>> getRooms() async {
    final headers = await AuthService.authHeader();
    final res = await http
        .get(Uri.parse(AppConstants.roomsUrl), headers: headers)
        .timeout(const Duration(seconds: 10));

    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((j) => Room.fromJson(j as Map<String, dynamic>)).toList();
    }
    throw Exception('Odalar alınamadı: ${res.statusCode}');
  }

  /// Tek oda detayı
  static Future<Room> getRoom(int roomId) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .get(Uri.parse('${AppConstants.roomsUrl}/$roomId'), headers: headers)
        .timeout(const Duration(seconds: 10));

    if (res.statusCode == 200) {
      return Room.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
    }
    throw Exception('Oda alınamadı: ${res.statusCode}');
  }

  /// Mod değiştir: manual | auto | half_auto
  static Future<void> setMode(int roomId, String mode) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .put(
          Uri.parse('${AppConstants.roomsUrl}/$roomId/mode'),
          headers: headers,
          body: jsonEncode({'mode': mode}),
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Mod değiştirilemedi');
    }
  }

  /// LDR eşiğini güncelle
  static Future<void> setThreshold(int roomId, int threshold) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .put(
          Uri.parse('${AppConstants.roomsUrl}/$roomId/threshold'),
          headers: headers,
          body: jsonEncode({'ldr_threshold': threshold}),
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Eşik değiştirilemedi');
    }
  }

  /// Manuel ışık kontrolü (state: 0 veya 1)
  static Future<void> setLight(int roomId, int state) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .post(
          Uri.parse('${AppConstants.roomsUrl}/$roomId/light'),
          headers: headers,
          body: jsonEncode({'state': state}),
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Işık kontrolü başarısız');
    }
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  /// Oda bazlı ışık kontrol logları
  static Future<List<LightLog>> getRoomLogs(int roomId, {int limit = 50}) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .get(
          Uri.parse('${AppConstants.roomsUrl}/$roomId/logs?limit=$limit'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final list = data['logs'] as List;
      return list.map((j) => LightLog.fromJson(j as Map<String, dynamic>)).toList();
    }
    throw Exception('Loglar alınamadı: ${res.statusCode}');
  }

  /// Tüm odaların ışık kontrol logları
  static Future<List<LightLog>> getAllLogs({int limit = 100}) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .get(
          Uri.parse('${AppConstants.roomsUrl}/logs/all?limit=$limit'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((j) => LightLog.fromJson(j as Map<String, dynamic>)).toList();
    }
    throw Exception('Tüm loglar alınamadı: ${res.statusCode}');
  }

  /// Yeni oda ekle (admin)
  static Future<void> createRoom({
    required String name,
    required String mqttCmdTopic,
    String lightMode = 'manual',
    int ldrThreshold = 1500,
  }) async {
    final headers = await AuthService.authHeader();
    final res = await http
        .post(
          Uri.parse(AppConstants.roomsUrl),
          headers: headers,
          body: jsonEncode({
            'name':           name,
            'mqtt_cmd_topic': mqttCmdTopic,
            'light_mode':     lightMode,
            'ldr_threshold':  ldrThreshold,
          }),
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Oda oluşturulamadı');
    }
  }
}
