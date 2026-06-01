import 'package:flutter_test/flutter_test.dart';
import 'package:iot_mobile/main.dart';

void main() {
  testWidgets('App starts without error', (WidgetTester tester) async {
    await tester.pumpWidget(const IoTApp());
    expect(find.byType(IoTApp), findsOneWidget);
  });
}
