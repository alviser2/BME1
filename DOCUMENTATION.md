# BME1 – Tài liệu kỹ thuật đầy đủ

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc](#2-kiến-trúc)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [Backend](#6-backend)
7. [Frontend](#7-frontend)
8. [API Reference](#8-api-reference)
9. [ESP32 Integration](#9-esp32-integration)
10. [Business Logic & Workflows](#10-business-logic--workflows)
11. [Anomaly Detection](#11-anomaly-detection)
12. [Deploy](#12-deploy)
13. [Local Dev Setup](#13-local-dev-setup)
14. [Known Issues](#14-known-issues)

---

## 1. Tổng quan

BME1 là hệ thống IoT theo dõi truyền dịch (IV bag) bệnh viện real-time. ESP32 gắn vào giá truyền dịch, đo thể tích còn lại và tốc độ truyền, gửi lên server mỗi 5 giây. Y tá theo dõi tất cả bệnh nhân từ dashboard web, nhận cảnh báo bất thường và quản lý bảo trì thiết bị.

**Chức năng chính:**
- Theo dõi volume + flow rate real-time qua ESP32
- Dashboard đa bệnh nhân / đa thiết bị
- Phát hiện anomaly tự động (FAST_DRAIN)
- Cảnh báo sắp hết dịch (< 50ml hoặc < 15 phút)
- Vòng đời thiết bị: đăng ký → gán → theo dõi → hoàn thành → giải phóng
- Chart lịch sử từng bình truyền
- Quy trình báo lỗi → bảo trì → sửa xong
- CRUD đầy đủ bệnh nhân và bình truyền

---

## 2. Kiến trúc

```
┌─────────────────────────────────────────────────────┐
│                    Vercel Cloud                     │
│  ┌──────────────────┐   ┌─────────────────────────┐ │
│  │  FE (React/Vite) │◄─►│  BE (Serverless)        │ │
│  │  bme1-fe.vercel  │   │  bme1-backend.vercel    │ │
│  └──────────────────┘   └────────────┬────────────┘ │
└───────────────────────────────────────┼─────────────┘
                                        │
                          ┌─────────────▼──────────┐
                          │   Neon PostgreSQL       │
                          └────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  ESP32 Devices                                      │
│  POST /api/esp32/register  (1 lần khi bật nguồn)   │
│  POST /api/esp32/update    (mỗi 5 giây)            │
└─────────────────────────────────────────────────────┘
```

**Luồng dữ liệu:**
1. ESP32 bật → `POST /api/esp32/register` → status = `online`
2. Y tá mở FE → nhấn "Thêm bình truyền" → chọn bệnh nhân + ESP32 + thông tin dịch
3. `POST /api/bags` → bag tạo với `status='running'`, ESP32 chuyển sang `busy`
4. ESP32 gửi `{ volume, flow_rate }` mỗi 5s → `POST /api/esp32/update`
5. BE cập nhật `iv_bags`, ghi `bag_logs`, kiểm tra anomaly
6. FE poll `GET /api/bags/all` + `GET /api/esp32` mỗi 5s → re-render cards
7. Kết thúc → y tá nhấn "Kết thúc" → bag = `completed`, ESP32 = `online`

---

## 3. Cấu trúc thư mục

```
BME1/
├── BE/
│   ├── api/
│   │   ├── index.js          # ★ Vercel serverless handler (PRODUCTION)
│   │   └── _lib/db.js        # Neon PostgreSQL client
│   ├── src/                  # Express server (LOCAL DEV)
│   │   ├── index.js          # Entry point
│   │   ├── routes/index.js   # Route declarations
│   │   ├── controllers/      # bagController, esp32Controller, patientController, machineController
│   │   ├── models/           # bagModel, esp32DeviceModel, patientModel, machineModel
│   │   └── db/mysql.js       # MySQL connection pool
│   ├── schema-neon.sql       # ★ Schema duy nhất dùng cho production Neon
│   ├── vercel.json
│   └── package.json
│
├── FE/
│   ├── src/
│   │   ├── main.tsx
│   │   └── app/
│   │       ├── App.tsx
│   │       ├── routes.tsx
│   │       ├── types.ts                    # Interface TypeScript
│   │       ├── context/IVBagContext.tsx    # ★ Toàn bộ state + API calls
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx           # View chính
│   │       │   ├── PatientDetails.tsx      # Chart + lịch sử bệnh nhân
│   │       │   ├── Patients.tsx
│   │       │   ├── History.tsx
│   │       │   ├── Reports.tsx             # Thiết bị bảo trì
│   │       │   └── Login.tsx              # UI only, chưa có auth
│   │       ├── components/
│   │       │   ├── Esp32Card.tsx           # Card chính trên Dashboard
│   │       │   ├── BagCard.tsx
│   │       │   ├── Layout.tsx
│   │       │   ├── AddDeviceModal.tsx
│   │       │   ├── AddBagModal.tsx         # ★ Form thêm bình truyền + bệnh nhân + ESP32
│   │       │   ├── AssignPatientModal.tsx  # Còn file nhưng không dùng từ Dashboard nữa
│   │       │   ├── EditPatientModal.tsx
│   │       │   └── ui/                    # shadcn/ui components
│   │       └── lib/utils.ts               # cn(), tính volume/time
│   ├── .env.development
│   ├── .env.production
│   ├── vercel.json
│   └── package.json
│
├── README.md           # Tổng quan + quick start
├── CLAUDE.md           # Hướng dẫn cho AI — đọc trước khi code
├── DEPLOY.md           # Hướng dẫn deploy Vercel + Neon
├── ESP32-GUIDE.md      # API + Arduino code cho ESP32
└── DOCUMENTATION.md    # File này
```

> **Lưu ý quan trọng:** Có 2 backend song song. `BE/src/` dùng cho local dev (MySQL), `BE/api/index.js` dùng cho production (Neon). Khi sửa business logic phải sửa **cả hai**.

---

## 4. Tech Stack

| Layer | Công nghệ |
|-------|----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router v7, Chart.js (react-chartjs-2), shadcn/ui, Lucide React, Sonner |
| Backend local | Node.js, Express, mysql2/promise |
| Backend production | Vercel Serverless Functions, @neondatabase/serverless |
| Database local | MySQL 8+ |
| Database production | Neon (serverless PostgreSQL) |
| IoT | ESP32, Arduino IDE, WiFi.h, HTTPClient.h, ArduinoJson |
| Deploy | Vercel (FE + BE), Neon (DB) |

---

## 5. Database Schema

**Chỉ dùng `BE/schema-neon.sql`** cho production. Chạy 1 lần trên Neon:
```bash
psql "postgresql://user:pass@ep-xxx.neon.tech/bme1" -f BE/schema-neon.sql
```

### Bảng `patients`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | VARCHAR(50) PK | Format: `p{timestamp_ms}` |
| `name` | VARCHAR(255) NOT NULL | |
| `room` | VARCHAR(50) | Phòng |
| `bed` | VARCHAR(20) | Giường |
| `age` | INTEGER | |
| `condition` | VARCHAR(255) | Bệnh lý |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto |

### Bảng `iv_bags`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | VARCHAR(50) PK | Format: `b{timestamp_ms}` |
| `patient_id` | VARCHAR(50) FK → patients | ON DELETE SET NULL |
| `esp32_id` | VARCHAR(100) | Thiết bị đang gắn |
| `type` | VARCHAR(100) NOT NULL | Loại dịch truyền |
| `initial_volume` | DECIMAL(10,2) | Thể tích ban đầu khi tạo bag (ml) — không thay đổi |
| `current_volume` | DECIMAL(10,2) | Thể tích hiện tại — bị overwrite mỗi 5s bởi ESP32 |
| `flow_rate` | DECIMAL(10,4) | Tốc độ (giọt/phút) — bị overwrite mỗi 5s bởi ESP32 |
| `status` | VARCHAR(20) | `running` / `stopped` / `empty` / `completed` |
| `anomaly` | VARCHAR(50) | `FAST_DRAIN` hoặc NULL |
| `empty_timestamp` | TIMESTAMP NULL | Lúc volume về 0 |
| `start_time` | TIMESTAMP | Lúc tạo bag |
| `updated_at` | TIMESTAMP | Lần update cuối |

**Về `flow_rate`:** cột này bị ghi đè mỗi 5 giây bởi giá trị ESP32 gửi lên. Tốc độ y tá nhập ban đầu chỉ dùng cho log đầu tiên, sau đó bị replace. Không lưu tốc độ y lệnh gốc riêng.

### Bảng `bag_logs` — lịch sử time-series

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | SERIAL PK | Tự tăng |
| `bag_id` | VARCHAR(50) FK → iv_bags | ON DELETE CASCADE |
| `time` | TIMESTAMP DEFAULT NOW() | Thời điểm ghi log — **cột duy nhất**, không có `created_at` |
| `volume` | DECIMAL(10,2) | ml tại thời điểm này |
| `flow_rate` | DECIMAL(10,4) | giọt/phút tại thời điểm này |

**Quan hệ với `iv_bags`:**
- `iv_bags`: **1 dòng / bag** — snapshot mới nhất (overwrite liên tục)
- `bag_logs`: **N dòng / bag** — mỗi lần ESP32 gửi thì append 1 dòng → dùng để vẽ chart

```
ESP32 gửi { esp32_id, volume, flow_rate }
    ├── UPDATE iv_bags  SET current_volume=volume, flow_rate=flow_rate  (ghi đè)
    └── INSERT bag_logs (bag_id, time, volume, flow_rate)               (append)
```

**FE đọc time:** `new Date(h.time ?? h.created_at).getTime()` — fallback cho schema cũ có `created_at`.

### Bảng `esp32_devices`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | VARCHAR(100) PK | ID thiết bị — do firmware hardcode |
| `status` | VARCHAR(20) | `online` / `busy` / `offline` |
| `current_bag_id` | VARCHAR(50) | Bag đang gắn (NULL nếu rảnh) |
| `registered_at` | TIMESTAMP | Lần đầu đăng ký |
| `last_seen_at` | TIMESTAMP | Lần cuối gửi data |

**Trạng thái:**
- `online` → thiết bị rảnh, chờ gán bag
- `busy` → đang theo dõi 1 bag
- `offline` → mất kết nối (last_seen > 30s)

### Bảng `reported_machines`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | SERIAL PK | |
| `esp32_id` | VARCHAR(100) | |
| `room_bed` | VARCHAR(100) | Vị trí thiết bị |
| `status` | VARCHAR(20) | `pending` / `resolved` |
| `reported_at` | TIMESTAMP | Lúc báo lỗi |
| `resolved_at` | TIMESTAMP NULL | Lúc sửa xong |

### ID Generation

| Entity | Format | Ví dụ | Ghi chú |
|--------|--------|-------|---------|
| Patient | `p` + Date.now() | `p1744556823142` | ms từ epoch |
| Bag | `b` + Date.now() | `b1744556901337` | ms từ epoch |
| ESP32 | Firmware tự đặt | `ESP001` | |
| bag_logs | SERIAL DB | `1`, `2`, `3`... | |

---

## 6. Backend

### 6.1 Hai chế độ hoạt động

| | Local Dev | Production |
|---|---|---|
| File | `BE/src/index.js` | `BE/api/index.js` |
| Framework | Express | Vercel Serverless |
| DB | MySQL (mysql2/promise) | Neon PostgreSQL (@neondatabase/serverless) |
| Routing | Express Router | `if (path === ... && method === ...)` |

### 6.2 Routes (`BE/src/routes/index.js`)

```
GET    /bags                      → bagController.getAll               (active bags)
GET    /bags/all                  → bagController.getAllIncludingCompleted
GET    /bags/:id                  → bagController.getById
GET    /bags/patient/:patientId   → bagController.getByPatientId
GET    /bags/:id/history          → bagController.getHistory           (?limit=N, default 500)
GET    /bags/:id/export           → bagController.exportData           (?startTime=&endTime=)
GET    /bags/anomalies            → bagController.checkAnomalies
POST   /bags                      → bagController.create
PUT    /bags/:id                  → bagController.update
PUT    /bags/:id/status           → bagController.updateStatus
DELETE /bags/:id                  → bagController.delete

GET    /esp32                     → esp32Controller.getAll
GET    /esp32/available           → (production only) status='online'
GET    /esp32/:id                 → esp32Controller.getById
POST   /esp32/register            → esp32Controller.register
POST   /esp32/update              → esp32Controller.update             (ESP32 webhook, 5s)

GET    /patients                  → patientController.getAll
GET    /patients/:id              → patientController.getById
POST   /patients                  → patientController.create
PUT    /patients/:id              → patientController.update
DELETE /patients/:id              → patientController.delete

GET    /machines/reported         → machineController.getReported
POST   /machines/report           → machineController.report
PUT    /machines/:esp32Id/resolve → machineController.resolve
```

### 6.3 ESP32 Webhook — `POST /esp32/update`

Luồng xử lý trong `api/index.js` (production):

1. Kiểm tra `esp32_id` có tồn tại trong `esp32_devices` không → 404 nếu không
2. Kiểm tra `status === 'busy'` → 403 nếu không phải busy
3. `UPDATE esp32_devices SET last_seen_at = NOW()`
4. Tìm bag active của ESP32 này: `SELECT * FROM iv_bags WHERE esp32_id = ? AND status IN ('running','empty')`
5. Tính anomaly FAST_DRAIN (xem mục 11)
6. `UPDATE iv_bags SET current_volume, flow_rate, status, anomaly, updated_at`
7. `INSERT INTO bag_logs (bag_id, time, volume, flow_rate)`
8. Trả về `{ success, bag, anomaly }`

### 6.4 Models (local dev — `BE/src/models/`)

**`bagModel.js`** — key methods:

| Method | Mô tả |
|--------|-------|
| `findAllWithPatient()` | JOIN patients, tất cả bags |
| `findActiveWithPatient()` | JOIN patients, status ≠ completed |
| `findByEsp32Id(id)` | Bag active đang gắn với ESP32 |
| `create(...)` | Tạo bag, ID = `b{Date.now()}` |
| `updateFromESP32(esp32Id, {volume, flowRate})` | Update + anomaly check + ghi log |
| `getHistoryLogs(bagId, limit)` | Lấy bag_logs cho chart |
| `insertLog(bagId, {volume, flowRate})` | Append 1 dòng vào bag_logs |
| `autoCompleteEmpty()` | Bulk: empty → completed nếu ≥ 3 phút |
| `checkAllBagsForAnomalies()` | Scan tất cả bag, so 2 log gần nhất |

**`esp32DeviceModel.js`** — key methods:

| Method | Mô tả |
|--------|-------|
| `register(id)` | Insert mới với status='online', trả existing nếu đã có |
| `updateLastSeen(id)` | last_seen_at = NOW(), status = 'online' |
| `registerOrUpdate(id)` | Upsert: register nếu mới, updateLastSeen nếu đã có |
| `findOfflineDevices()` | last_seen_at < NOW() - 30s |

### 6.5 Production vs Local — Điểm khác biệt

Production (`api/index.js`) có thêm so với local (`src/`):
- `POST /bags` → update `esp32_devices.status = 'busy'`, `current_bag_id = bag.id`
- `PUT /bags/:id/status` → khi completed/cancelled, giải phóng ESP32: `status='online'`, `current_bag_id=NULL`
- `DELETE /bags/:id` → cũng giải phóng ESP32
- `POST /esp32/register` → 409 nếu đang busy, dùng `ON CONFLICT` upsert
- `POST /esp32/update` → enforce `status === 'busy'` mới nhận data
- `GET /esp32/available` → chỉ trả `status='online'`

---

## 7. Frontend

### 7.1 Routing

```
/            → Dashboard        (layout)
/patients    → Patients         (layout)
/patient/:id → PatientDetails   (layout)
/history     → History          (layout)
/reports     → Reports          (layout)
/login       → Login            (no layout, UI only)
```

### 7.2 IVBagContext — State Management

File: `FE/src/app/context/IVBagContext.tsx`

**Constants:**

| Constant | Giá trị | Mục đích |
|----------|---------|---------|
| `API_BASE` | `VITE_API_BASE` hoặc `https://bme-1.vercel.app/api` | |
| `POLL_MS` | 5000ms | Tần suất poll backend |
| `TICK_INTERVAL_MS` | 1000ms | Tick simulate cho bag không có ESP32 |
| `LOG_INTERVAL_MS` | 5000ms | Tần suất ghi log local (bag không có ESP32) |
| `AUTO_COMPLETE_MS` | 180000ms (3 phút) | Tự complete sau khi empty (bag không có ESP32) |
| `MAX_HISTORY_ENTRIES` | 1000 | Giới hạn log trong memory |

**State:** `patients`, `bags`, `esp32Devices`, `reportedMachines`, `isLoading`, `isConnected`

**`fetchAllData()`:** Parallel `Promise.all` tới 4 endpoint, map snake_case → camelCase. `esp32Devices.patientId` và `bagId` được **derive** từ `iv_bags` (không lưu trong DB `esp32_devices`). Poll mỗi 5s, dừng khi tab ẩn.

**`fetchBagHistory(bagId)`:** Gọi 1 lần per bag khi `historyLogs.length === 0`. Map `h.time ?? h.created_at` (tương thích schema cũ/mới).

**Simulation tick** (chỉ cho bag không có `esp32Id`): giảm volume mỗi giây theo `dropsToMlPerSec(flowRate)`, chuyển trạng thái empty → completed sau 3 phút.

**Lưu ý về `maintenance`:** `moveToMaintenance()` và `resolveMaintenance()` chỉ cập nhật React state — **không gọi API** — mất khi refresh trang.

### 7.3 Pages

**`Dashboard.tsx`:**
- Grid tất cả ESP32 (trừ đang bảo trì)
- Stats bar: tổng thiết bị, đang chạy, sắp hết (< 15p), chờ gán
- Tìm kiếm theo ID thiết bị / tên bệnh nhân / phòng giường
- Sắp xếp: thời gian còn lại (asc/desc), thể tích (asc/desc); thiết bị chưa gán luôn xuống dưới
- **Không còn** click vào card chưa gán để assign — dùng nút "Thêm bình truyền"

**`PatientDetails.tsx`:**
- Danh sách bags của bệnh nhân (trái), chart + stats (phải)
- Chart.js dual-axis: trục Y trái = volume (ml), trục Y phải = flow rate (giọt/phút)
- **Flow rate chart**: lấy thẳng `log.flowRate` từ `bag_logs` — **không tính lại từ volume delta** (sẽ sai x2 do latency Neon)
- Nếu bag `completed`: thêm điểm cuối volume=0
- Y-axis max: `ceil(initialVolume * 1.05 / 50) * 50`

**`Reports.tsx`:**
- Hiển thị `esp32Devices.filter(d => d.maintenance)`
- "Đã sửa xong" → `resolveMaintenance` + `resolveMachine` → thiết bị về Dashboard

### 7.4 Components

**`Esp32Card.tsx`:**

| Trạng thái | Border | Top bar |
|-----------|--------|---------|
| Chưa gán | Dashed gray | Gray |
| Running bình thường | Gray | Green pulse |
| Warning (< 50ml hoặc < 15p) | Orange | Orange pulse |
| Empty | Red | Red pulse |
| FAST_DRAIN | Red + ring đỏ | Red pulse |
| Offline | Grayed out, không click | — |

- Card chưa gán: **không click được**, hiện "Thiết bị đang chờ — Thêm bình truyền để gắn"
- Card đã gán: click → navigate `/patient/:id`
- Nút "Kết thúc": `completeBagManually` + `releaseEsp32`
- Nút "Tạm dừng" (FAST_DRAIN): `completeBagManually('ERROR')` + `reportMachine` + `moveToMaintenance`

**`AddBagModal.tsx`** — form 3 section:
1. **Bệnh nhân**: chọn có sẵn hoặc tạo mới (họ tên*, tuổi, phòng*, giường*, bệnh lý)
2. **ESP32**: dropdown chỉ hiện thiết bị `online` + chưa có bag; có thể bỏ qua
3. **Dịch truyền**: loại dịch (preset + tự nhập), thể tích (preset 250/500/1000ml), tốc độ (preset 20/40/60)

**`AddDeviceModal.tsx`:** Nhập ID ESP32 → `POST /esp32/register`

**`EditPatientModal.tsx`:** Sửa thông tin bệnh nhân + flow rate bag hiện tại

### 7.5 Types (`FE/src/app/types.ts`)

```typescript
interface Patient {
  id: string; name: string; room: string; bed: string;
  age?: number; condition?: string;
}

type BagStatus = "running" | "stopped" | "empty" | "completed";

interface Esp32Device {
  id: string;
  patientId?: string;   // derive từ iv_bags, không có trong DB
  bagId?: string;       // derive từ iv_bags, không có trong DB
  registeredAt: number;
  maintenance?: boolean; // local state only, mất khi refresh
  status?: "online" | "offline" | "busy";
}

interface DataPoint {
  time: number;     // timestamp ms
  volume: number;   // ml
  flowRate: number; // giọt/phút
}

interface IVBag {
  id: string; patientId: string; esp32Id?: string; type: string;
  initialVolume: number; currentVolume: number;
  flowRate: number;     // giọt/phút
  startTime: number; status: BagStatus; emptyTimestamp?: number;
  historyLogs: DataPoint[];
  anomaly?: "FAST_DRAIN";
  stopReason?: "NORMAL" | "ERROR";
}

interface ReportedMachine {
  esp32Id: string; reportedAt: number;
  roomBed?: string; status: "pending" | "resolved";
}
```

### 7.6 Utilities (`FE/src/app/lib/utils.ts`)

| Hàm | Công thức | Ghi chú |
|-----|-----------|---------|
| `dropsToMlPerSec(drops/min)` | `drops / 20 / 60` | 20 giọt = 1ml |
| `dropsToMlPerMin(drops/min)` | `drops / 20` | |
| `calculateTimeRemainingInMinutes(vol, fr)` | `vol / (fr / 20)` | |
| `formatTimeRemaining(minutes)` | `"Xh Ym"` / `"Ym"` / `"Hết"` | |
| `cn(...inputs)` | clsx + tailwind-merge | |

---

## 8. API Reference

Base URL production: `https://bme1-backend.vercel.app/api`  
Base URL local: `http://localhost:3001/api`

### Bags

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| GET | `/bags` | — | Active bags (không completed) kèm patient |
| GET | `/bags/all` | — | Tất cả bags kèm patient |
| GET | `/bags/:id` | — | 1 bag |
| GET | `/bags/patient/:patientId` | — | Bags của 1 bệnh nhân |
| GET | `/bags/:id/history` | — | bag_logs để vẽ chart (`?limit=N`) |
| GET | `/bags/:id/export` | — | Lọc theo `?startTime=&endTime=` |
| GET | `/bags/anomalies` | — | Tất cả FAST_DRAIN đang active |
| POST | `/bags` | `{patientId, type, initialVolume, flowRate, esp32Id?}` | Tạo bag |
| PUT | `/bags/:id` | `{type?, esp32Id?, flowRate?, status?, currentVolume?}` | Update fields |
| PUT | `/bags/:id/status` | `{status}` | Đổi status |
| DELETE | `/bags/:id` | — | Xóa, tự giải phóng ESP32 |

### Patients

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| GET | `/patients` | — | Tất cả |
| GET | `/patients/:id` | — | 1 bệnh nhân |
| POST | `/patients` | `{name, room, bed, age?, condition?}` | Tạo |
| PUT | `/patients/:id` | `{name?, room?, bed?, age?, condition?}` | Update |
| DELETE | `/patients/:id` | — | Xóa |

### ESP32

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| GET | `/esp32` | — | Tất cả thiết bị |
| GET | `/esp32/available` | — | Chỉ `status='online'` (production) |
| GET | `/esp32/:id` | — | 1 thiết bị |
| POST | `/esp32/register` | `{esp32_id}` | Đăng ký; 409 nếu busy |
| POST | `/esp32/update` | `{esp32_id, volume, flow_rate}` | Webhook 5s |
| DELETE | `/esp32/:id` | — | Xóa thiết bị |

**`POST /esp32/update` responses:**
```
200 { success: true, bag: {...}, anomaly: "FAST_DRAIN" | null }
403 { success: false, message: "ESP32 chưa được gán vào bag" }
404 { success: false, message: "ESP32 chưa đăng ký" }
```

### Machines

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| GET | `/machines/reported` | — | Thiết bị pending |
| POST | `/machines/report` | `{esp32_id, room_bed?}` | Báo lỗi |
| PUT | `/machines/:esp32Id/resolve` | — | Đánh dấu sửa xong |

### Health

```
GET /health  →  { status: 'ok', timestamp }
```

---

## 9. ESP32 Integration

### ESP32 chỉ cần 2 API

**1. Bật nguồn (1 lần trong setup()):**
```
POST /api/esp32/register
{ "esp32_id": "ESP001" }

→ 201: online, chờ nurse gán bag
→ 409: đang busy, tiếp tục gửi update bình thường
```

**2. Mỗi 5 giây (trong loop()):**
```
POST /api/esp32/update
{ "esp32_id": "ESP001", "volume": 350.5, "flow_rate": 40.0 }

→ 200: OK
→ 403: chưa được gán bag, chờ
→ 404: chưa đăng ký → gọi /register lại
```

| Field | Đơn vị | Nguồn từ phần cứng |
|-------|--------|-------------------|
| `volume` | ml còn lại | Cảm biến siêu âm HC-SR04 / load cell |
| `flow_rate` | giọt/phút | Cảm biến đếm giọt IR |

ESP32 **không cần biết** bag_id hay patient_id — server tự tra từ esp32_id.

### Arduino Code (tóm tắt)

```cpp
void setup() {
  connectWiFi();
  registerESP32();  // POST /esp32/register
}

void loop() {
  delay(5000);
  sendUpdate(readVolume(), readFlowRate());  // POST /esp32/update
}
```

Xem code đầy đủ trong `ESP32-GUIDE.md`.

### Hardware

```
HC-SR04:  VCC→5V, GND→GND, TRIG→GPIO5, ECHO→GPIO18
```

Calibration `readVolume()` — đo khoảng cách từ sensor xuống mặt dịch:
```cpp
// X = khoảng cách khi chai đầy (cm), Y = khi chai rỗng (cm)
float percent = constrain((Y - distance) / (Y - X), 0.0, 1.0);
float volume  = percent * INITIAL_VOLUME_ML;
```

---

## 10. Business Logic & Workflows

### Tạo bình truyền mới

1. Nurse nhấn **"Thêm bình truyền"** trên Dashboard
2. `AddBagModal`: chọn/tạo bệnh nhân + chọn ESP32 online (nếu có) + nhập thông tin dịch
3. `POST /api/bags` → bag tạo `status='running'`
4. Nếu có ESP32: `esp32_devices.status = 'busy'`, `current_bag_id = bag.id`
5. FE poll → card xuất hiện trên Dashboard

### Kết thúc bình thường

1. Y tá nhấn "Kết thúc" trên card
2. `completeBagManually(id, 'NORMAL')` → `PUT /bags/:id/status { status: 'completed' }`
3. BE giải phóng ESP32: `status='online'`, `current_bag_id=NULL`
4. Poll tiếp theo → card biến mất khỏi Dashboard

### Anomaly → Bảo trì

1. ESP32 gửi data, BE phát hiện FAST_DRAIN
2. `iv_bags.anomaly = 'FAST_DRAIN'` được lưu vào DB
3. Poll tiếp theo → FE nhận → card đổi viền đỏ + hiện nút "Tạm dừng"
4. Y tá nhấn "Tạm dừng":
   - `completeBagManually(id, 'ERROR')` → bag completed
   - `reportMachine(esp32Id, roomBed)` → `POST /machines/report`
   - `moveToMaintenance(esp32Id)` → local state `maintenance=true`
5. Thiết bị biến khỏi Dashboard, xuất hiện ở Reports
6. Kỹ thuật sửa xong, y tá nhấn "Đã sửa xong":
   - `resolveMaintenance(esp32Id)` → xóa maintenance flag (local state)
   - `resolveMachine(esp32Id)` → `PUT /machines/:id/resolve`
7. Thiết bị xuất hiện lại Dashboard với status `online`

### Cảnh báo thể tích (Warning cam)

```typescript
isWarning = !hasAnomaly && !isEmpty && !isCompleted &&
  (bag.currentVolume <= 50 || timeRemainingMinutes <= 15)
```

---

## 11. Anomaly Detection

### FAST_DRAIN — phát hiện tại BE mỗi lần ESP32 gửi

```
expected = (iv_bags.flow_rate / 20 / 60) × 5   // ml đáng lẽ giảm trong 5s
actual   = iv_bags.current_volume - volume_mới  // ml thực tế giảm

Nếu actual > expected × 3  VÀ  actual > 10ml
→ anomaly = 'FAST_DRAIN'
```

**Lưu ý:**
- So sánh volume giảm **trong 1 chu kỳ 5s** — không so với tốc độ y lệnh ban đầu
- `iv_bags.flow_rate` bị overwrite trước khi check → dùng giá trị cũ (current_volume) so với volume mới
- Không phát hiện được nếu flow giảm **dần dần** qua nhiều chu kỳ

### Batch scan — `GET /bags/anomalies`

`bagModel.checkAllBagsForAnomalies()`: so sánh 2 log entry gần nhất per bag, threshold > 3× expected AND > 30ml. Trả severity `HIGH` (> 5×) hoặc `MEDIUM`.

### Visual Feedback

| Loại | Border | Top bar | Nút action |
|------|--------|---------|-----------|
| FAST_DRAIN | `border-red-400 ring-2 ring-red-200` | `bg-red-500 animate-pulse` | "Tạm dừng" cam |
| Warning (sắp hết) | `border-orange-300 ring-1` | `bg-orange-400 animate-pulse` | "Kết thúc" xanh |
| Empty | `border-red-300 ring-1` | `bg-red-500 animate-pulse` | "Kết thúc" xanh |

---

## 12. Deploy

### Yêu cầu
- Vercel account + CLI: `npm i -g vercel`
- Neon account

### Bước 1 — Neon DB

```bash
# Tạo project trên https://neon.tech → copy connection string
psql "postgresql://user:pass@ep-xxx.neon.tech/bme1" -f BE/schema-neon.sql
```

### Bước 2 — Deploy BE

```bash
cd BE && vercel --prod
```

Vercel Dashboard → **bme1-backend** → Environment Variables:
```
DATABASE_URL = postgresql://user:pass@ep-xxx.neon.tech/bme1
```

### Bước 3 — Deploy FE

```bash
# FE/.env.production
VITE_API_BASE=https://bme1-backend.vercel.app/api

cd FE && vercel --prod
```

### Kiểm tra

```bash
curl https://bme1-backend.vercel.app/api/health
curl https://bme1-backend.vercel.app/api/esp32
```

---

## 13. Local Dev Setup

```bash
# 1. Install
npm run install:all

# 2. Tạo MySQL DB
mysql -u root -p -e "CREATE DATABASE bme1_db;"

# 3. BE/.env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=bme1_db
PORT=3001

# 4. Chạy
npm run dev:be   # Terminal 1 → http://localhost:3001
npm run dev:fe   # Terminal 2 → http://localhost:5173
```

`FE/.env.development` (đã có sẵn):
```
VITE_API_BASE=http://localhost:3001/api
```

---

## 14. Known Issues

### Dual backend không đồng bộ
`BE/src/` (local) thiếu `current_bag_id` và logic `busy` status so với `BE/api/index.js` (production). Khi thêm feature mới phải sửa cả hai.

### `maintenance` flag mất khi refresh
`moveToMaintenance()` chỉ cập nhật React state, không gọi API. Refresh trang → thiết bị hiện lại Dashboard bình thường thay vì ở Reports.

### Chart flow_rate — đừng tính lại từ volume delta
Tính `(volumeLost / timeDiff) × 20 × 60` sẽ cho kết quả sai x2 vì Neon có latency không đồng đều. Luôn dùng thẳng `log.flowRate` từ `bag_logs`.

### FAST_DRAIN không bắt được flow giảm dần
Logic chỉ so sánh 1 chu kỳ 5s. Nếu tốc độ thực tế thấp hơn y lệnh nhưng giảm từ từ → không trigger.

### Không có authentication
`/login` là UI placeholder. Không có JWT hay session bảo vệ bất kỳ API endpoint nào.

### `bag_logs.time` — không có `created_at`
Schema hiện tại chỉ có cột `time`. FE dùng `h.time ?? h.created_at` để tương thích schema cũ. Nếu reset DB từ đầu thì `h.created_at` luôn undefined — không sao vì `h.time` luôn có.

### History fetch có thể gây nhiều request đồng thời
`useEffect` trong `IVBagContext` fetch history cho mọi bag có `historyLogs.length === 0`. Load lần đầu với nhiều bag → N request song song.
