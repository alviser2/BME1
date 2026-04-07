import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import './db/postgres.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== API ROUTES ==========
app.use('/api', routes);

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 BME1 Backend Server                            ║
║   📡 Running on: http://localhost:${PORT}              ║
║   📦 Environment: ${(process.env.NODE_ENV || 'development').padEnd(23)}║
╚═══════════════════════════════════════════════════════╝

📋 Available endpoints:
  GET    /health
  GET    /api/bags
  GET    /api/bags/all
  GET    /api/bags/:id
  GET    /api/bags/:id/history
  POST   /api/bags
  PUT    /api/bags/:id
  PUT    /api/bags/:id/status
  DELETE /api/bags/:id
  POST   /api/esp32/update
  GET    /api/patients
  POST   /api/patients
  PUT    /api/patients/:id
  DELETE /api/patients/:id
  GET    /api/machines/reported
  POST   /api/machines/report
  PUT    /api/machines/:esp32Id/resolve
  `);
});
