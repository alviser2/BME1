# 🚀 Hướng dẫn Deploy BME1 lên Vercel

## Kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                               │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │   FE (React)     │    │      BE (Node.js/Express)   │  │
│  │   bme1-fe        │    │      bme1-backend           │  │
│  │   *.vercel.app   │◄──►│      *.vercel.app/api/*    │  │
│  └──────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Neon PostgreSQL                          │
│                    *.neon.tech                               │
└─────────────────────────────────────────────────────────────┘
```

## Các bước deploy

### 1. Backend (BE)

#### 1.1. Chuẩn bị Database trên Neon

1. Truy cập https://neon.tech
2. Tạo project mới
3. Copy connection string: `postgresql://user:password@host/dbname`

#### 1.2. Chạy schema lên Neon

```bash
# Connect vào Neon
psql "postgresql://user:password@host/dbname"

# Chạy schema
\i BE/schema-neon.sql
```

#### 1.3. Deploy Backend lên Vercel

```bash
cd BE

# Thêm DATABASE_URL vào Environment Variables trên Vercel Dashboard
# Vercel Dashboard → bme1-backend → Environment Variables
# NAME: DATABASE_URL
# VALUE: postgresql://user:password@host/dbname

# Deploy
vercel --prod
```

### 2. Frontend (FE)

#### 2.1. Cập nhật API URL

File `FE/.env.production`:
```
VITE_API_BASE=https://bme1-backend.vercel.app/api
```

#### 2.2. Deploy Frontend lên Vercel

```bash
cd FE

# Deploy
vercel --prod
```

## Cấu hình Environment Variables

### Backend (bme1-backend)
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://user:password@ep-xxx-xxx-123456.neon.tech/bme1` |

### Frontend (bme1-fe)
| Variable | Value |
|----------|-------|
| `VITE_API_BASE` | `https://bme1-backend.vercel.app/api` |

## Kiểm tra sau khi deploy

### Health check
- FE: https://bme1-fe.vercel.app
- BE: https://bme1-backend.vercel.app/health

### Các endpoints chính
- `GET /api/bags` - Danh sách túi truyền
- `GET /api/patients` - Danh sách bệnh nhân
- `GET /api/esp32` - Danh sách thiết bị ESP32
- `GET /api/machines/reported` - Máy báo lỗi
- `POST /api/esp32/update` - ESP32 webhook

## ESP32 Workflow (Luân phiên giữa các giường)

### Mô tả luồng hoạt động

```
Điều dưỡng lấy ESP32 (rảnh) → Bật nguồn → Gắn vào chai truyền → Gán vào Bag → Theo dõi
     ↓
Kết thúc truyền → ESP32 tự động rảnh → Lấy ESP32 khác gắn giường mới
```

### Chi tiết 4 bước

#### Bước 1: ESP32 bật lên → Đăng ký online
```
POST /api/esp32/register
Body: { "esp32_id": "ABC123" }

Response: { id: "ABC123", status: "online", ... }
```
→ ESP32 status = `online` (rảnh, sẵn sàng gán)

#### Bước 2: Điều dưỡng bắt đầu truyền → Gán ESP32 vào Bag
```
POST /api/bags
Body: {
  "patientId": "p1",
  "esp32Id": "ABC123",   ← chọn ESP32 online
  "type": "Nước muối sinh lý 0.9%",
  "initialVolume": 500,
  "flowRate": 40
}

Response: { id: "b123", esp32_id: "ABC123", status: "running", ... }
```
→ ESP32 status = `busy` (đang theo dõi bag)

#### Bước 3: ESP32 gửi data mỗi 5 giây
```
POST /api/esp32/update
Body: { "esp32_id": "ABC123", "volume": 350, "flow_rate": 40 }

Response: { success: true, bag: {...}, anomaly: null }
```

#### Bước 4: Kết thúc truyền → Giải phóng ESP32
```
PUT /api/bags/b123/status
Body: { "status": "completed" }

Response: { id: "b123", status: "completed", ... }
```
→ ESP32 status = `online` (rảnh, có thể gán giường khác)

### API ESP32

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/esp32` | Tất cả thiết bị |
| `GET /api/esp32/available` | ESP32 đang rảnh (online) |
| `POST /api/esp32/register` | Đăng ký ESP32 online |
| `POST /api/esp32/update` | ESP32 gửi data (phải đang busy) |

### Trạng thái ESP32

| Status | Ý nghĩa |
|--------|---------|
| `offline` | Chưa đăng ký / mất kết nối |
| `online` | Rảnh, sẵn sàng gán vào bag |
| `busy` | Đang theo dõi 1 túi truyền |

---

## Troubleshooting

### Lỗi CORS
Kiểm tra file `BE/api/index.js` đã set header:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

### Lỗi kết nối Database
1. Kiểm tra `DATABASE_URL` đã đúng
2. Kiểm tra Neon allowlist IP (nếu có)
3. Test connection: `npx neonctl` hoặc pgAdmin

### Lỗi API 404
Kiểm tra `vercel.json` routes config trong BE

### ESP32 không gửi được data
1. Kiểm tra ESP32 đã gọi `POST /api/esp32/register` chưa
2. Kiểm tra ESP32 đã được gán vào bag chưa (status phải = `busy`)
3. Xem logs: `vercel logs bme1-backend`

## 📡 ESP32 Integration

Xem chi tiết trong file [ESP32-GUIDE.md](./ESP32-GUIDE.md):
- API Endpoints cho ESP32
- Arduino Code mẫu
- Test thủ công bằng curl

## Commands Vercel

```bash
# Backend
cd BE
vercel --prod

# Frontend  
cd FE
vercel --prod

# Xem logs
vercel logs bme1-backend
vercel logs bme1-fe

# Redeploy
vercel --prod --force
```

## Optional: Custom Domain

Trên Vercel Dashboard → Settings → Domains:
- FE: `bme1.your-domain.com`
- BE: `api-bme1.your-domain.com`

Sau đó cập nhật `.env.production` cho phù hợp.