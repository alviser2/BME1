# BME1 – IV Bag Monitoring System: Full Technical Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [Backend (BE)](#6-backend-be)
   - 6.1 [Entry Point & Middleware](#61-entry-point--middleware)
   - 6.2 [Routes](#62-routes)
   - 6.3 [Controllers](#63-controllers)
   - 6.4 [Models](#64-models)
   - 6.5 [Database Connections](#65-database-connections)
   - 6.6 [Vercel Serverless Handler](#66-vercel-serverless-handler)
7. [Frontend (FE)](#7-frontend-fe)
   - 7.1 [Entry Point & Routing](#71-entry-point--routing)
   - 7.2 [State Management – IVBagContext](#72-state-management--ivbagcontext)
   - 7.3 [Pages](#73-pages)
   - 7.4 [Components](#74-components)
   - 7.5 [Types](#75-types)
   - 7.6 [Utilities](#76-utilities)
8. [API Reference](#8-api-reference)
9. [ESP32 Integration](#9-esp32-integration)
10. [Business Logic & Key Workflows](#10-business-logic--key-workflows)
11. [Anomaly Detection](#11-anomaly-detection)
12. [Deployment](#12-deployment)
13. [Local Development Setup](#13-local-development-setup)
14. [Known Issues & Notes](#14-known-issues--notes)

---

## 1. Project Overview

**BME1** is a real-time Healthcare IoT system for monitoring intravenous (IV) fluid bags in a hospital setting. ESP32 microcontroller devices are physically attached to IV bag stands and report fluid volume and flow rate every 5 seconds over WiFi. Hospital nurses can monitor all active drips from a single web dashboard, receive alerts for anomalies (e.g. a bag draining abnormally fast), and manage device maintenance.

**Core capabilities:**
- Real-time IV bag volume & flow rate tracking
- Multi-patient / multi-device dashboard
- Automated anomaly detection (fast drain)
- Low-volume and near-empty alerts
- Device lifecycle management (assign → monitor → complete → release)
- Historical charts per bag per patient
- Device maintenance/repair reporting workflow
- Full CRUD for patients and IV bags

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Vercel Cloud                     │
│                                                      │
│  ┌─────────────────┐      ┌──────────────────────┐  │
│  │  FE (React/Vite)│      │  BE (Node/Express)   │  │
│  │  bme1-fe.vercel │◄────►│  bme1-backend.vercel │  │
│  └─────────────────┘      └──────────┬───────────┘  │
└──────────────────────────────────────┼───────────────┘
                                       │
                           ┌───────────▼────────────┐
                           │   Neon PostgreSQL       │
                           │   (Production)          │
                           └────────────────────────┘
                           OR
                           ┌───────────────────────┐
                           │   Local MySQL          │
                           │   (Development)        │
                           └───────────────────────┘

┌──────────────────────────────────────────────────────┐
│                  ESP32 Devices (IoT)                 │
│  POST /api/esp32/register  (on boot)                │
│  POST /api/esp32/update    (every 5s)               │
└──────────────────────────────────────────────────────┘
```

**Data flow:**
1. ESP32 boots → registers with `POST /api/esp32/register`
2. Nurse opens FE, creates a new bag, selects the ESP32 device
3. Backend marks the ESP32 as `busy`, links it to the bag
4. ESP32 sends sensor readings every 5 s → `POST /api/esp32/update`
5. Backend updates bag volume, detects anomalies, writes log entries
6. FE polls `GET /api/bags/all` and `GET /api/esp32` every 5 s, re-renders cards
7. When drip ends, nurse clicks "Kết thúc" → bag set to `completed`, ESP32 freed to `online`

---

## 3. Repository Structure

```
BME1/
├── BE/                          # Backend – Node.js + Express (local) / Serverless (Vercel)
│   ├── api/
│   │   ├── index.js             # Vercel serverless function (single handler for all routes)
│   │   └── _lib/
│   │       └── db.js            # Neon PostgreSQL client (used in production)
│   ├── src/
│   │   ├── index.js             # Express server entry point (local dev)
│   │   ├── routes/
│   │   │   └── index.js         # All API route declarations
│   │   ├── controllers/
│   │   │   ├── bagController.js
│   │   │   ├── esp32Controller.js
│   │   │   ├── patientController.js
│   │   │   └── machineController.js
│   │   ├── models/
│   │   │   ├── bagModel.js
│   │   │   ├── esp32DeviceModel.js
│   │   │   ├── patientModel.js
│   │   │   └── machineModel.js
│   │   └── db/
│   │       ├── mysql.js         # MySQL connection pool (local dev)
│   │       └── postgres.js      # PostgreSQL pool (alternative)
│   ├── schema.sql               # PostgreSQL schema
│   ├── schema-mysql.sql         # MySQL schema (used locally)
│   ├── schema-neon.sql          # Neon PostgreSQL schema (production)
│   ├── vercel.json              # Vercel routing config for BE
│   ├── package.json
│   └── .env                     # Local env vars (not committed)
│
├── FE/                          # Frontend – React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx             # App entry point
│   │   └── app/
│   │       ├── App.tsx          # Root component + router outlet
│   │       ├── routes.tsx       # React Router v7 route definitions
│   │       ├── types.ts         # Core TypeScript interfaces
│   │       ├── context/
│   │       │   └── IVBagContext.tsx   # Central state + API calls
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx      # Main monitoring view
│   │       │   ├── PatientDetails.tsx # Per-patient chart & history
│   │       │   ├── Patients.tsx       # Patient list
│   │       │   ├── History.tsx        # All bags history
│   │       │   ├── Reports.tsx        # Device maintenance queue
│   │       │   └── Login.tsx          # Login page (UI only)
│   │       ├── components/
│   │       │   ├── Esp32Card.tsx      # Primary monitoring card
│   │       │   ├── BagCard.tsx        # Bag-centric card view
│   │       │   ├── Layout.tsx         # App shell + sidebar
│   │       │   ├── AddDeviceModal.tsx
│   │       │   ├── AddBagModal.tsx
│   │       │   ├── AssignPatientModal.tsx
│   │       │   ├── EditPatientModal.tsx
│   │       │   └── ui/               # shadcn/ui component library
│   │       ├── lib/
│   │       │   └── utils.ts           # cn(), volume/time helpers
│   │       └── utils/
│   │           └── ivBagUtils.ts
│   ├── .env.development         # VITE_API_BASE for local
│   ├── .env.production          # VITE_API_BASE for production
│   ├── vite.config.ts
│   ├── vercel.json              # Vercel SPA routing config
│   └── package.json
│
├── README.md
├── CLAUDE.md                    # Agent-specific project notes
├── DEPLOY.md                    # Deployment step-by-step guide
├── ESP32-GUIDE.md               # ESP32 Arduino code & API guide
└── DOCUMENTATION.md             # ← this file
```

---

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router v7, Chart.js (react-chartjs-2), shadcn/ui, Lucide React, Sonner (toasts) |
| **Backend (local)** | Node.js, Express, mysql2/promise |
| **Backend (production)** | Vercel Serverless Functions, `@neondatabase/serverless` |
| **Database (local)** | MySQL 8+ |
| **Database (production)** | Neon (serverless PostgreSQL) |
| **IoT Device** | ESP32 (Arduino, WiFi, ArduinoJson, HTTPClient) |
| **Deployment** | Vercel (FE + BE), Neon (DB) |

---

## 5. Database Schema

There are two parallel schema files:
- `BE/schema-mysql.sql` — for local development with MySQL
- `BE/schema-neon.sql` — for production on Neon PostgreSQL

### `patients`
Stores hospital patient records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | Format: `p{timestamp}` |
| `name` | VARCHAR(255) NOT NULL | Full name |
| `room` | VARCHAR(50) | Room number |
| `bed` | VARCHAR(20) | Bed identifier |
| `age` | INT | Optional |
| `condition` | VARCHAR(255) | Medical condition |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto on update |

### `iv_bags`
Tracks each IV bag attached to a patient.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | Format: `b{timestamp}` |
| `patient_id` | VARCHAR(50) FK → patients | ON DELETE SET NULL |
| `esp32_id` | VARCHAR(100) | Linked ESP32 device |
| `type` | VARCHAR(50) | Fluid type label |
| `initial_volume` | DECIMAL(10,2) | Volume at start (ml) |
| `current_volume` | DECIMAL(10,2) | Live volume (ml) |
| `flow_rate` | DECIMAL(10,4) | Drops per minute |
| `status` | ENUM | `running`, `stopped`, `empty`, `completed` |
| `anomaly` | VARCHAR | `FAST_DRAIN` or NULL |
| `empty_timestamp` | TIMESTAMP NULL | Set when volume hits 0 |
| `start_time` | TIMESTAMP | Bag creation time |
| `updated_at` | TIMESTAMP | Last update |

Indexes: `patient_id`, `esp32_id`, `status`

### `bag_logs`
Time-series log entries for chart rendering.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT PK | |
| `bag_id` | VARCHAR(50) FK → iv_bags | ON DELETE CASCADE |
| `time` | TIMESTAMP | Log timestamp |
| `volume` | DECIMAL(10,2) | Volume at this moment |
| `flow_rate` | DECIMAL(10,4) | Flow rate at this moment |

Indexes: `bag_id`, `time`

### `esp32_devices`
Registry of known ESP32 devices.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | ESP32 MAC / custom ID |
| `registered_at` | TIMESTAMP | First seen |
| `last_seen_at` | TIMESTAMP | Updated each data send |
| `status` | ENUM | `online`, `offline`, `busy` |
| `current_bag_id` | VARCHAR(50) | Linked bag (Neon/production only) |

### `reported_machines`
Devices flagged for maintenance.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT PK | |
| `esp32_id` | VARCHAR(100) | Device ID |
| `room_bed` | VARCHAR(100) | Location info |
| `reported_at` | TIMESTAMP | When reported |
| `resolved_at` | TIMESTAMP NULL | When fixed |
| `status` | ENUM | `pending`, `resolved` |

---

## 6. Backend (BE)

The backend runs in two modes:
- **Local development**: Express server at `http://localhost:3001`, MySQL database
- **Production (Vercel)**: Single serverless function at `BE/api/index.js`, Neon PostgreSQL

### 6.1 Entry Point & Middleware

**`BE/src/index.js`** (local Express server):

- Loads `dotenv`, initialises Express
- CORS: allows `localhost:5173` and `localhost:3000` in development, configurable production origins
- JSON + URL-encoded body parsing
- `GET /health` → `{ status: 'ok', timestamp }`
- Mounts all API routes at `/api`
- 404 and error handlers
- Starts server on `PORT` env var (default `3001`)
- Imports `./db/mysql.js` which tests the MySQL connection on startup

### 6.2 Routes

**`BE/src/routes/index.js`** maps HTTP verbs + paths to controller methods:

```
Bags:
  GET    /bags                    → bagController.getAll
  GET    /bags/all                → bagController.getAllIncludingCompleted
  GET    /bags/:id                → bagController.getById
  GET    /bags/patient/:patientId → bagController.getByPatientId
  GET    /bags/:id/history        → bagController.getHistory
  GET    /bags/:id/export         → bagController.exportData
  POST   /bags                    → bagController.create
  PUT    /bags/:id                → bagController.update
  PUT    /bags/:id/status         → bagController.updateStatus
  DELETE /bags/:id                → bagController.delete
  GET    /bags/anomalies          → bagController.checkAnomalies

ESP32:
  GET    /esp32                   → esp32Controller.getAll
  GET    /esp32/:id               → esp32Controller.getById
  POST   /esp32/register          → esp32Controller.register
  POST   /esp32/update            → esp32Controller.update

Patients:
  GET    /patients                → patientController.getAll
  GET    /patients/:id            → patientController.getById
  POST   /patients                → patientController.create
  PUT    /patients/:id            → patientController.update
  DELETE /patients/:id            → patientController.delete

Machines:
  GET    /machines/reported       → machineController.getReported
  POST   /machines/report         → machineController.report
  PUT    /machines/:esp32Id/resolve → machineController.resolve
```

### 6.3 Controllers

#### `bagController.js`

| Method | Description |
|--------|-------------|
| `getAll` | Returns non-completed bags joined with patient info |
| `getAllIncludingCompleted` | Returns all bags with patient info |
| `getById` | Single bag by ID |
| `getByPatientId` | All bags for a patient |
| `getHistory` | Time-series log for Chart.js (limit via `?limit=N`, default 500) |
| `exportData` | Log export with optional `?startTime` / `?endTime` filters |
| `create` | Creates a new bag; requires `patientId`, `type`, `initialVolume`, `flowRate` |
| `update` | Partial update of `type`, `esp32Id`, `flowRate`, `status`, `currentVolume`, `emptyTimestamp` |
| `updateStatus` | Changes status to `running`, `stopped`, `empty`, or `completed` |
| `delete` | Removes a bag record |
| `checkAnomalies` | Scans all running bags for anomalies using recent logs |

#### `esp32Controller.js`

| Method | Description |
|--------|-------------|
| `getAll` | List all registered devices |
| `getById` | Single device |
| `register` | Manual registration of a device; calls `esp32DeviceModel.register()` |
| `update` | **Main ESP32 webhook** — auto-registers device, updates volume, detects anomaly, logs data |

The `update` webhook flow:
1. Validates `esp32_id`, `volume`, `flow_rate`
2. Calls `esp32DeviceModel.registerOrUpdate(esp32_id)` — creates device if new, updates `last_seen_at` if existing
3. Calls `bagModel.updateFromESP32(esp32_id, { volume, flow_rate })`
4. Returns `{ success, bag, anomaly }`

#### `patientController.js`

Standard CRUD: `getAll`, `getById`, `create`, `update`, `delete`. All backed by `patientModel`.

#### `machineController.js`

| Method | Description |
|--------|-------------|
| `getReported` | Returns all `pending` machine reports |
| `report` | Creates a new `reported_machines` record |
| `resolve` | Sets status to `resolved` + `resolved_at = NOW()` |

### 6.4 Models

#### `bagModel.js`

Key methods:

| Method | Description |
|--------|-------------|
| `findAllWithPatient()` | JOIN with patients, all bags |
| `findActiveWithPatient()` | JOIN with patients, status ≠ `completed` |
| `findByPatientId(id)` | Bags for one patient |
| `findById(id)` | Single bag |
| `findByEsp32Id(esp32Id)` | Active bag linked to an ESP32 |
| `create({ patientId, esp32Id, type, initialVolume, flowRate })` | Inserts bag, generates `b{timestamp}` ID |
| `update(id, fields)` | Dynamic partial update |
| `delete(id)` | Hard delete |
| `updateFromESP32(esp32Id, { volume, flowRate })` | Core IoT update: calculates anomaly, updates volume, sets empty/running status, writes log |
| `getHistoryLogs(bagId, limit)` | Fetch bag_logs for chart |
| `exportData(bagId, startTime, endTime)` | Filtered log export |
| `insertLog(bagId, { volume, flowRate })` | Append a bag_log row |
| `autoCompleteEmpty()` | Bulk UPDATE: `empty` → `completed` if empty for ≥ 3 min |
| `checkAllBagsForAnomalies()` | Full scan comparing last 2 logs for each running bag |

**Anomaly detection in `updateFromESP32`:**
```
expectedReductionPer5s = (flow_rate / 20 / 60) * 5  // ml expected in 5s
actualReduction = current_volume - new_volume
if (actualReduction > expectedReductionPer5s * 3 AND actualReduction > 10ml)
  → anomaly = 'FAST_DRAIN'
```

#### `esp32DeviceModel.js`

| Method | Description |
|--------|-------------|
| `findAll()` | All devices |
| `findById(id)` | Single device |
| `register(id)` | Insert new device with `status='online'`; returns existing if already present |
| `updateLastSeen(id)` | Set `last_seen_at = NOW()`, `status = 'online'` |
| `markOffline(id)` | Set `status = 'offline'` |
| `findOfflineDevices()` | Devices with `last_seen_at < NOW() - 30s` |
| `registerOrUpdate(id)` | Upsert: register if new, otherwise update last_seen |

#### `patientModel.js`

Standard CRUD. Patient IDs generated as `p{timestamp}`. Uses parameterized MySQL queries.

#### `machineModel.js`

| Method | Description |
|--------|-------------|
| `findReported()` | All `pending` machines |
| `report({ esp32Id, roomBed })` | Insert into `reported_machines` |
| `resolve(esp32Id)` | Update status → `resolved` |
| `delete(id)` | Hard delete |

### 6.5 Database Connections

**`BE/src/db/mysql.js`** (local):
- Creates a `mysql2/promise` connection pool
- Config from env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Defaults: `localhost:3306`, user `root`, DB `bme1_db`
- Runs `SELECT NOW()` on startup to verify connection
- Graceful shutdown on `SIGINT`

**`BE/api/_lib/db.js`** (production):
- Uses `@neondatabase/serverless` `sql` tagged template literal
- Config from env `DATABASE_URL` (Neon connection string)

### 6.6 Vercel Serverless Handler

**`BE/api/index.js`** is a single exported `handler(req, res)` function that:
- Sets CORS headers (`*`) on every response
- Parses `req.url` manually to route requests
- Uses `if (path === '...' && method === '...')` pattern (no Express)
- Uses `@neondatabase/serverless` `sql` tag for all queries
- Covers all the same endpoints as the Express router
- Additional production features:
  - `POST /api/bags` also updates `esp32_devices` to `busy` and sets `current_bag_id`
  - `PUT /api/bags/:id/status` releases ESP32 (`status='online'`, `current_bag_id=NULL`) when bag is `completed`/`cancelled`
  - `DELETE /api/bags/:id` also releases ESP32
  - `POST /api/esp32/register` — rejects with `409` if device is `busy`, otherwise upserts with `ON CONFLICT`
  - `POST /api/esp32/update` — enforces that device must be `busy` to send data (returns `403` if `online`)
  - `GET /api/esp32/available` — returns only `online` devices

**`BE/vercel.json`:**
```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index.js" }]
}
```

---

## 7. Frontend (FE)

### 7.1 Entry Point & Routing

**`FE/src/main.tsx`** renders `<App />` inside `<React.StrictMode>`.

**`FE/src/app/App.tsx`** wraps the app in `<IVBagProvider>` and renders the router.

**`FE/src/app/routes.tsx`** (React Router v7) defines:
```
/            → Dashboard
/patients    → Patients
/patient/:id → PatientDetails
/history     → History
/reports     → Reports
/login       → Login
```

All pages except `/login` are wrapped in `<Layout>` (sidebar + top bar).

**`FE/vercel.json`** rewrites all paths to `index.html` for SPA routing:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### 7.2 State Management – IVBagContext

**`FE/src/app/context/IVBagContext.tsx`** is the single source of truth for all application state.

#### Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| `API_BASE` | `VITE_API_BASE` or `https://bme-1.vercel.app/api` | API endpoint root |
| `MAX_HISTORY_ENTRIES` | 1000 | Cap on in-memory chart logs |
| `LOG_INTERVAL_MS` | 5000 ms | Frequency of local log entries (non-ESP32 bags) |
| `AUTO_COMPLETE_MS` | 180000 ms (3 min) | Auto-complete empty bags (non-ESP32) |
| `TICK_INTERVAL_MS` | 1000 ms | Simulation tick for non-ESP32 bags |
| `POLL_MS` | 5000 ms | Backend polling interval |

#### State
```typescript
patients: Patient[]
bags: IVBag[]
esp32Devices: Esp32Device[]
reportedMachines: ReportedMachine[]
isLoading: boolean
isConnected: boolean
```

#### Data Fetching

**`fetchAllData()`** — called on mount and every 5 s (while tab is visible):
- Parallel `Promise.all` to `/bags/all`, `/patients`, `/esp32`, `/machines/reported`
- Maps backend snake_case to frontend camelCase
- Derives `Esp32Device.patientId` and `bagId` by cross-referencing active bags (since `esp32_devices` table does not store these)
- Sets `isConnected = true` on success, `false` on error

**`fetchBagHistory(bagId, bagIndex)`** — called once per bag when `historyLogs.length === 0`:
- Fetches from `/bags/:id/history`
- Maps timestamps and volume/flowRate
- Injects into the matching bag's `historyLogs`

**Polling** — `setInterval(fetchAllData, 5000)` paused when `document.hidden`

#### Simulation Tick (non-ESP32 bags only)

Runs every second. For bags with no `esp32Id` and `status === 'running'`:
- Decrements `currentVolume` by `dropsToMlPerSec(flowRate)`
- Appends a log entry every 5 s
- Transitions to `empty` when volume ≤ 0
- Transitions from `empty` to `completed` after `AUTO_COMPLETE_MS`

#### Context API (exposed methods)

**Patient CRUD:**
- `addPatient(patient)` → POST `/patients` → returns new `id`
- `updatePatient(id, updates)` → PUT `/patients/:id`
- `deletePatient(id)` → DELETE `/patients/:id`

**Bag CRUD:**
- `addBag(bag)` → POST `/bags` → returns new `id`, seeds initial `historyLogs` entry
- `updateBag(id, updates)` → PUT `/bags/:id`
- `deleteBag(id)` → DELETE `/bags/:id`
- `changeBagStatus(id, status)` → PUT `/bags/:id/status`
- `completeBagManually(id, stopReason?)` → calls `changeBagStatus(id, 'completed')`

**ESP32 management:**
- `addEsp32(esp32Id)` → POST `/esp32/register`
- `assignPatientToEsp32(esp32Id, patientId, bagInfo?)` → calls `addBag()` then `fetchAllData()`
- `releaseEsp32(esp32Id)` → local state only (clears `patientId`/`bagId`)
- `moveToMaintenance(esp32Id)` → local state only (sets `maintenance: true`)
- `resolveMaintenance(esp32Id)` → local state only (clears `maintenance`)
- `removeEsp32(esp32Id)` → local state only (filters out)

**Machine reporting:**
- `reportMachine(esp32Id, roomBed)` → POST `/machines/report`
- `resolveMachine(esp32Id)` → PUT `/machines/:esp32Id/resolve`

**Other:**
- `refreshData()` → manual trigger of `fetchAllData()`

#### Type mapping helpers (backend → frontend)

| Helper | Converts |
|--------|---------|
| `mapBagFromBackend(b)` | snake_case DB row → `IVBag` (parses floats, timestamps, anomaly) |
| `mapPatientFromBackend(p)` | DB row → `Patient` |
| `mapEsp32FromBackend(d)` | DB row → `Esp32Device` (basic, without patientId/bagId) |
| `mapMachineFromBackend(m)` | DB row → `ReportedMachine` |

### 7.3 Pages

#### `Dashboard.tsx`

The main view. Shows all ESP32 devices (excluding those in maintenance) as a grid of `Esp32Card` components.

- **Stats bar**: total devices, running bags, "< 15 min" warnings, devices waiting for assignment
- **Search**: filters cards by device ID, patient name, or room/bed
- **Sort**: by time remaining (asc/desc) or volume (asc/desc); unassigned devices always sorted to the bottom
- **Modals**: "Thêm thiết bị" (`AddDeviceModal`), "Thêm bình truyền" (`AddBagModal`), assign patient (`AssignPatientModal`)
- Clicking an unassigned card opens `AssignPatientModal` with that device pre-selected
- Clicking an assigned card navigates to `/patient/:id`

#### `PatientDetails.tsx`

Shows full information for one patient.

- Fetches patient and all their bags from context
- Left column: clickable list of all bags (sorted newest first), showing type, date, status, initial volume
- Right column:
  - 4 quick-stat tiles: initial volume, volume infused, current flow rate, estimated time remaining
  - Chart.js dual-axis line chart:
    - Left Y-axis: volume (ml), 0 to `initialVolume * 1.05` rounded to nearest 50
    - Right Y-axis: flow rate (drops/min)
    - X-axis: time labels (`HH:MM`)
    - Flow rate is calculated from successive log entries (volume delta / time delta × 20 drops/ml × 60 s/min)
    - If bag status is `completed`, a final data point at 0 ml is appended
  - `EditPatientModal` accessible via pencil icon

#### `Patients.tsx`

Patient list with search. Links to each patient's detail page.

#### `History.tsx`

Shows all bags (including completed). Useful for auditing past infusions.

#### `Reports.tsx`

Shows devices currently in maintenance (`d.maintenance === true`).
- Each card shows device ID, last patient name, bag type / initial volume, and an "Đã sửa xong" button
- Clicking "Đã sửa xong" calls `resolveMaintenance(esp32Id)` + `resolveMachine(esp32Id)` + shows a toast
- After resolving, the device disappears from Reports and reappears on Dashboard

#### `Login.tsx`

UI-only login form. No authentication is implemented in the current version.

### 7.4 Components

#### `Esp32Card.tsx`

The primary card on the Dashboard for each ESP32 device.

**Visual states:**
| State | Border | Top bar |
|-------|--------|---------|
| No patient assigned | Dashed gray | Gray |
| Running (normal) | Gray | Green pulsing |
| Warning (< 50 ml or < 15 min) | Orange | Orange pulsing |
| Empty (volume = 0) | Red | Red pulsing |
| FAST_DRAIN anomaly | Red + red ring | Red pulsing |
| Offline | Grayed out, not clickable | — |

**Content when assigned:**
- Patient name, room/bed
- Bag fluid type + flow rate
- Current volume / initial volume
- Progress bar (blue → orange → red)
- Estimated time remaining
- Status badge: `Online` / `Busy` / `Offline`

**Action buttons:**
- Normal running/empty → "Kết thúc" (green): calls `completeBagManually` + `releaseEsp32`
- FAST_DRAIN anomaly → "Tạm dừng" (orange): calls `completeBagManually("ERROR")` + `reportMachine` + `moveToMaintenance`

**Edit**: pencil icon opens `EditPatientModal`

**Navigation**: clicking an assigned card navigates to `/patient/:id`

#### `BagCard.tsx`

Alternative bag-centric card (same visual logic as `Esp32Card` but centered on the bag object rather than the device). Used in Patients/History views. Adds Stop/Resume toggle button for non-anomaly bags.

#### `Layout.tsx`

App shell with responsive sidebar navigation and top bar.

#### `AddDeviceModal.tsx`

Form to register a new ESP32 by entering its ID. Calls `addEsp32(id)`.

#### `AddBagModal.tsx`

Form to create a new IV bag directly (without assigning to a specific ESP32 first). Fields: patient, ESP32 (optional), fluid type, initial volume, flow rate.

#### `AssignPatientModal.tsx`

Triggered when clicking an unassigned ESP32 card. Lets the nurse select a patient, fluid type, volume, and flow rate. Calls `assignPatientToEsp32()`.

#### `EditPatientModal.tsx`

Modal for editing patient info (name, room, bed, age, condition) and the linked bag's fluid type and flow rate. Calls `updatePatient()` and `updateBag()`.

#### `ui/` directory

Full shadcn/ui component library: accordion, alert, badge, button, calendar, card, chart, checkbox, dialog, dropdown, form, input, label, progress, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, tooltip, etc.

### 7.5 Types

**`FE/src/app/types.ts`**:

```typescript
interface Patient {
  id: string;
  name: string;
  room: string;
  bed: string;
  age?: number;
  condition?: string;
}

type BagStatus = "running" | "stopped" | "empty" | "completed";

interface Esp32Device {
  id: string;
  patientId?: string;      // derived from active bag
  bagId?: string;          // derived from active bag
  registeredAt: number;    // timestamp ms
  maintenance?: boolean;   // true = in maintenance, hidden from Dashboard
  status?: "online" | "offline" | "busy";
}

interface DataPoint {
  time: number;      // timestamp ms
  volume: number;    // ml
  flowRate: number;  // drops/min
}

interface ReportedMachine {
  esp32Id: string;
  reportedAt: number;
  roomBed?: string;
  status: "pending" | "resolved";
}

interface IVBag {
  id: string;
  patientId: string;
  esp32Id?: string;
  type: string;
  initialVolume: number;
  currentVolume: number;
  flowRate: number;        // drops/min
  startTime: number;       // timestamp ms
  status: BagStatus;
  emptyTimestamp?: number;
  historyLogs: DataPoint[];
  anomaly?: "FAST_DRAIN";
  stopReason?: "NORMAL" | "ERROR";
}
```

### 7.6 Utilities

**`FE/src/app/lib/utils.ts`**:

| Function | Description |
|----------|-------------|
| `cn(...inputs)` | `clsx` + `tailwind-merge` class combiner |
| `dropsToMlPerSec(dropsPerMin)` | `dropsPerMin / 20 / 60` — assumes 20 drops = 1 ml |
| `dropsToMlPerMin(dropsPerMin)` | `dropsPerMin / 20` |
| `calculateTimeRemainingInMinutes(volume, flowRate)` | `volume / (flowRate / 20)` |
| `formatTimeRemaining(minutes)` | Formats as `"Xh Ym"` or `"Ym"` or `"Hết"` |

---

## 8. API Reference

Base URL:
- Local: `http://localhost:3001/api`
- Production: `https://bme1-backend.vercel.app/api`

All endpoints return JSON. POST/PUT bodies must be `Content-Type: application/json`.

### Bags

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/bags` | — | Active (non-completed) bags with patient info |
| GET | `/bags/all` | — | All bags with patient info |
| GET | `/bags/:id` | — | Single bag |
| GET | `/bags/patient/:patientId` | — | All bags for a patient |
| GET | `/bags/:id/history` | — | Log entries (`?limit=N`) |
| GET | `/bags/:id/export` | — | Filtered logs (`?startTime=&endTime=`) |
| GET | `/bags/anomalies` | — | All active FAST_DRAIN anomalies |
| POST | `/bags` | `{ patientId, type, initialVolume, flowRate, esp32Id? }` | Create bag |
| PUT | `/bags/:id` | `{ type?, esp32Id?, flowRate?, status?, currentVolume?, emptyTimestamp? }` | Update bag fields |
| PUT | `/bags/:id/status` | `{ status }` | Change status (`running`/`stopped`/`empty`/`completed`) |
| DELETE | `/bags/:id` | — | Delete bag |

### Patients

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/patients` | — | All patients |
| GET | `/patients/:id` | — | Single patient |
| POST | `/patients` | `{ name, room, bed, age?, condition? }` | Create patient |
| PUT | `/patients/:id` | `{ name?, room?, bed?, age?, condition? }` | Update patient |
| DELETE | `/patients/:id` | — | Delete patient |

### ESP32 Devices

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/esp32` | — | All registered devices |
| GET | `/esp32/available` | — | Devices with `status='online'` (production) |
| GET | `/esp32/:id` | — | Single device |
| POST | `/esp32/register` | `{ esp32_id }` | Register/re-register device; `409` if busy |
| POST | `/esp32/update` | `{ esp32_id, volume, flow_rate }` | IoT webhook (every 5 s) |
| DELETE | `/esp32/:id` | — | Remove device (production) |

#### `POST /api/esp32/update` response

```json
{
  "success": true,
  "bag": { ...bag_row... },
  "anomaly": "FAST_DRAIN" | null
}
```

Error cases:
- `404` — ESP32 not registered
- `403` — ESP32 not assigned to a bag (`status !== 'busy'`)

### Machines

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/machines/reported` | — | All `pending` machine reports |
| POST | `/machines/report` | `{ esp32_id, room_bed? }` | Report a faulty device |
| PUT | `/machines/:esp32Id/resolve` | — | Mark device as fixed |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | `{ status: 'ok', timestamp }` |

---

## 9. ESP32 Integration

### Hardware Requirements
- ESP32 development board
- Ultrasonic distance sensor (HC-SR04) or water level sensor
- Optional: IR drop-counter sensor
- WiFi access to internet (for cloud BE) or local network (for local BE)

### Libraries Required (Arduino)
- `WiFi.h` (built-in)
- `HTTPClient.h` (built-in)
- `ArduinoJson.h` (install via Library Manager)

### Device Lifecycle

```
Power on
  └─► Connect WiFi
        └─► POST /api/esp32/register
              ├─ 201: device online → wait for assignment
              └─ 409: device already busy → resume sending data
                    └─► Loop every 5s: POST /api/esp32/update
                          └─ 200: data accepted, bag updated
                          └─ 403: not assigned, wait
                          └─ 404: not registered, re-register
```

### Key Configuration in Arduino Code

```cpp
#define DEVICE_ID "ESP001"       // Unique ID — change per device
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASS "YOUR_PASS"
#define API_BASE  "https://bme1-backend.vercel.app/api"
#define UPDATE_INTERVAL 5000     // 5 seconds
```

### Sensor to Volume Mapping

The HC-SR04 measures distance to the fluid surface. The mapping function (`mapDistanceToVolume`) needs calibration per bottle shape:

```cpp
// Example: 500ml bottle, sensor 3cm above full, 23cm above empty
float percent = (23 - distanceCm) / 20.0;  // 0=empty, 1=full
float volume = percent * 500;               // ml
```

### Testing Without Hardware

```bash
# Register device
curl -X POST https://bme1-backend.vercel.app/api/esp32/register \
  -H "Content-Type: application/json" \
  -d '{"esp32_id": "TEST001"}'

# Send data update (after assigning to a bag via FE)
curl -X POST https://bme1-backend.vercel.app/api/esp32/update \
  -H "Content-Type: application/json" \
  -d '{"esp32_id": "TEST001", "volume": 350, "flow_rate": 40}'
```

---

## 10. Business Logic & Key Workflows

### Creating & Starting a Drip

1. Nurse adds a patient (if new) via `AddDeviceModal` or the Patients page
2. Nurse adds a new bag via `AddBagModal` (selects patient, ESP32, fluid type, volume, flow rate)
3. `POST /api/bags` → bag created with `status='running'`
4. If ESP32 selected: `esp32_devices.status = 'busy'`, `current_bag_id = bag.id`
5. Dashboard shows a new `Esp32Card` with the patient and live data

### Normal Completion

1. Nurse clicks "Kết thúc" on a card
2. `completeBagManually(bag.id, 'NORMAL')` → `PUT /api/bags/:id/status` with `{ status: 'completed' }`
3. Backend frees ESP32: `status = 'online'`, `current_bag_id = NULL`
4. Card remains briefly then disappears from Dashboard on next poll (FE filters out completed bags from main view)

### Anomaly → Maintenance Flow

1. ESP32 sends data where volume drops > 3× the expected per-5s amount
2. Backend sets `iv_bags.anomaly = 'FAST_DRAIN'`
3. Next FE poll picks this up → card shows red border + "Tạm dừng" button
4. Nurse clicks "Tạm dừng":
   - `completeBagManually(bag.id, 'ERROR')` → bag completed
   - `reportMachine(esp32Id, roomBed)` → `POST /api/machines/report`
   - `moveToMaintenance(esp32Id)` → sets `device.maintenance = true` in local state
5. Device disappears from Dashboard, appears in Reports page
6. Tech fixes the device, nurse clicks "Đã sửa xong":
   - `resolveMaintenance(esp32Id)` → clears `maintenance` flag in local state
   - `resolveMachine(esp32Id)` → `PUT /api/machines/:esp32Id/resolve`
7. Device reappears on Dashboard as unassigned (`Online`)

### ESP32 Device Assignment

Devices appear on the Dashboard as soon as they call `POST /api/esp32/register`. They show as "Chờ gán" (waiting to be assigned). Clicking such a card opens `AssignPatientModal` where the nurse selects a patient and fills in bag details.

### Volume Warning Logic (Frontend)

Warnings are computed in the FE from live data:

```typescript
const isWarning = !hasAnomaly && !isEmpty && !isCompleted &&
  (bag.currentVolume <= 50 || timeRemainingMinutes <= 15);
```

- `< 50 ml` remaining → orange border
- `< 15 min` remaining → orange border
- Both trigger an orange pulsing top bar and orange `AlertCircle` icon

---

## 11. Anomaly Detection

Two detection layers:

### Backend (per ESP32 update)

In `bagModel.updateFromESP32()`:

```
expectedReductionPer5s = (flow_rate / 20 / 60) * 5
actualReduction = current_volume - new_volume
if actualReduction > expectedReductionPer5s × 3 AND actualReduction > 10ml
  → anomaly = 'FAST_DRAIN'
```

The `anomaly` field is persisted to the `iv_bags` table and returned in all bag queries.

### Backend (batch scan)

`bagModel.checkAllBagsForAnomalies()` — called via `GET /api/bags/anomalies`:

- Queries the last 2 log entries per bag
- Compares actual drop to expected drop
- Threshold: > 3× expected AND > 30 ml
- Returns severity: `HIGH` if > 5× expected, `MEDIUM` otherwise

### Frontend (non-ESP32 bags only)

The simulation tick in `IVBagContext` does not currently implement anomaly detection. Anomaly detection only runs on the backend for ESP32-linked bags.

### Visual Feedback

| Anomaly | Card border | Progress bar | Top bar |
|---------|-------------|--------------|---------|
| `FAST_DRAIN` | `border-red-400 ring-2 ring-red-200` | — | `bg-red-500 animate-pulse` |
| Low volume warning | `border-orange-300 ring-1` | `bg-orange-400` | `bg-orange-400 animate-pulse` |
| Empty | `border-red-300 ring-1` | `bg-red-500` | `bg-red-500 animate-pulse` |

---

## 12. Deployment

### Prerequisites
- Vercel account + Vercel CLI (`npm i -g vercel`)
- Neon account and project

### Step 1: Set up Neon Database

1. Create a new Neon project at https://neon.tech
2. Copy the connection string
3. Run the schema:
   ```bash
   psql "postgresql://user:pass@host/dbname" -f BE/schema-neon.sql
   ```

### Step 2: Deploy Backend

```bash
cd BE
vercel --prod
```

In Vercel Dashboard → **bme1-backend** → **Environment Variables**:
| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/bme1` |

### Step 3: Deploy Frontend

Update `FE/.env.production`:
```
VITE_API_BASE=https://bme1-backend.vercel.app/api
```

```bash
cd FE
vercel --prod
```

### Verify Deployment

```bash
# Health check
curl https://bme1-backend.vercel.app/api/health

# List devices
curl https://bme1-backend.vercel.app/api/esp32
```

### Update ESP32 Firmware

Update `API_BASE` in Arduino code:
```cpp
#define API_BASE "https://bme1-backend.vercel.app/api"
```

---

## 13. Local Development Setup

### Requirements
- Node.js 18+
- MySQL 8+

### Steps

```bash
# 1. Clone repo
git clone <repo-url>
cd BME1

# 2. Install all dependencies
npm run install:all

# 3. Create MySQL database
mysql -u root -p
CREATE DATABASE bme1_db;
EXIT;

# 4. Run schema
mysql -u root -p bme1_db < BE/schema-mysql.sql

# 5. Create BE/.env
echo "DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=bme1_db
PORT=3001" > BE/.env

# 6. Create FE/.env.development (should already exist)
# VITE_API_BASE=http://localhost:3001/api

# 7. Start backend (Terminal 1)
npm run dev:be
# Server at http://localhost:3001

# 8. Start frontend (Terminal 2)
npm run dev:fe
# App at http://localhost:5173
```

### NPM Scripts (root `package.json`)
| Script | Command |
|--------|---------|
| `npm run install:all` | Install FE and BE dependencies |
| `npm run dev:fe` | Start Vite dev server |
| `npm run dev:be` | Start Express server with nodemon |

---

## 14. Known Issues & Notes

### Dual Backend Code
The project maintains two parallel backend implementations:
- `BE/src/` — Express + MySQL (local dev)
- `BE/api/index.js` — Serverless + Neon (production)

Changes to business logic must be applied to **both** files to stay in sync.

### ESP32 `busy` Status
In local dev (`BE/src/`), `esp32_devices` does not have a `current_bag_id` column and the `status` transitions (`online` → `busy`) are not fully implemented in `esp32DeviceModel.js`. These features are only complete in the Vercel serverless handler. When using local dev, ESP32 registration and assignment works, but `busy` status tracking is limited.

### `ReportedMachine` Type Mismatch
`types.ts` defines `ReportedMachine.id` as missing (only `esp32Id`, `roomBed`, `status`, `reportedAt`), but the DB schema uses an auto-increment `id`. The `mapMachineFromBackend` helper uses `m.id` only for `esp32Id` fallback.

### Maintenance State is Local-Only
`moveToMaintenance()` and `resolveMaintenance()` only update React state — they do not call the backend. If the page is refreshed, maintenance state is lost and the device will reappear as normal on the Dashboard. To persist this, a `maintenance` or `status` column would need to be added to `esp32_devices`.

### No Authentication
The `/login` route exists as a UI placeholder only. There is no JWT, session, or authentication layer protecting any API endpoint.

### `bagController.exportData` Bug
The `exportData` controller contains leftover PostgreSQL `$1/$2` parameter placeholders in a comment block alongside the correct MySQL model call. The actual query executes correctly via `bagModel.exportData()` but the dead code should be cleaned up.

### History Logs Fetch Loop Risk
`IVBagContext` fetches history for every bag where `historyLogs.length === 0` in a `useEffect` that depends on `[bags]`. After each poll, newly received bags (with empty history) trigger history fetches; bags that already have history are skipped. This is correct but can cause many parallel requests on initial load if there are many bags.
