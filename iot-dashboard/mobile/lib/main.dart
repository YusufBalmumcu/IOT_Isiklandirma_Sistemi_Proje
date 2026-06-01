import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/room_provider.dart';
import 'providers/theme_provider.dart';
import 'services/websocket_service.dart';
import 'services/discovery_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Uygulama başlarken önbelleğe kaydedilmiş olan IP'yi yükle
  await DiscoveryService.loadSavedUrl();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:            Colors.transparent,
    statusBarIconBrightness:   Brightness.light,
    systemNavigationBarColor:  AppTheme.bgDark,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const IoTApp());
}

class IoTApp extends StatelessWidget {
  const IoTApp({super.key});

  @override
  Widget build(BuildContext context) {
    // WebSocketService tek instance olarak en üstte
    final wsService = WebSocketService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider.value(value: wsService),
        ChangeNotifierProvider(create: (_) => RoomProvider(wsService)),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title:        'SmartLight',
            debugShowCheckedModeBanner: false,
            theme:        AppTheme.lightTheme,
            darkTheme:    AppTheme.darkTheme,
            themeMode:    themeProvider.themeMode,
            home:         const _AppRouter(),
          );
        },
      ),
    );
  }
}

/// Oturum durumuna göre Login veya Home ekranına yönlendirir
class _AppRouter extends StatefulWidget {
  const _AppRouter();
  @override
  State<_AppRouter> createState() => _AppRouterState();
}

class _AppRouterState extends State<_AppRouter> {
  @override
  void initState() {
    super.initState();

    // Dinamik IP bulma servisini başlat
    DiscoveryService.startListening((newUrl) {
      if (mounted) {
        print('[Discovery] Ağda yeni sunucu bulundu: $newUrl. Bağlantılar yenileniyor...');
        
        // Oturum durumunu yeni IP'ye göre yeniden kontrol et
        context.read<AuthProvider>().checkSession();
        
        // Eğer kullanıcı giriş yapmışsa WebSocket bağlantısını yeni IP ile güncelle
        final auth = context.read<AuthProvider>();
        if (auth.state == AuthState.loggedIn) {
          context.read<RoomProvider>().connectWs();
          context.read<RoomProvider>().loadRooms();
        }
      }
    });

    // Oturum kontrolünü async olarak başlat
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().checkSession();
    });
  }

  @override
  void dispose() {
    DiscoveryService.stopListening();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthProvider>().state;

    switch (authState) {
      case AuthState.unknown:
        // Splash: oturum kontrol ediliyor
        return const Scaffold(
          backgroundColor: AppTheme.bgDark,
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lightbulb_rounded, color: AppTheme.accent, size: 56),
                SizedBox(height: 24),
                CircularProgressIndicator(color: AppTheme.accent, strokeWidth: 2),
                SizedBox(height: 16),
                Text('Bağlanıyor...', style: TextStyle(color: AppTheme.textSecondary)),
              ],
            ),
          ),
        );
      case AuthState.loggedIn:
        return const HomeScreen();
      case AuthState.loggedOut:
        return const LoginScreen();
    }
  }
}
