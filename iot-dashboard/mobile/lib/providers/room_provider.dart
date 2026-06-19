import 'package:flutter/foundation.dart';
import '../models/room.dart';
import '../models/light_log.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/websocket_service.dart';

class RoomProvider extends ChangeNotifier {
  List<Room> _rooms = [];
  List<LightLog> _logs = [];
  bool _loading = false;
  String? _error;

  final WebSocketService _ws;

  List<Room> get rooms => _rooms;
  List<LightLog> get logs => _logs;
  bool get loading => _loading;
  String? get error => _error;

  RoomProvider(this._ws) {
    // WebSocket mesajlarını dinle → oda state'ini canlı güncelle
    _ws.addMessageListener(_onWsMessage);
  }

  void _onWsMessage(Map<String, dynamic> data) {
    final type = data['type'] as String?;

    if (type == 'room_update') {
      // Otomasyon veya manuel durum değişikliği
      final roomId = data['room_id'] as int?;
      final lightState = data['light_state'] as int?;
      final lightMode = data['light_mode'] as String?;
      final ldrThreshold = data['ldr_threshold'] as int?;
      if (roomId != null) {
        _updateRoomField(
          roomId,
          lightState: lightState,
          lightMode: lightMode,
          ldrThreshold: ldrThreshold,
        );
      }
    } else if (type == 'sensor_update') {
      // LDR ve kişi sayısı güncellemesi
      // global_ldr yoksa ldr_value'dan oku (ESP32 direkt ldr_value gönderir)
      final ldr = (data['global_ldr'] ?? data['ldr_value']) as int?;
      final personCount = data['person_count'] as int?;
      var roomId = data['room_id'] as int?;
      final topic = data['topic'] as String?;

      if (roomId == null && topic != null) {
        roomId = _roomIdFromTopic(topic);
      }

      if (roomId != null) {
        _updateRoomField(roomId, currentLdr: ldr, personCount: personCount);
      } else if (ldr != null) {
        // Room_id bilinmiyorsa tüm odaların LDR'sini güncelle
        for (final r in _rooms) {
          _updateRoomField(r.id, currentLdr: ldr, personCount: personCount);
        }
      }
    }
  }

  int? _roomIdFromTopic(String topic) {
    // Format 1 (ESP32 + Simülätör): tarim_isik/{room_id}/telemetry
    final numMatch = RegExp(r'tarim_isik\/([0-9]+)\/').firstMatch(topic);
    if (numMatch != null) {
      final id = int.tryParse(numMatch.group(1) ?? '');
      if (id != null) return id;
    }

    // Format 2 (eski): iot_dash_abird_room/{oda_adi}/{tip}
    final nameMatch = RegExp(r'(?:room|abird_room)\/([^/]+)\/').firstMatch(topic);
    if (nameMatch != null) {
      final roomName = nameMatch.group(1);
      if (roomName != null) {
        try {
          return _rooms
              .firstWhere((r) => r.name.toLowerCase() == roomName.toLowerCase())
              .id;
        } catch (_) {}
      }
    }
    return null;
  }

  void _updateRoomField(
    int roomId, {
    int? lightState,
    int? currentLdr,
    int? personCount,
    String? lightMode,
    int? ldrThreshold,
  }) {
    final idx = _rooms.indexWhere((r) => r.id == roomId);
    if (idx == -1) return;
    _rooms[idx] = _rooms[idx].copyWith(
      lightState: lightState,
      currentLdr: currentLdr,
      personCount: personCount,
      lightMode: lightMode,
      ldrThreshold: ldrThreshold,
    );
    notifyListeners();
  }

  /// WebSocket bağlantısını başlat
  Future<void> connectWs() async {
    final token = await AuthService.getToken();
    if (token != null) await _ws.connect(token);
  }

  /// Odaları yükle
  Future<void> loadRooms() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _rooms = await ApiService.getRooms();
    } catch (e) {
      _error = e.toString();
    }

    _loading = false;
    notifyListeners();
  }

  /// Mod değiştir ve UI'ı hemen güncelle (optimistic update)
  Future<void> setMode(int roomId, String mode) async {
    final idx = _rooms.indexWhere((r) => r.id == roomId);
    if (idx == -1) return;

    final prev = _rooms[idx].lightMode;
    _updateRoomField(roomId, lightMode: mode);

    try {
      await ApiService.setMode(roomId, mode);
      await _appendLog(roomId); // logu yenile
    } catch (e) {
      _updateRoomField(roomId, lightMode: prev); // geri al
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  /// LDR eşiğini güncelle
  Future<void> setThreshold(int roomId, int threshold) async {
    final idx = _rooms.indexWhere((r) => r.id == roomId);
    if (idx == -1) return;

    _rooms[idx] = _rooms[idx].copyWith(ldrThreshold: threshold);
    notifyListeners();

    try {
      await ApiService.setThreshold(roomId, threshold);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  /// Manuel ışık kontrolü
  Future<void> setLight(int roomId, int state) async {
    final idx = _rooms.indexWhere((r) => r.id == roomId);
    if (idx == -1) return;

    _updateRoomField(roomId, lightState: state);

    try {
      await ApiService.setLight(roomId, state);
      await _appendLog(roomId);
    } catch (e) {
      _updateRoomField(roomId, lightState: state == 1 ? 0 : 1);
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  /// Logları yükle (tüm odalar) — listeyi döner ve provider state'ini günceller
  Future<List<LightLog>> loadAllLogs({int limit = 100}) async {
    try {
      _logs = await ApiService.getAllLogs(limit: limit);
      notifyListeners();
      return _logs;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return [];
    }
  }

  /// Tek oda loglarını yükle
  Future<List<LightLog>> loadRoomLogs(int roomId, {int limit = 50}) async {
    try {
      return await ApiService.getRoomLogs(roomId, limit: limit);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return [];
    }
  }

  Future<void> _appendLog(int roomId) async {
    // Sadece mevcut loglar varsa yenile, sessizce başarısız ol
    try {
      final newLogs = await ApiService.getAllLogs(limit: 100);
      _logs = newLogs;
      notifyListeners();
    } catch (_) {}
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _ws.removeMessageListener(_onWsMessage);
    super.dispose();
  }
}
