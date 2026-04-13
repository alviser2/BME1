# BME1 - IV Bag Monitoring System

Hệ thống IoT theo dõi truyền dịch bệnh viện. ESP32 đo thể tích và tốc độ truyền, gửi lên server mỗi 5 giây, dashboard React hiển thị real-time.

---

## Cấu trúc dự án

```
BME1/
├── FE/                         # React 18 + Vite + TypeScript
│   └── src/app/
│       ├── components/         # Esp32Card, BagCard, các modal
│       ├── pages/              # Dashboard, PatientDetails, Reports...
│       ├── context/            # IVBagContext.tsx — toàn bộ state + API calls
│       ├── types.ts            # Interface TypeScript
│       └── lib/utils.ts        # Hàm tính volume/time
│
├── BE/
│   ├── api/index.js            # Vercel serverless handler (PRODUCTION dùng cái này)
│   ├── src/                    # Express server (LOCAL DEV dùng cái này)
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── index.js
│   └── schema-neon.sql         # Schema duy nhất cần dùng cho Neon (production)
│
├── README.md
├── CLAUDE.md                   # Quy tắc code cho AI
├── DEPLOY.md                   # Hướng dẫn deploy Vercel + Neon
├── ESP32-GUIDE.md              # API + Arduino code cho ESP32
└── DOCUMENTATION.md            # Tài liệu kỹ thuật đầy đủ
```

---

## Chạy local

```bash
npm run install:all   # cài FE + BE

# Terminal 1
npm run dev:be        # http://localhost:3001

# Terminal 2
npm run dev:fe        # http://localhost:5173
```

**MySQL local** — tạo DB rồi chạy schema:
```bash
mysql -u root -p -e "CREATE DATABASE bme1_db;"
# không còn schema-mysql.sql, dùng tạm schema-neon.sql với MySQL compatible syntax
```

`.env` trong `BE/`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=bme1_db
PORT=3001
```

---

## Database — chỉ dùng `schema-neon.sql`

Chạy 1 lần trên Neon:
```bash
psql "postgresql://user:pass@ep-xxx.neon.tech/bme1" -f BE/schema-neon.sql
```

Hoặc copy paste vào SQL Editor trên Neon Dashboard.

### Các bảng

| Bảng | Mục đích |
|------|---------|
| `patients` | Thông tin bệnh nhân |
| `iv_bags` | Trạng thái hiện tại của từng bình truyền |
| `bag_logs` | Lịch sử time-series để vẽ chart |
| `esp32_devices` | Registry thiết bị ESP32 |
| `reported_machines` | Thiết bị cần bảo trì |

### Quan hệ giữa `iv_bags` và `bag_logs`

- `iv_bags`: **1 dòng / bag** — luôn là snapshot mới nhất (current_volume, flow_rate bị overwrite mỗi 5s)
- `bag_logs`: **N dòng / bag** — mỗi lần ESP32 gửi data thì append 1 dòng → dùng để vẽ chart

```
ESP32 gửi { volume, flow_rate }
    ├── UPDATE iv_bags  → ghi đè current_volume + flow_rate
    └── INSERT bag_logs → append dòng mới với time + volume + flow_rate
```

### `flow_rate` trong `iv_bags`

`iv_bags.flow_rate` **bị ghi đè** mỗi 5 giây bởi giá trị ESP32 gửi lên — không phải tốc độ y lệnh ban đầu.
Tốc độ nurse nhập lúc tạo bag chỉ dùng để tính thời gian còn lại ban đầu, sau đó bị replace.

### `bag_logs.time`

Chỉ có 1 cột thời gian duy nhất là `time` (DEFAULT CURRENT_TIMESTAMP). Không có `created_at` trong schema hiện tại. FE đọc `h.time ?? h.created_at` để tương thích cả schema cũ.

### ID generation

| Entity | Format | Ví dụ |
|--------|--------|-------|
| Patient | `p` + timestamp ms | `p1744556823142` |
| Bag | `b` + timestamp ms | `b1744556901337` |
| ESP32 | Do firmware đặt | `ESP001` |
| bag_logs | SERIAL tự tăng | `1`, `2`, `3`... |

---

## API Endpoints

Base URL production: `https://bme1-backend.vercel.app/api`

### Bags
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/bags` | Bags đang active (không completed) |
| GET | `/bags/all` | Tất cả bags kể cả completed |
| GET | `/bags/:id/history` | Log entries để vẽ chart |
| POST | `/bags` | Tạo bag mới |
| PUT | `/bags/:id/status` | Đổi status (running/stopped/empty/completed) |
| DELETE | `/bags/:id` | Xóa bag, tự giải phóng ESP32 |

### Patients
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/patients` | Danh sách bệnh nhân |
| POST | `/patients` | Tạo bệnh nhân (`name`, `room`, `bed`, `age?`, `condition?`) |
| PUT | `/patients/:id` | Cập nhật |
| DELETE | `/patients/:id` | Xóa |

### ESP32
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/esp32` | Tất cả thiết bị |
| GET | `/esp32/available` | Chỉ thiết bị `online` (rảnh) |
| POST | `/esp32/register` | Đăng ký online — gọi khi bật nguồn |
| POST | `/esp32/update` | Gửi data mỗi 5s — body: `{esp32_id, volume, flow_rate}` |

### Machines
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/machines/reported` | Thiết bị đang chờ sửa |
| POST | `/machines/report` | Báo lỗi thiết bị |
| PUT | `/machines/:esp32Id/resolve` | Đánh dấu đã sửa xong |

---

## ESP32 — chỉ cần 2 API

**1. Lúc bật nguồn (1 lần):**
```json
POST /api/esp32/register
{ "esp32_id": "ESP001" }
```
- `201` → online, chờ nurse gán bag
- `409` → đang busy (session cũ), tiếp tục gửi update bình thường

**2. Mỗi 5 giây:**
```json
POST /api/esp32/update
{ "esp32_id": "ESP001", "volume": 350, "flow_rate": 40 }
```
- `volume`: ml còn lại (từ cảm biến)
- `flow_rate`: giọt/phút (từ cảm biến đếm giọt)
- Server tự tìm bag, update, ghi log, check anomaly

---

## Cảnh báo (Alert)

Có 2 loại hoàn toàn khác nhau:

### 🔴 FAST_DRAIN (đỏ) — phát hiện ở BE
So sánh **volume thực tế giảm được trong 5s** với **volume đáng lẽ giảm theo flow_rate hiện tại**:
```
expected = (iv_bags.flow_rate / 20 / 60) × 5   (ml)
actual   = iv_bags.current_volume - volume_mới

Nếu actual > expected × 3  VÀ  actual > 10ml → FAST_DRAIN
```
→ Card viền đỏ, nút "Tạm dừng" → chuyển thiết bị sang bảo trì

### 🟠 Warning (cam) — tính ở FE
```
currentVolume <= 50ml  HOẶC  timeRemaining <= 15 phút
```
→ Card viền cam, không liên quan đến flow_rate

---

## Tech Stack

| Layer | Công nghệ |
|-------|----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Chart.js, React Router v7, shadcn/ui |
| Backend (local) | Node.js, Express, mysql2 |
| Backend (production) | Vercel Serverless, @neondatabase/serverless |
| Database (local) | MySQL 8+ |
| Database (production) | Neon PostgreSQL |
| IoT | ESP32, Arduino, ArduinoJson, HTTPClient |
