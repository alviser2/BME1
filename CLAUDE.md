# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BME1 is a Healthcare/Medical IoT monitoring system for tracking IV (intravenous) fluid bags in hospitals. ESP32 devices measure IV bag volume and flow rate in real-time.

## Architecture

### Monorepo Structure
```
BME1/
├── FE/                 # React 18 + Vite + TypeScript frontend
│   └── src/app/
│       ├── components/ # Reusable UI components (Esp32Card, BagCard, modals)
│       ├── pages/      # Route pages (Dashboard, PatientDetails, History, Reports)
│       ├── context/    # IVBagContext - central state management
│       ├── types.ts    # TypeScript interfaces
│       └── lib/utils.ts
├── BE/                 # Node.js + Express backend
│   └── src/
│       ├── controllers/ # Request handlers
│       ├── models/     # Database queries (PostgreSQL)
│       ├── routes/     # API route definitions
│       └── index.js    # Entry point
└── schema.sql          # PostgreSQL database schema
└── schema-mysql.sql    # MySQL database schema (used)
```

### Key Files
- `FE/src/app/context/IVBagContext.tsx` - All state management (bags, patients, esp32Devices, reportedMachines)
- `FE/src/app/types.ts` - Core TypeScript interfaces (IVBag, Patient, Esp32Device, ReportedMachine)
- `FE/src/app/pages/PatientDetails.tsx` - Patient detail with Chart.js line charts
- `BE/src/models/bagModel.js` - Bag queries including anomaly detection logic
- `BE/src/models/esp32DeviceModel.js` - ESP32 device CRUD (auto-registration)
- `BE/src/controllers/esp32Controller.js` - ESP32 endpoints (webhook, list, register)

## Commands

```bash
# Install all dependencies
npm run install:all

# Frontend (http://localhost:5173)
npm run dev:fe

# Backend (http://localhost:3001)
npm run dev:be

# Database setup
psql -U postgres -d bme1_db -f BE/schema.sql
```

## Important Notes

### State Management
- FE uses React Context (`IVBagContext`) for all state
- Currently runs in **demo mode** with mock data when BE is not connected
- When BE is connected, data flows: ESP32 → BE webhook → PostgreSQL → FE API calls

### Anomaly Detection
- **Frontend mock**: Detection happens in `IVBagContext.tsx` tick interval
- **Backend real**: Detection happens in `BE/src/models/bagModel.js` `findByEsp32Id()` method
- Thresholds: `FAST_DRAIN` (>5x flow rate)

### Device Maintenance Flow
1. Device with anomaly → "Tạm dừng" button appears on card
2. Click "Tạm dừng" → `completeBagManually(bag.id, "ERROR")` + `moveToMaintenance(device.id)`
3. Device disappears from Dashboard, appears in Reports page
4. Click "Đã sửa xong" → `resolveMaintenance()` + `resolveMachine()` → device returns to Dashboard

### Color Coding for Anomalies
- `FAST_DRAIN` (>5x): Red (red-400 border, bg-red-500 bar)
- Warning (low volume <50ml or <15min): Orange (orange-300/400)

### Chart.js in PatientDetails
- Y-axis for volume starts from 0, max dynamically set to `initialVolume * 1.05` rounded to nearest 50
- Line only drops to 0 when bag status is `completed`

## Database

### Tables
- `patients` - Patient info (name, room, bed, age, condition)
- `iv_bags` - IV bag tracking (volume, flow_rate, status, anomaly)
- `bag_logs` - Time-series history for charts
- `reported_machines` - ESP32 error tracking
- `esp32_devices` - Registered ESP32 devices (auto-registered via webhook)

### Key Endpoints
- `POST /api/esp32/update` - ESP32 webhook (receives data every 5s, auto-registers new ESP32)
- `GET /api/esp32` - List all registered ESP32 devices
- `POST /api/esp32/register` - Manual ESP32 registration
- `GET /api/bags/:id/history` - Chart data
- `PUT /api/machines/:esp32Id/resolve` - Mark machine as fixed

### ESP32 Auto-Registration Flow
1. ESP32 sends `POST /api/esp32/update` with `esp32_id` (MAC address)
2. Backend auto-creates device in `esp32_devices` if new
3. FE polls `GET /api/esp32` every 5s to sync device list
4. New devices appear on Dashboard as "Chờ gán" (unassigned)
