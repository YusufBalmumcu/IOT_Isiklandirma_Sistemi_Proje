import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../constants.dart';

/// JWT kimlik doğrulama servisi
class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey    = 'jwt_token';
  static const _usernameKey  = 'username';
  static const _roleKey      = 'role';
  static const _serverIpKey  = 'server_ip';

  /// Sunucu IP'sini kaydet ve AppConstants.baseUrl'yi anında güncelle
  static Future<void> setServerIp(String ip) async {
    await _storage.write(key: _serverIpKey, value: ip);
    AppConstants.baseUrl = 'http://$ip:3001';
  }

  /// Kaydedilmiş sunucu IP'sini oku (sadece IP kısmı)
  static Future<String?> getSavedServerIp() async {
    return _storage.read(key: _serverIpKey);
  }

  /// Uygulama açılışında kaydedilmiş IP'yi AppConstants'a yükle
  static Future<void> loadSavedServerIp() async {
    final ip = await getSavedServerIp();
    if (ip != null && ip.isNotEmpty) {
      AppConstants.baseUrl = 'http://$ip:3001';
    }
  }

  /// Token'ı güvenli depodan oku
  static Future<String?> getToken() => _storage.read(key: _tokenKey);

  /// Oturum bilgilerini oku
  static Future<String?> getUsername() => _storage.read(key: _usernameKey);
  static Future<String?> getRole()     => _storage.read(key: _roleKey);

  /// Login — başarılıysa token ve kullanıcı bilgisi döner
  static Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http
        .post(
          Uri.parse(AppConstants.loginUrl),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'username': username, 'password': password}),
        )
        .timeout(const Duration(seconds: 10));

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      // Token ve kullanıcı bilgisini kaydet
      await _storage.write(key: _tokenKey,    value: body['token']    as String);
      await _storage.write(key: _usernameKey, value: body['username'] as String);
      await _storage.write(key: _roleKey,     value: body['role']     as String);
      return {'success': true, ...body};
    } else {
      return {'success': false, 'error': body['error'] ?? 'Giriş başarısız'};
    }
  }

  /// Çıkış — token'ı sil
  static Future<void> logout() async {
    await _storage.deleteAll();
  }

  /// Token var mı ve geçerli mi?
  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    if (token == null) return false;
    try {
      final response = await http.get(
        Uri.parse(AppConstants.meUrl),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Authorization header döner
  static Future<Map<String, String>> authHeader() async {
    final token = await getToken();
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ${token ?? ''}',
    };
  }
}
