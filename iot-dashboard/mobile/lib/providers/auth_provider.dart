import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';

enum AuthState { unknown, loggedIn, loggedOut }

class AuthProvider extends ChangeNotifier {
  AuthState _state    = AuthState.unknown;
  String?   _username;
  String?   _role;
  String?   _errorMsg;
  bool      _loading  = false;

  AuthState get state    => _state;
  String?   get username => _username;
  String?   get role     => _role;
  String?   get errorMsg => _errorMsg;
  bool      get loading  => _loading;
  bool      get isAdmin  => _role == 'admin';

  /// Uygulama açılışında mevcut oturumu kontrol et
  Future<void> checkSession() async {
    _state = AuthState.unknown;
    notifyListeners();

    // Kaydedilmiş sunucu IP'sini AppConstants'a yükle
    await AuthService.loadSavedServerIp();

    final loggedIn = await AuthService.isLoggedIn();
    if (loggedIn) {
      _username = await AuthService.getUsername();
      _role     = await AuthService.getRole();
      _state    = AuthState.loggedIn;
    } else {
      _state = AuthState.loggedOut;
    }
    notifyListeners();
  }

  /// Giriş yap
  Future<bool> login(String username, String password) async {
    _loading  = true;
    _errorMsg = null;
    notifyListeners();

    try {
      final result = await AuthService.login(username, password);
      _loading = false;

      if (result['success'] == true) {
        _username = result['username'] as String;
        _role     = result['role']     as String;
        _state    = AuthState.loggedIn;
        notifyListeners();
        return true;
      } else {
        _errorMsg = result['error'] as String?;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _loading = false;
      _errorMsg = 'Bağlantı hatası: Sunucuya erişilemedi. Lütfen IP adresini ve Wi-Fi bağlantınızı kontrol edin.';
      notifyListeners();
      return false;
    }
  }

  /// Çıkış yap
  Future<void> logout() async {
    await AuthService.logout();
    _username = null;
    _role     = null;
    _state    = AuthState.loggedOut;
    notifyListeners();
  }

  void clearError() {
    _errorMsg = null;
    notifyListeners();
  }

  /// Sunucu IP'sini kaydet
  Future<void> setServerIp(String ip) => AuthService.setServerIp(ip);

  /// Kaydedilmiş sunucu IP'sini oku
  Future<String?> getSavedServerIp() => AuthService.getSavedServerIp();
}
