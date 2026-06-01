/// Room modeli — backend /api/rooms yanıtıyla eşleşir
class Room {
  final int id;
  final String name;
  final String mqttCmdTopic;
  String lightMode;
  int ldrThreshold;
  int lightState;
  int personCount;
  int currentLdr;
  final String createdAt;
  String updatedAt;

  Room({
    required this.id,
    required this.name,
    required this.mqttCmdTopic,
    required this.lightMode,
    required this.ldrThreshold,
    required this.lightState,
    required this.personCount,
    required this.currentLdr,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Room.fromJson(Map<String, dynamic> json) => Room(
        id:            json['id']              as int,
        name:          json['name']            as String,
        mqttCmdTopic:  json['mqtt_cmd_topic']  as String,
        lightMode:     json['light_mode']      as String,
        ldrThreshold:  (json['ldr_threshold']  as num).toInt(),
        lightState:    (json['light_state']    as num).toInt(),
        personCount:   (json['person_count']   as num).toInt(),
        currentLdr:    (json['current_ldr']    as num).toInt(),
        createdAt:     json['created_at']      as String,
        updatedAt:     json['updated_at']      as String,
      );

  /// LDR yüzdesi (0.0 – 1.0), 4095 max ADC değeri
  double get ldrPercent => (currentLdr / 4095).clamp(0.0, 1.0);

  /// Işık açık mı?
  bool get isLightOn => lightState == 1;

  /// Odada kişi var mı?
  bool get hasPersons => personCount > 0;

  Room copyWith({
    String? lightMode,
    int? ldrThreshold,
    int? lightState,
    int? personCount,
    int? currentLdr,
    String? updatedAt,
  }) =>
      Room(
        id:           id,
        name:         name,
        mqttCmdTopic: mqttCmdTopic,
        lightMode:    lightMode    ?? this.lightMode,
        ldrThreshold: ldrThreshold ?? this.ldrThreshold,
        lightState:   lightState   ?? this.lightState,
        personCount:  personCount  ?? this.personCount,
        currentLdr:   currentLdr   ?? this.currentLdr,
        createdAt:    createdAt,
        updatedAt:    updatedAt    ?? this.updatedAt,
      );
}
