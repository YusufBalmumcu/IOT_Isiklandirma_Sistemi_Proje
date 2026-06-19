import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/room.dart';
import '../models/light_log.dart';
import '../providers/room_provider.dart';
import '../providers/auth_provider.dart';
import '../theme.dart';
import '../constants.dart';
import 'package:intl/intl.dart';

class RoomDetailScreen extends StatefulWidget {
  final int roomId;
  const RoomDetailScreen({super.key, required this.roomId});
  @override
  State<RoomDetailScreen> createState() => _RoomDetailScreenState();
}

class _RoomDetailScreenState extends State<RoomDetailScreen> {
  List<LightLog> _logs = [];
  bool _logsLoading = false;

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  Future<void> _loadLogs() async {
    setState(() => _logsLoading = true);
    final logs = await context.read<RoomProvider>().loadRoomLogs(widget.roomId, limit: 30);
    if (mounted) setState(() { _logs = logs; _logsLoading = false; });
  }


  Future<void> _setMode(String mode) async {
    try {
      await context.read<RoomProvider>().setMode(widget.roomId, mode);
      await _loadLogs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Mod değiştirildi: ${AppConstants.modeLabels[mode]}'),
          backgroundColor: AppTheme.modeColor(mode),
        ));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger));
    }
  }

  Future<void> _setLight(int state) async {
    try {
      await context.read<RoomProvider>().setLight(widget.roomId, state);
      await _loadLogs();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rp   = context.watch<RoomProvider>();
    final auth = context.watch<AuthProvider>();
    final room = rp.rooms.where((r) => r.id == widget.roomId).isNotEmpty
        ? rp.rooms.firstWhere((r) => r.id == widget.roomId)
        : null;

    if (room == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Oda')),
        body: const Center(child: CircularProgressIndicator(color: AppTheme.accent)),
      );
    }

    final modeColor = AppTheme.modeColor(room.lightMode);

    return Scaffold(
      appBar: AppBar(
        title: Text(room.name),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () async {
            await rp.loadRooms();
            await _loadLogs();
          }),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── Işık durumu ─────────────────────────────────────────────────
          _SectionCard(
            child: Column(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 500),
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: room.isLightOn ? modeColor.withOpacity(0.2) : context.bgSurface,
                    boxShadow: room.isLightOn
                        ? [BoxShadow(color: modeColor.withOpacity(0.5), blurRadius: 24, spreadRadius: 4)]
                        : null,
                  ),
                  child: Icon(
                    room.isLightOn ? Icons.lightbulb_rounded : Icons.lightbulb_outline_rounded,
                    color: room.isLightOn ? modeColor : context.textSecondary,
                    size: 40,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  room.isLightOn ? 'AÇIK' : 'KAPALI',
                  style: TextStyle(
                    color: room.isLightOn ? modeColor : context.textSecondary,
                    fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  AppConstants.modeLabels[room.lightMode] ?? room.lightMode,
                  style: TextStyle(color: modeColor, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ─── Manuel kontrol (sadece manual modda) ─────────────
          if (room.lightMode == 'manual')
            _SectionCard(
              title: '💡 Manuel Kontrol',
              child: Row(
                children: [
                  Expanded(
                    child: _ControlBtn(
                      label: 'Aç',
                      icon: Icons.lightbulb_rounded,
                      color: AppTheme.success,
                      active: room.isLightOn,
                      onTap: room.isLightOn ? null : () => _setLight(1),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ControlBtn(
                      label: 'Kapat',
                      icon: Icons.lightbulb_outline_rounded,
                      color: AppTheme.danger,
                      active: !room.isLightOn,
                      onTap: !room.isLightOn ? null : () => _setLight(0),
                    ),
                  ),
                ],
              ),
            ),
          if (room.lightMode == 'manual') const SizedBox(height: 12),

          // ─── Mod seçimi ───────────────────────────────────────────────────
          _SectionCard(
            title: '⚙️ Mod Seçimi',
            child: Column(
              children: AppConstants.modeLabels.entries.map((e) {
                final isSelected = room.lightMode == e.key;
                final c = AppTheme.modeColor(e.key);
                final desc = AppConstants.modeDescriptions[e.key] ?? '';
                return GestureDetector(
                  onTap: () => _setMode(e.key),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isSelected ? c.withOpacity(0.15) : context.bgSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? c : context.border,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(AppTheme.modeIcon(e.key), color: c, size: 22),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(e.value, style: TextStyle(
                                  color: isSelected ? c : context.textPrimary,
                                  fontWeight: FontWeight.w600, fontSize: 14)),
                              Text(desc, style: TextStyle(color: context.textSecondary, fontSize: 11)),
                            ],
                          ),
                        ),
                        if (isSelected) Icon(Icons.check_circle_rounded, color: c, size: 20),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),

          // ─── Sensör bilgileri ─────────────────────────────────────────────
          _SectionCard(
            title: '📡 Sensör Durumu',
            child: Row(
              children: [
                Expanded(child: _SensorTile(
                  icon: Icons.wb_sunny_rounded, color: AppTheme.warning,
                  label: 'Ortam Işığı',
                  // ESP32 analogRead: 0-4095. karanlikLimit=2500 (hareketsensordemo.ino)
                  // ldr > 2500 → Karanlık, ldr <= 2500 → Aydınlık
                  value: room.currentLdr > 2500 ? 'Karanlık' : 'Aydınlık',
                  sub: 'LDR: ${room.currentLdr}',
                )),
                Container(width: 1, height: 60, color: context.border),
                Expanded(child: _SensorTile(
                  icon: Icons.people_rounded, color: AppTheme.accentLight,
                  label: 'Odadaki Kişi', value: '${room.personCount}',
                  sub: room.hasPersons ? 'Aktif' : 'Boş oda',
                )),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ─── Son loglar ───────────────────────────────────────────────────
          _SectionCard(
            title: '📋 Son İşlemler',
            child: _logsLoading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.accent))
                : _logs.isEmpty
                    ? Text('Henüz işlem yok', style: TextStyle(color: context.textSecondary))
                    : Column(
                        children: _logs.take(10).map((l) => _LogTile(log: l)).toList(),
                      ),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

// ─── Yardımcı widget'lar ──────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final String? title;
  final Widget  child;
  const _SectionCard({this.title, required this.child});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Text(title!, style: TextStyle(color: context.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      );
}

class _ControlBtn extends StatelessWidget {
  final String  label;
  final IconData icon;
  final Color   color;
  final bool    active;
  final VoidCallback? onTap;
  const _ControlBtn({required this.label, required this.icon, required this.color,
      required this.active, this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: active ? color.withOpacity(0.2) : context.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? color : context.border, width: active ? 2 : 1),
          ),
          child: Column(
            children: [
              Icon(icon, color: active ? color : context.textSecondary, size: 28),
              const SizedBox(height: 6),
              Text(label, style: TextStyle(
                  color: active ? color : context.textSecondary, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );
}

class _SensorTile extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   label, value, sub;
  const _SensorTile({required this.icon, required this.color,
      required this.label, required this.value, required this.sub});

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(color: context.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          Text(label, style: TextStyle(color: context.textSecondary, fontSize: 11), textAlign: TextAlign.center),
          Text(sub, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      );
}

class _LogTile extends StatelessWidget {
  final LightLog log;
  const _LogTile({required this.log});

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd.MM HH:mm');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: context.bgSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.flash_on_rounded, color: AppTheme.accentLight, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(log.actionLabel, style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
                Text(log.triggerLabel, style: TextStyle(color: context.textSecondary, fontSize: 11)),
                if (log.note != null)
                  Text(log.note!, style: TextStyle(color: context.textSecondary, fontSize: 10)),
              ],
            ),
          ),
          Text(fmt.format(log.timestamp),
              style: TextStyle(color: context.textSecondary, fontSize: 10)),
        ],
      ),
    );
  }
}
