import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants.dart';

/// WebSocket servisi — backend'den canlı sensor verisi alır
class WebSocketService extends ChangeNotifier {
  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  bool _connected = false;
  String? _lastError;

  // Canlı değerler
  int _globalLdr     = 0;
  int _personCount   = 0;
  bool _mqttOnline   = true;

  // Listener callback'leri
  final List<Function(Map<String, dynamic>)> _listeners = [];

  bool get connected   => _connected;
  String? get lastError => _lastError;
  int get globalLdr    => _globalLdr;
  int get personCount  => _personCount;
  bool get mqttOnline  => _mqttOnline;

  void addMessageListener(Function(Map<String, dynamic>) fn) {
    _listeners.add(fn);
  }

  void removeMessageListener(Function(Map<String, dynamic>) fn) {
    _listeners.remove(fn);
  }

  Future<void> connect(String token) async {
    await disconnect();
    try {
      final uri = Uri.parse('${AppConstants.wsBase}?token=$token');
      _channel = WebSocketChannel.connect(uri);
      _sub = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone:  _onDone,
      );
      _connected = true;
      _lastError = null;
      notifyListeners();
    } catch (e) {
      _lastError = e.toString();
      _connected = false;
      notifyListeners();
    }
  }

  void _onMessage(dynamic raw) {
    try {
      final data = jsonDecode(raw as String) as Map<String, dynamic>;
      final type = data['type'] as String?;

      if (type == 'sensor_update') {
        if (data['global_ldr'] != null) {
          _globalLdr = (data['global_ldr'] as num).toInt();
        }
        if (data['person_count'] != null) {
          _personCount = (data['person_count'] as num).toInt();
        }
      } else if (type == 'mqtt_status') {
        _mqttOnline = data['connected'] as bool? ?? true;
      }

      // Tüm listener'lara ilet
      for (final fn in _listeners) {
        fn(data);
      }

      notifyListeners();
    } catch (_) {}
  }

  void _onError(dynamic err) {
    _connected = false;
    _lastError = err.toString();
    notifyListeners();
    _scheduleReconnect();
  }

  void _onDone() {
    _connected = false;
    notifyListeners();
    _scheduleReconnect();
  }

  Timer? _reconnectTimer;
  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () async {
      // Reconnect token ile (AuthService'den al)
      // Bu çağrı RoomProvider tarafından yönetilir
    });
  }

  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    await _sub?.cancel();
    await _channel?.sink.close();
    _channel = null;
    _connected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
