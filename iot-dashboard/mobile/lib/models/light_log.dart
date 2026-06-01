/// Işık kontrol log kaydı — /api/rooms/:id/logs yanıtıyla eşleşir
class LightLog {
  final int id;
  final int roomId;
  final String? roomName;
  final String triggeredBy;
  final String action;
  final int? newLightState;
  final String? newMode;
  final int? ldrValue;
  final int? ldrThreshold;
  final int? personCount;
  final String? note;
  final DateTime timestamp;

  LightLog({
    required this.id,
    required this.roomId,
    this.roomName,
    required this.triggeredBy,
    required this.action,
    this.newLightState,
    this.newMode,
    this.ldrValue,
    this.ldrThreshold,
    this.personCount,
    this.note,
    required this.timestamp,
  });

  factory LightLog.fromJson(Map<String, dynamic> json) => LightLog(
        id:            json['id']              as int,
        roomId:        json['room_id']         as int,
        roomName:      json['room_name']       as String?,
        triggeredBy:   json['triggered_by']    as String,
        action:        json['action']          as String,
        newLightState: json['new_light_state'] != null
            ? (json['new_light_state'] as num).toInt()
            : null,
        newMode:      json['new_mode']         as String?,
        ldrValue:     json['ldr_value'] != null
            ? (json['ldr_value'] as num).toInt()
            : null,
        ldrThreshold: json['ldr_threshold'] != null
            ? (json['ldr_threshold'] as num).toInt()
            : null,
        personCount:  json['person_count'] != null
            ? (json['person_count'] as num).toInt()
            : null,
        note:      json['note']      as String?,
        timestamp: DateTime.parse(json['timestamp'] as String).toLocal(),
      );

  /// İnsan okunabilir aksiyon etiketi
  String get actionLabel {
    switch (action) {
      case 'LIGHT_ON':       return '💡 Işık Açıldı';
      case 'LIGHT_OFF':      return '🌑 Işık Kapatıldı';
      case 'MODE_CHANGE':    return '⚙️ Mod Değiştirildi';
      case 'THRESHOLD_CHANGE': return '📊 Eşik Güncellendi';
      default:               return action;
    }
  }

  /// Kim/ne tetikledi
  String get triggerLabel {
    if (triggeredBy.startsWith('user:')) {
      return '👤 ${triggeredBy.substring(5)}';
    }
    switch (triggeredBy) {
      case 'auto':      return '🤖 Otomasyon';
      case 'half_auto': return '🤖 Yarı Otomasyon';
      default:          return triggeredBy;
    }
  }
}
