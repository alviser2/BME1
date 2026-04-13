# 📡 ESP32 Integration Guide

## Mục lục
1. [ESP32 API Endpoints](#esp32-api-endpoints)
2. [ESP32 Arduino Code](#esp32-arduino-code)

---

## ESP32 API Endpoints

### Base URL
```
https://bme1-backend.vercel.app/api
```

### 1. Register ESP32 (bật lên → đăng ký online)

**Endpoint:** `POST /api/esp32/register`

**Payload:**
```json
{
  "esp32_id": "ESP001"
}
```

**Response thành công (201):**
```json
{
  "id": "ESP001",
  "status": "online",
  "registered_at": "2026-04-13T10:00:00.000Z",
  "last_seen_at": "2026-04-13T10:00:00.000Z"
}
```

**Response lỗi (409 - đang bận):**
```json
{
  "error": "ESP32 đang bận theo dõi bag khác",
  "current_bag_id": "b1747234567",
  "status": "busy"
}
```

---

### 2. Gửi data cập nhật

**Endpoint:** `POST /api/esp32/update`

**Payload:**
```json
{
  "esp32_id": "ESP001",
  "volume": 350,
  "flow_rate": 40
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `esp32_id` | string | ID thiết bị (đã đăng ký) |
| `volume` | number | Thể tích còn lại (ml) |
| `flow_rate` | number | Tốc độ truyền (giọt/phút) |

**Response thành công:**
```json
{
  "success": true,
  "bag": {
    "id": "b1747234567",
    "esp32_id": "ESP001",
    "current_volume": 350,
    "status": "running",
    ...
  },
  "anomaly": null
}
```

**Response lỗi (403 - chưa gán vào bag):**
```json
{
  "success": false,
  "message": "ESP32 chưa được gán vào bag. Vui lòng bắt đầu truyền trước"
}
```

**Response lỗi (404 - chưa đăng ký):**
```json
{
  "success": false,
  "message": "ESP32 chưa đăng ký. Vui lòng gọi POST /api/esp32/register trước"
}
```

---

## ESP32 Arduino Code

### Yêu cầu thư viện
- `WiFi.h` (built-in)
- `HTTPClient.h` (built-in)
- `ArduinoJson.h` (cài qua Library Manager)

### Cấu hình

```cpp
// ============== CONFIG ==============
#define DEVICE_ID "ESP001"           // ID thiết bị - THAY ĐỔI CHO TỪNG ESP32
#define WIFI_SSID "YOUR_WIFI_SSID"   // Tên WiFi
#define WIFI_PASS "YOUR_WIFI_PASS"   // Mật khẩu WiFi

#define API_BASE "https://bme1-backend.vercel.app/api"
#define UPDATE_INTERVAL 5000         // 5 giây gửi 1 lần

// Cảm biến (tùy hardware)
// #define TRIG_PIN 5
// #define ECHO_PIN 18
// Thay đổi theo phần cứng của bạn
```

### Code đầy đủ

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIG ==============
#define DEVICE_ID "ESP001"
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASS "YOUR_WIFI_PASS"

#define API_BASE "https://bme1-backend.vercel.app/api"
#define UPDATE_INTERVAL 5000  // 5 giây

// Cảm biến khoảng cách (HC-SR04)
#define TRIG_PIN 5
#define ECHO_PIN 18

// Thông số chai truyền
#define BOTTLE_HEIGHT_ML 500  // Chiều cao tối đa (ml)
#define SENSOR_MAX_ML 600     // Giá trị max khi chai đầy

// ============== VARIABLES ==============
unsigned long lastUpdate = 0;
bool isRegistered = false;

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  
  // Cảm biến khoảng cách
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Kết nối WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Đăng ký ESP32 với backend
  registerESP32();
}

// ============== LOOP ==============
void loop() {
  unsigned long now = millis();
  
  if (now - lastUpdate >= UPDATE_INTERVAL) {
    lastUpdate = now;
    
    // Đọc thể tích từ cảm biến
    float volume = readVolume();
    float flowRate = calculateFlowRate();
    
    Serial.printf("Volume: %.1f ml, Flow: %.1f\n", volume, flowRate);
    
    // Gửi data lên backend
    sendData(volume, flowRate);
  }
}

// ============== FUNCTIONS ==============

// Đăng ký ESP32 với backend
void registerESP32() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(API_BASE) + "/esp32/register";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["esp32_id"] = DEVICE_ID;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode == 201) {
    Serial.println("ESP32 registered successfully!");
    isRegistered = true;
  } else if (httpCode == 409) {
    Serial.println("ESP32 already busy (OK - previous session)");
    isRegistered = true;
  } else {
    Serial.printf("Registration failed! HTTP: %d\n", httpCode);
    isRegistered = false;
  }
  
  http.end();
}

// Đọc thể tích từ cảm biến siêu âm
float readVolume() {
  // Gửi xung trigger
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Đọc echo
  long duration = pulseIn(ECHO_PIN, HIGH);
  
  // Tính khoảng cách (cm)
  float distance = duration * 0.034 / 2;
  
  // Chuyển đổi sang ml (tùy vào hình dạng chai)
  // Công thức này cần calibration theo chai thực tế
  float volume = mapDistanceToVolume(distance);
  
  return volume;
}

// Ánh xạ khoảng cách sang thể tích
float mapDistanceToVolume(float distanceCm) {
  // Giả sử chai cao 25cm, khi đầy sensor đọc 3cm
  // Khi gần empty sensor đọc 23cm
  // Điều chỉnh theo thực tế
  
  if (distanceCm < 3) distanceCm = 3;
  if (distanceCm > 23) distanceCm = 23;
  
  // Linear mapping
  float percent = (23 - distanceCm) / 20.0;  // 0 = empty, 1 = full
  float volume = percent * BOTTLE_HEIGHT_ML;
  
  return volume;
}

// Tính tốc độ truyền (giọt/phút)
// Cần lưu giá trị trước đó để tính
float previousVolume = 0;
unsigned long previousTime = 0;

float calculateFlowRate() {
  // Đây là placeholder - cần implement theo hardware thực tế
  // Ví dụ: đếm giọt bằng cảm biến IR
  return 40.0;  // Default 40 giọt/phút
}

// Gửi data lên backend
void sendData(float volume, float flowRate) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
    return;
  }
  
  if (!isRegistered) {
    Serial.println("ESP32 not registered, registering...");
    registerESP32();
    delay(100);
    if (!isRegistered) return;
  }
  
  HTTPClient http;
  String url = String(API_BASE) + "/esp32/update";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["esp32_id"] = DEVICE_ID;
  doc["volume"] = volume;
  doc["flow_rate"] = flowRate;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  Serial.printf("Sending: %s\n", requestBody.c_str());
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.printf("Update OK: %s\n", response.c_str());
  } else {
    String response = http.getString();
    Serial.printf("Update failed! HTTP: %d, Response: %s\n", httpCode, response.c_str());
    
    // Nếu bị từ chối vì chưa gán bag
    if (httpCode == 403 || httpCode == 404) {
      Serial.println("ESP32 chưa được gán vào bag trên hệ thống!");
      Serial.println("Vui lòng thêm bình truyền và chọn ESP32 này trên giao diện web.");
    }
  }
  
  http.end();
}
```

---

## Test thủ công

### Test bằng curl

```bash
# 1. Đăng ký ESP32
curl -X POST https://bme1-backend.vercel.app/api/esp32/register \
  -H "Content-Type: application/json" \
  -d '{"esp32_id": "ESP001"}'

# 2. Tạo bag và gán ESP32 (trên FE hoặc bằng API)
# POST /api/bags với esp32Id: "ESP001"

# 3. Gửi data cập nhật
curl -X POST https://bme1-backend.vercel.app/api/esp32/update \
  -H "Content-Type: application/json" \
  -d '{"esp32_id": "ESP001", "volume": 350, "flow_rate": 40}'
```

### Test bằng Postman/Thunder Client

Import cấu hình:
```
POST https://bme1-backend.vercel.app/api/esp32/register
{
  "esp32_id": "ESP001"
}

POST https://bme1-backend.vercel.app/api/esp32/update
{
  "esp32_id": "ESP001",
  "volume": 350,
  "flow_rate": 40
}
```

---

## Troubleshooting

### ESP32 không gửi được data?

1. **Kiểm tra đăng ký:**
   ```bash
   curl https://bme1-backend.vercel.app/api/esp32
   ```
   → ESP phải có status = `online` hoặc `busy`

2. **Kiểm tra đã gán vào bag:**
   - Vào giao diện web
   - Thêm bình truyền mới
   - Chọn ESP32 từ dropdown
   - Lưu

3. **Kiểm tra ESP32 trong bag:**
   ```bash
   curl https://bme1-backend.vercel.app/api/esp32/ESP001/bags
   ```

### Lỗi "ESP32 chưa đăng ký"
- ESP32 chưa gọi `POST /api/esp32/register`
- Hoặc thứ tự sai: gọi update trước khi register

### Lỗi "ESP32 chưa được gán vào bag"
- ESP32 đã register nhưng chưa được gán vào bag nào
- Vào FE → Thêm bình truyền → Chọn ESP32 → Lưu

---

## Luồng hoàn chỉnh

```
┌─────────────────────────────────────────────────────────────────┐
│                        ESP32 Flow                              │
└─────────────────────────────────────────────────────────────────┘

1. ESP32 bật nguồn
   ↓
2. Kết nối WiFi ✓
   ↓
3. Gọi POST /api/esp32/register
   → Backend trả về status = "online"
   ↓
4. Điều dưỡng thêm bag trên FE, chọn ESP32 này
   → Backend set ESP32 status = "busy"
   ↓
5. [Loop] ESP32 đọc cảm biến mỗi 5 giây
   ↓
6. Gọi POST /api/esp32/update
   → Backend cập nhật volume cho bag
   ↓
7. Kết thúc truyền (trên FE hoặc tự động)
   → Backend set ESP32 status = "online"
   ↓
8. ESP32 có thể gán giường khác
```

---

## Hardware Notes

### Cảm biến siêu âm HC-SR04
```
VCC → 5V
GND → GND
TRIG → GPIO 5
ECHO → GPIO 18
```

### Cảm biến đo mức nước (nếu dùng)
- Resistive: đo điện trở giữa các điện cực
- Capacitive: đo dung lượng (chính xác hơn)

### Đếm giọt (IR sensor)
```
  _____        _____
 |     |      |     |
 | IR  | ---- | Tube | ---- sensor đếm giọt
 |LED  |      |     |
  -----        -----
```