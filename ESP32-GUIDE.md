# 📡 ESP32 Integration Guide

## ESP32 chỉ cần gọi 2 API

### Base URL
```
https://bme1-backend.vercel.app/api
```

---

## API 1 — Đăng ký khi bật nguồn

**Gọi 1 lần duy nhất trong `setup()`**

```
POST /api/esp32/register
Content-Type: application/json

{ "esp32_id": "ESP001" }
```

| Response | Code | Ý nghĩa | Làm gì tiếp |
|----------|------|---------|------------|
| Thành công | 201 | Online, chờ nurse gán bag | Chờ, tiếp tục loop |
| Đang bận | 409 | Session cũ chưa kết thúc | Tiếp tục gửi update bình thường |

```json
// 201 - online
{ "id": "ESP001", "status": "online", "registered_at": "...", "last_seen_at": "..." }

// 409 - busy
{ "error": "ESP32 đang bận theo dõi bag khác", "current_bag_id": "b174...", "status": "busy" }
```

---

## API 2 — Gửi data mỗi 5 giây

**Gọi liên tục trong `loop()`**

```
POST /api/esp32/update
Content-Type: application/json

{
  "esp32_id":  "ESP001",
  "volume":    350.5,
  "flow_rate": 40.0
}
```

| Field | Kiểu | Đơn vị | Nguồn |
|-------|------|--------|-------|
| `esp32_id` | string | — | Hardcode trong firmware |
| `volume` | float | ml còn lại | Cảm biến siêu âm / load cell |
| `flow_rate` | float | giọt/phút | Cảm biến đếm giọt IR |

**ESP32 không cần biết bag_id hay patient_id — server tự tra từ esp32_id.**

### Responses

```json
// 200 - thành công
{ "success": true, "bag": { ... }, "anomaly": null }
{ "success": true, "bag": { ... }, "anomaly": "FAST_DRAIN" }

// 404 - chưa đăng ký
{ "success": false, "message": "ESP32 chưa đăng ký. Vui lòng gọi POST /api/esp32/register trước" }

// 403 - chưa được gán vào bag
{ "success": false, "message": "ESP32 chưa được gán vào bag. Vui lòng bắt đầu truyền trước" }
```

Khi nhận `404` → gọi lại `/register`.  
Khi nhận `403` → chờ, nurse chưa tạo bag trên dashboard.

---

## Server tự xử lý sau khi nhận update

```
Nhận { esp32_id, volume, flow_rate }
  ├── Tìm bag đang gắn với esp32_id này
  ├── UPDATE iv_bags: current_volume, flow_rate, status, anomaly
  ├── INSERT bag_logs: ghi 1 dòng lịch sử (dùng để vẽ chart)
  ├── Nếu volume <= 0 → status = 'empty'
  └── Kiểm tra FAST_DRAIN:
        expected = (flow_rate / 20 / 60) × 5  (ml đáng giảm trong 5s)
        actual   = current_volume - volume_mới
        Nếu actual > expected×3 VÀ actual > 10ml → anomaly = 'FAST_DRAIN'
```

---

## Vòng đời ESP32

```
Bật nguồn
  └─► Kết nối WiFi
        └─► POST /register
              ├─ 201 online → chờ nurse gán bag trên dashboard
              └─ 409 busy  → tiếp tục loop bình thường
                    └─► Mỗi 5s: POST /update { volume, flow_rate }
                          ├─ 200 → OK
                          ├─ 403 → chưa có bag, chờ
                          └─ 404 → mất đăng ký, gọi /register lại
```

---

## Arduino Code

### Yêu cầu thư viện
- `WiFi.h` (built-in)
- `HTTPClient.h` (built-in)
- `ArduinoJson.h` (cài qua Library Manager)

### Config
```cpp
#define DEVICE_ID   "ESP001"                              // Đổi cho từng thiết bị
#define WIFI_SSID   "YOUR_WIFI"
#define WIFI_PASS   "YOUR_PASS"
#define API_BASE    "https://bme1-backend.vercel.app/api"
#define INTERVAL_MS 5000
```

### Code đầy đủ
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define DEVICE_ID   "ESP001"
#define WIFI_SSID   "YOUR_WIFI"
#define WIFI_PASS   "YOUR_PASS"
#define API_BASE    "https://bme1-backend.vercel.app/api"
#define INTERVAL_MS 5000

// Cảm biến siêu âm HC-SR04
#define TRIG_PIN 5
#define ECHO_PIN 18

unsigned long lastUpdate = 0;
bool isRegistered = false;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi OK");

  registerESP32();
}

void loop() {
  if (millis() - lastUpdate >= INTERVAL_MS) {
    lastUpdate = millis();
    float volume    = readVolume();    // ml
    float flow_rate = readFlowRate();  // giọt/phút
    sendUpdate(volume, flow_rate);
  }
}

void registerESP32() {
  HTTPClient http;
  http.begin(String(API_BASE) + "/esp32/register");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["esp32_id"] = DEVICE_ID;
  String body; serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 201) { Serial.println("Registered OK"); isRegistered = true; }
  else if (code == 409) { Serial.println("Already busy, resuming"); isRegistered = true; }
  else { Serial.printf("Register failed: %d\n", code); }
  http.end();
}

float readVolume() {
  // HC-SR04
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  float distance = pulseIn(ECHO_PIN, HIGH) * 0.034 / 2;  // cm

  // Calibrate theo chai thực tế
  // Ví dụ: 3cm = đầy 500ml, 23cm = rỗng
  float percent = constrain((23.0 - distance) / 20.0, 0.0, 1.0);
  return percent * 500.0;
}

float readFlowRate() {
  // TODO: implement đếm giọt bằng IR sensor
  return 40.0;  // placeholder
}

void sendUpdate(float volume, float flow_rate) {
  if (!isRegistered) { registerESP32(); return; }

  HTTPClient http;
  http.begin(String(API_BASE) + "/esp32/update");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["esp32_id"]  = DEVICE_ID;
  doc["volume"]    = volume;
  doc["flow_rate"] = flow_rate;
  String body; serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200)      { Serial.printf("OK vol=%.1f fr=%.1f\n", volume, flow_rate); }
  else if (code == 403) { Serial.println("Not assigned to bag yet"); }
  else if (code == 404) { Serial.println("Not registered, re-registering..."); isRegistered = false; }
  else                  { Serial.printf("Error %d\n", code); }
  http.end();
}
```

---

## Hardware

### HC-SR04 (cảm biến siêu âm)
```
VCC  → 5V
GND  → GND
TRIG → GPIO 5
ECHO → GPIO 18
```

### Calibration `readVolume()`
Đo khoảng cách từ sensor xuống mặt dịch:
- Chai đầy → sensor đọc **X cm** (nhỏ)
- Chai rỗng → sensor đọc **Y cm** (lớn)

```cpp
float percent = constrain((Y - distance) / (Y - X), 0.0, 1.0);
float volume  = percent * INITIAL_VOLUME_ML;
```

---

## Test bằng curl

```bash
# 1. Đăng ký
curl -X POST https://bme1-backend.vercel.app/api/esp32/register \
  -H "Content-Type: application/json" \
  -d '{"esp32_id":"TEST001"}'

# 2. Gửi data (sau khi đã tạo bag trên dashboard và gán TEST001)
curl -X POST https://bme1-backend.vercel.app/api/esp32/update \
  -H "Content-Type: application/json" \
  -d '{"esp32_id":"TEST001","volume":350,"flow_rate":40}'

# 3. Kiểm tra thiết bị
curl https://bme1-backend.vercel.app/api/esp32
```
