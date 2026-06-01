import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/room.dart';
import '../providers/auth_provider.dart';
import '../providers/room_provider.dart';
import '../services/websocket_service.dart';
import '../theme.dart';
import '../constants.dart';
import '../providers/theme_provider.dart';
import 'room_detail_screen.dart';
import 'logs_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final rp = context.read<RoomProvider>();
      rp.connectWs();
      rp.loadRooms();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final rp   = context.watch<RoomProvider>();
    final ws   = context.watch<WebSocketService>();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('IoT Dashboard'),
            Text('Hoşgeldin, ${auth.username ?? ''}',
                style: TextStyle(fontSize: 12, color: context.textSecondary, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              context.watch<ThemeProvider>().isDarkMode
                  ? Icons.light_mode_rounded
                  : Icons.dark_mode_rounded,
            ),
            onPressed: () => context.read<ThemeProvider>().toggleTheme(),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
            child: Container(
              width: 10, height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ws.connected ? AppTheme.success : AppTheme.danger,
                boxShadow: ws.connected
                    ? [BoxShadow(color: AppTheme.success.withOpacity(0.5), blurRadius: 6)]
                    : null,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.history_rounded),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LogsScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: rp.loadRooms,
        color: AppTheme.accent,
        backgroundColor: context.bgCard,
        child: rp.loading && rp.rooms.isEmpty
            ? const Center(child: CircularProgressIndicator(color: AppTheme.accent))
            : rp.rooms.isEmpty
                ? _buildEmpty()
                : _buildContent(rp, ws),
      ),
      floatingActionButton: auth.isAdmin
          ? FloatingActionButton.extended(
              onPressed: () => _showAddRoomDialog(context),
              backgroundColor: AppTheme.accent,
              icon: const Icon(Icons.add_home_rounded),
              label: const Text('Oda Ekle'),
            )
          : null,
    );
  }

  Widget _buildContent(RoomProvider rp, WebSocketService ws) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _GlobalStatusCard(ws: ws),
        const SizedBox(height: 16),
        ...rp.rooms.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _RoomCard(room: r),
            )),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.meeting_room_outlined, size: 64, color: context.textSecondary),
          const SizedBox(height: 16),
          Text('Henüz oda yok', style: TextStyle(color: context.textSecondary, fontSize: 16)),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: context.read<RoomProvider>().loadRooms,
            icon: const Icon(Icons.refresh),
            label: const Text('Yenile'),
          ),
        ],
      ),
    );
  }

  void _showAddRoomDialog(BuildContext context) {
    final nameCtrl  = TextEditingController();
    final topicCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Yeni Oda', style: TextStyle(color: context.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: TextStyle(color: context.textPrimary),
              decoration: const InputDecoration(labelText: 'Oda Adı'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: topicCtrl,
              style: TextStyle(color: context.textPrimary),
              decoration: const InputDecoration(labelText: 'MQTT Topic'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('İptal', style: TextStyle(color: context.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<RoomProvider>().loadRooms();
            },
            child: const Text('Ekle'),
          ),
        ],
      ),
    );
  }
}

class _GlobalStatusCard extends StatelessWidget {
  final WebSocketService ws;
  const _GlobalStatusCard({required this.ws});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.border),
      ),
      child: Row(
        children: [
          Expanded(child: _Stat(icon: Icons.wb_sunny_rounded, color: AppTheme.warning,
              label: 'LDR', value: ws.globalLdr == 1 ? 'Karanlık' : 'Aydınlık')),
          Container(width: 1, height: 40, color: context.border),
          Expanded(child: _Stat(icon: Icons.people_rounded, color: AppTheme.accentLight,
              label: 'Kişi', value: '${ws.personCount}')),
          Container(width: 1, height: 40, color: context.border),
          Expanded(child: _Stat(
              icon: ws.mqttOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
              color: ws.mqttOnline ? AppTheme.success : AppTheme.danger,
              label: 'MQTT', value: ws.mqttOnline ? 'Online' : 'Offline')),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label, value;
  const _Stat({required this.icon, required this.color, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(color: context.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
          Text(label, style: TextStyle(color: context.textSecondary, fontSize: 10)),
        ],
      );
}

class _RoomCard extends StatelessWidget {
  final Room room;
  const _RoomCard({required this.room});

  @override
  Widget build(BuildContext context) {
    final modeColor = AppTheme.modeColor(room.lightMode);
    final modeLabel = AppConstants.modeLabels[room.lightMode] ?? room.lightMode;

    return GestureDetector(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => RoomDetailScreen(roomId: room.id))),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: room.isLightOn ? modeColor.withOpacity(0.6) : context.border,
            width: room.isLightOn ? 2 : 1,
          ),
          boxShadow: room.isLightOn
              ? [BoxShadow(color: modeColor.withOpacity(0.12), blurRadius: 20)]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(room.name,
                      style: TextStyle(color: context.textPrimary, fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 400),
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: room.isLightOn ? modeColor.withOpacity(0.2) : context.bgSurface,
                    boxShadow: room.isLightOn
                        ? [BoxShadow(color: modeColor.withOpacity(0.4), blurRadius: 12)]
                        : null,
                  ),
                  child: Icon(
                    room.isLightOn ? Icons.lightbulb_rounded : Icons.lightbulb_outline_rounded,
                    color: room.isLightOn ? modeColor : context.textSecondary,
                    size: 22,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: modeColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(AppTheme.modeIcon(room.lightMode), color: modeColor, size: 12),
                      const SizedBox(width: 4),
                      Text(modeLabel, style: TextStyle(color: modeColor, fontSize: 11, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const Spacer(),
                Icon(Icons.wb_sunny_rounded, color: AppTheme.warning, size: 14),
                const SizedBox(width: 4),
                Text(room.currentLdr == 1 ? 'Karanlık' : 'Aydınlık', style: TextStyle(color: context.textSecondary, fontSize: 12)),
                const SizedBox(width: 12),
                Icon(Icons.people_rounded, color: AppTheme.accentLight, size: 14),
                const SizedBox(width: 4),
                Text('${room.personCount}', style: TextStyle(color: context.textSecondary, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('Detay için dokun', style: TextStyle(color: context.textSecondary, fontSize: 11)),
                Icon(Icons.chevron_right, color: context.textSecondary, size: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
