# BME1 - IV Bag Monitoring System

## Cấu trúc dự án

```
BME1/
├── FE/                 # Frontend - React + Vite + Chart.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── context/
│   │   │   └── lib/
│   │   └── main.tsx
│   └── package.json
│
├── BE/                 # Backend - Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── db/
│   │   └── index.js
│   ├── schema.sql      # Database schema
│   └── package.json
│
└── package.json       # Root package (monorepo scripts)
```

## Cài đặt

```bash
# Cài đặt cả FE và BE
cd BME1
npm run install:all
```

## Chạy Development

```bash
# Terminal 1 - Frontend (http://localhost:5173)
npm run dev:fe

# Terminal 2 - Backend (http://localhost:3001)
npm run dev:be
```

## Database Setup (PostgreSQL)

1. Tạo database:
```sql
CREATE DATABASE bme1_db;
```

2. Chạy schema:
```bash
psql -U postgres -d bme1_db -f BE/schema.sql
```

3. Cấu hình .env:
```env
DATABASE_URL=postgres://postgres:password@localhost:5432/bme1_db
PORT=3001
```

## API Endpoints

### Bags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/bags | Lấy bags đang active |
| GET | /api/bags/all | Lấy tất cả bags |
| GET | /api/bags/:id | Lấy bag theo ID |
| GET | /api/bags/:id/history | Lấy log history cho chart |
| POST | /api/bags | Tạo bag mới |
| PUT | /api/bags/:id/status | Cập nhật status |

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/patients | Lấy tất cả bệnh nhân |
| POST | /api/patients | Tạo bệnh nhân mới |
| PUT | /api/patients/:id | Cập nhật bệnh nhân |

### ESP32
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/esp32/update | ESP32 gửi data (webhook) |

### Machines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/machines/reported | Lấy máy đang báo lỗi |
| POST | /api/machines/report | Báo cáo máy lỗi |
| PUT | /api/machines/:esp32Id/resolve | Đánh dấu đã sửa |

## ESP32 Integration

ESP32 gửi data lên backend mỗi 5 giây:

```javascript
POST /api/esp32/update
Content-Type: application/json

{
  "esp32_id": "ESP32_001",
  "volume": 350,      // ml còn lại
  "flow_rate": 40.5  // giọt/phút
}
```

## Database Schema

```
patients
├── id (PK)
├── name
├── room_bed
├── age
├── condition
└── timestamps

iv_bags
├── id (PK)
├── patient_id (FK)
├── esp32_id
├── type
├── initial_volume
├── current_volume
├── flow_rate
├── status (running/stopped/empty/completed)
└── timestamps

bag_logs
├── id (PK)
├── bag_id (FK)
├── time
├── volume
├── flow_rate
└── created_at

reported_machines
├── id (PK)
├── esp32_id
├── room_bed
├── status (pending/resolved)
└── timestamps
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Chart.js, React Router v7
- **Backend**: Node.js, Express, PostgreSQL, pg
- **Database**: PostgreSQL 14+
