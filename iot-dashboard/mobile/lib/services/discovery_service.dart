import 'dart:convert';
import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants.dart';

class DiscoveryService {
  static const _storage = FlutterSecureStorage();
  static const _savedBaseUrlKey = 'discovered_base_url';
  static RawDatagramSocket? _socket;
  static bool _isListening = false;

  /// Son kaydedilen URL'yi yükler
  static Future<void> loadSavedUrl() async {
    try {
      final savedUrl = await _storage.read(key: _savedBaseUrlKey);
      if (savedUrl != null && savedUrl.isNotEmpty) {
        AppConstants.baseUrl = savedUrl;
        print('[Discovery] Kaydedilmiş URL yüklendi: $savedUrl');
      }
    } catch (e) {
      print('[Discovery] Kaydedilmiş URL yükleme hatası: $e');
    }
  }

  /// UDP yayını dinlemeyi başlatır
  static Future<void> startListening(Function(String newUrl) onUrlDiscovered) async {
    if (_isListening) return;

    // Önce kaydedilmiş olanı yükle
    await loadSavedUrl();

    try {
      _socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 4545);
      _socket?.broadcastEnabled = true;
      _isListening = true;
      print('[Discovery] UDP Keşif servisi başlatıldı (Port: 4545)...');

      _socket?.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          final datagram = _socket?.receive();
          if (datagram != null) {
            try {
              final message = utf8.decode(datagram.data);
              final data = jsonDecode(message);
              
              if (data['service'] == 'iot-dashboard-backend' && data['ips'] != null) {
                final List<dynamic> ips = data['ips'];
                final int port = data['port'] ?? 3001;

                if (ips.isNotEmpty) {
                  // İlk IP adresini alıyoruz (veya eşleşen IP)
                  final String ip = ips.first.toString();
                  final String newUrl = 'http://$ip:$port';

                  if (AppConstants.baseUrl != newUrl) {
                    AppConstants.baseUrl = newUrl;
                    _storage.write(key: _savedBaseUrlKey, value: newUrl);
                    print('[Discovery] Yeni backend IP adresi keşfedildi: $newUrl');
                    onUrlDiscovered(newUrl);
                  }
                }
              }
            } catch (e) {
              // Hatalı veya alakasız paket
            }
          }
        }
      });
    } catch (e) {
      print('[Discovery] UDP dinleme hatası: $e');
      _isListening = false;
    }
  }

  /// Dinlemeyi durdurur
  static void stopListening() {
    _socket?.close();
    _socket = null;
    _isListening = false;
    print('[Discovery] UDP Keşif servisi durduruldu.');
  }
}
