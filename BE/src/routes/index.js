import { Router } from 'express';
import { bagController } from '../controllers/bagController.js';
import { patientController } from '../controllers/patientController.js';
import { machineController } from '../controllers/machineController.js';
import { esp32Controller } from '../controllers/esp32Controller.js';

const router = Router();

// ========== BAGS ==========
router.get('/bags', bagController.getAll);
router.get('/bags/all', bagController.getAllIncludingCompleted);
router.get('/bags/:id', bagController.getById);
router.get('/bags/patient/:patientId', bagController.getByPatientId);
router.get('/bags/:id/history', bagController.getHistory);
router.get('/bags/:id/export', bagController.exportData);
router.post('/bags', bagController.create);
router.put('/bags/:id', bagController.update);
router.put('/bags/:id/status', bagController.updateStatus);
router.delete('/bags/:id', bagController.delete);

// ========== ESP32 DEVICES ==========
router.get('/esp32', esp32Controller.getAll);
router.get('/esp32/:id', esp32Controller.getById);
router.post('/esp32/register', esp32Controller.register);
router.post('/esp32/update', esp32Controller.update); // ESP32 webhook (5s一次)

// ========== ANOMALY CHECK ==========
router.get('/bags/anomalies', bagController.checkAnomalies);

// ========== PATIENTS ==========
router.get('/patients', patientController.getAll);
router.get('/patients/:id', patientController.getById);
router.post('/patients', patientController.create);
router.put('/patients/:id', patientController.update);
router.delete('/patients/:id', patientController.delete);

// ========== MACHINES ==========
router.get('/machines/reported', machineController.getReported);
router.post('/machines/report', machineController.report);
router.put('/machines/:esp32Id/resolve', machineController.resolve);

export default router;
