# CLAUDE.md — Hướng dẫn cho AI làm việc với BME1

---

## 1. Tổng quan dự án

BME1 là hệ thống IoT theo dõi truyền dịch bệnh viện:
- **ESP32** đo thể tích + tốc độ truyền → gửi lên server mỗi 5 giây
- **Backend** lưu DB, phát hiện anomaly, trả API
- **Frontend** React hiển thị real-time dashboard

---

## 2. Hai backend song song — quan trọng

| File | Dùng khi nào | DB |
|------|-------------|-----|
| `BE/src/index.js` + `src/` | Local dev | MySQL |
| `BE/api/index.js` | Production (Vercel) | Neon PostgreSQL |

**Khi sửa business logic phải sửa CẢ HAI file.**

---

## 3. Schema DB đúng

**Chỉ dùng `BE/schema-neon.sql`** cho production Neon.

Các cột quan trọng mà schema cũ thiếu (đã fix):
- `esp32_devices.current_bag_id` — bag đang gắn với ESP32
- `esp32_devices.status` có 3 giá trị: `online` / `busy` / `offline`
- `iv_bags.anomaly` — `FAST_DRAIN` hoặc NULL
- `iv_bags.updated_at` — dùng trong ORDER BY và UPDATE

---

## 4. Luồng dữ liệu chính

```
ESP32 gửi { esp32_id, volume, flow_rate } mỗi 5s
    ↓ POST /api/esp32/update
    ├── UPDATE iv_bags  → ghi đè current_volume + flow_rate (snapshot hiện tại)
    └── INSERT bag_logs → append dòng mới (lịch sử để vẽ chart)
```

### `iv_bags` vs `bag_logs`
- `iv_bags`: 1 dòng/bag — trạng thái **mới nhất**
- `bag_logs`: N dòng/bag — **toàn bộ lịch sử** từng 5 giây

### `flow_rate` trong `iv_bags`
Bị ESP32 **ghi đè** mỗi 5s — không phải tốc độ y lệnh ban đầu.
`bag_logs.flow_rate` mới là giá trị từng thời điểm dùng để vẽ chart.

### `bag_logs.time`
Chỉ có 1 cột thời gian `time` (không có `created_at` trong schema hiện tại).
FE đọc: `new Date(h.time ?? h.created_at).getTime()` — tương thích schema cũ lẫn mới.

---

## 5. Chart flow_rate — cách vẽ đúng

**Dùng thẳng `log.flowRate` từ `bag_logs`**, không tính lại từ volume delta.

Lý do: tính lại `(volumeLost / timeDiff) × 20 × 60` sẽ sai x2 vì Neon serverless có latency không đồng đều — `timeDiff` thực tế ngắn hơn 5000ms → kết quả phóng to.

```typescript
// ĐÚNG
const flowRateData = sortedLogs.map(log => Math.round(log.flowRate * 10) / 10);

// SAI — đừng làm thế này
const dropsPerMin = (volumeLost / timeDiffSec) * 20 * 60;
```

---

## 6. ESP32 chỉ gọi 2 API

```
1. Bật nguồn → POST /api/esp32/register  { esp32_id }
   - 201: online, chờ gán bag
   - 409: đang busy → tiếp tục gửi update

2. Mỗi 5s → POST /api/esp32/update  { esp32_id, volume, flow_rate }
   - volume: ml còn lại (float)
   - flow_rate: giọt/phút (float)
   - Server tự tìm bag, update, log, check anomaly
```

ESP32 **không cần biết** bag_id hay patient_id — server tự tra từ esp32_id.

---

## 7. Cảnh báo — 2 loại khác nhau

### FAST_DRAIN (đỏ) — phát hiện ở BE
```
expected = (iv_bags.flow_rate / 20 / 60) × 5  // ml đáng lẽ giảm trong 5s
actual   = iv_bags.current_volume - volume_mới  // ml thực tế giảm

Nếu actual > expected × 3 VÀ actual > 10ml → FAST_DRAIN
```
- So sánh volume giảm **trong 1 chu kỳ 5s**, không so với y lệnh ban đầu
- Không phát hiện được nếu flow giảm dần dần

### Warning (cam) — tính ở FE
```
currentVolume <= 50ml  HOẶC  timeRemaining <= 15 phút
```

---

## 8. ID generation

```
Patient: p + Date.now()  →  p1744556823142
Bag:     b + Date.now()  →  b1744556901337
ESP32:   do firmware hardcode (vd: "ESP001")
bag_logs: SERIAL tự tăng DB
```

---

## 9. State Management FE

`IVBagContext.tsx` là single source of truth:
- Poll backend mỗi 5s (`fetchAllData`)
- `esp32Devices.patientId` và `bagId` được **derive** từ `iv_bags` (không lưu trong `esp32_devices` table)
- `maintenance` flag chỉ tồn tại trong React state — mất khi refresh
- Chart history fetch 1 lần per bag khi `historyLogs.length === 0`

---

## 10. Dashboard — flow gán thiết bị

**Không còn** click vào ESP32 card để gán bệnh nhân.

Flow đúng:
1. ESP32 bật nguồn → tự xuất hiện trên Dashboard với status "Chờ gán bình truyền"
2. Nurse click **"Thêm bình truyền"** (nút xanh lá góc trên)
3. Modal `AddBagModal` cho phép: chọn/tạo bệnh nhân đầy đủ thông tin + chọn ESP32 online + nhập thông tin dịch
4. Submit → bag created → ESP32 status chuyển `busy`

---

## 11. Các bug đã fix (đừng revert)

| Bug | File | Fix |
|-----|------|-----|
| Chart đọc `h.created_at` (undefined) | `IVBagContext.tsx` | Đổi thành `h.time ?? h.created_at` |
| Chart flow_rate x2 do tính từ volume delta | `PatientDetails.tsx` | Dùng thẳng `log.flowRate` từ bag_logs |
| Schema thiếu `current_bag_id`, `anomaly`, `updated_at` | `schema-neon.sql` | Đã thêm đủ |
| AddBagModal thiếu tuổi, tình trạng bệnh nhân | `AddBagModal.tsx` | Đã thêm đủ trường |
| Click ESP32 card mở AssignPatientModal | `Esp32Card.tsx`, `Dashboard.tsx` | Đã xóa flow này |

---

## 12. Quy tắc code chung

- Sửa gì thì sửa đúng chỗ đó, không refactor code xung quanh
- Thêm feature mới → kiểm tra cả `BE/src/` lẫn `BE/api/index.js`
- Schema thay đổi → cập nhật `BE/schema-neon.sql`
- Sau khi sửa → `vite build` để kiểm tra không lỗi compile trước khi push
