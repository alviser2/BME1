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