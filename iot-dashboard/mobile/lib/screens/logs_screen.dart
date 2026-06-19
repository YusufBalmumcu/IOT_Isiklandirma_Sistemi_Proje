import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/light_log.dart';
import '../providers/room_provider.dart';
import '../theme.dart';

class LogsScreen extends StatefulWidget {
  const LogsScreen({super.key});
  @override
  State<LogsScreen> createState() => _LogsScreenState();
}

class _LogsScreenState extends State<LogsScreen> {
  List<LightLog> _logs    = [];
  bool           _loading = true;
  String         _filter  = 'all'; // all | light | mode | auto

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await context.read<RoomProvider>().loadAllLogs(limit: 150);
      if (mounted) setState(() { _logs = result; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<LightLog> get _filtered {
    switch (_filter) {
      case 'light': return _logs.where((l) => l.action.startsWith('LIGHT')).toList();
      case 'mode':  return _logs.where((l) => l.action == 'MODE_CHANGE').toList();
      case 'auto':  return _logs.where((l) => l.triggeredBy != 'manual' && !l.triggeredBy.startsWith('user')).toList();
      default:      return _logs;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('İşlem Geçmişi'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () { _load(); }),
        ],
      ),
      body: Column(
        children: [
          // Filtre çubuğu
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _FilterChip(label: 'Tümü',    value: 'all',   selected: _filter == 'all',   onTap: () => setState(() => _filter = 'all')),
                _FilterChip(label: '💡 Işık', value: 'light', selected: _filter == 'light', onTap: () => setState(() => _filter = 'light')),
                _FilterChip(label: '⚙️ Mod',  value: 'mode',  selected: _filter == 'mode',  onTap: () => setState(() => _filter = 'mode')),
                _FilterChip(label: '🤖 Oto',  value: 'auto',  selected: _filter == 'auto',  onTap: () => setState(() => _filter = 'auto')),
              ],
            ),
          ),

          // Log sayısı
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Text('${_filtered.length} kayıt',
                    style: TextStyle(color: context.textSecondary, fontSize: 12)),
              ],
            ),
          ),

          // Liste
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.accent))
                : _filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.history_toggle_off_rounded, size: 48, color: context.textSecondary),
                            const SizedBox(height: 12),
                            Text('Kayıt bulunamadı', style: TextStyle(color: context.textSecondary)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (ctx, i) => _LogRow(log: _filtered[i]),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label, value;
  final bool   selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.value,
      required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? AppTheme.accent : context.bgCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: selected ? AppTheme.accent : context.border),
          ),
          child: Text(label, style: TextStyle(
            color: selected ? Colors.white : context.textSecondary,
            fontSize: 12, fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
          )),
        ),
      );
}

class _LogRow extends StatelessWidget {
  final LightLog log;
  const _LogRow({required this.log});

  Color get _actionColor {
    switch (log.action) {
      case 'LIGHT_ON':         return AppTheme.success;
      case 'LIGHT_OFF':        return AppTheme.danger;
      case 'MODE_CHANGE':      return AppTheme.accent;
      case 'THRESHOLD_CHANGE': return AppTheme.warning;
      default:                 return AppTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd.MM.yyyy HH:mm:ss');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Aksiyon renk çizgisi
          Container(
            width: 4, height: 56,
            decoration: BoxDecoration(
              color: _actionColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 12),

          // İçerik
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        log.actionLabel,
                        style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (log.roomName != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: context.bgSurface,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(log.roomName!,
                            style: TextStyle(color: context.textSecondary, fontSize: 10)),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(log.triggerLabel, style: TextStyle(color: context.textSecondary, fontSize: 11)),
                if (log.note != null)
                  Text(log.note!, style: TextStyle(color: context.textSecondary, fontSize: 10),
                      maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(Icons.access_time_rounded, size: 11, color: context.textSecondary),
                    const SizedBox(width: 3),
                    Text(fmt.format(log.timestamp),
                        style: TextStyle(color: context.textSecondary, fontSize: 10)),
                    if (log.ldrValue != null) ...[
                      const SizedBox(width: 10),
                      const Icon(Icons.wb_sunny_rounded, size: 11, color: AppTheme.warning),
                      const SizedBox(width: 3),
                      Text(log.ldrValue! > 2500 ? 'Karanlık' : 'Aydınlık',
                          style: TextStyle(color: context.textSecondary, fontSize: 10)),
                    ],
                    if (log.personCount != null) ...[
                      const SizedBox(width: 10),
                      const Icon(Icons.people_rounded, size: 11, color: AppTheme.accentLight),
                      const SizedBox(width: 3),
                      Text('${log.personCount} kişi',
                          style: TextStyle(color: context.textSecondary, fontSize: 10)),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
