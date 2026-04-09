import { bagModel } from '../models/bagModel.js';

export const bagController = {
  // GET /bags - Lấy tất cả bags đang active
  async getAll(req, res) {
    try {
      const bags = await bagModel.findActiveWithPatient();
      res.json(bags);
    } catch (err) {
      console.error('Error getAll bags:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/all - Lấy tất cả bags (kể cả completed)
  async getAllIncludingCompleted(req, res) {
    try {
      const bags = await bagModel.findAllWithPatient();
      res.json(bags);
    } catch (err) {
      console.error('Error getAll bags:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/:id
  async getById(req, res) {
    try {
      const bag = await bagModel.findById(req.params.id);
      if (!bag) {
        return res.status(404).json({ error: 'Bag not found' });
      }
      res.json(bag);
    } catch (err) {
      console.error('Error getById bag:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/patient/:patientId - Lấy bags theo patient
  async getByPatientId(req, res) {
    try {
      const bags = await bagModel.findByPatientId(req.params.patientId);
      res.json(bags);
    } catch (err) {
      console.error('Error getByPatientId:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/:id/history - Lấy history logs cho chart
  async getHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 500;
      const logs = await bagModel.getHistoryLogs(req.params.id, limit);
      res.json(logs);
    } catch (err) {
      console.error('Error getHistory:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/:id/export - Export data (volume + flowRate) cho analysis
  async exportData(req, res) {
    try {
      const { startTime, endTime } = req.query;
      const data = await bagModel.exportData(
        req.params.id,
        startTime || null,
        endTime || null
      );

      // Parse dates if provided
      const params = [req.params.id];
      let query = `SELECT time, volume, flow_rate FROM bag_logs WHERE bag_id = $1`;
      if (startTime) {
        params.push(startTime);
        query += ` AND time >= $${params.length}`;
      }
      if (endTime) {
        params.push(endTime);
        query += ` AND time <= $${params.length}`;
      }
      query += ` ORDER BY time ASC`;

      res.json(data);
    } catch (err) {
      console.error('Error exportData:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /bags
  async create(req, res) {
    try {
      const { patientId, esp32Id, type, initialVolume, flowRate } = req.body;

      if (!patientId || !type || !initialVolume || !flowRate) {
        return res.status(400).json({ error: 'patientId, type, initialVolume, flowRate are required' });
      }

      const bag = await bagModel.create({ patientId, esp32Id, type, initialVolume, flowRate });
      res.status(201).json(bag);
    } catch (err) {
      console.error('Error create bag:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PUT /bags/:id
  async update(req, res) {
    try {
      const { type, esp32Id, flowRate, status, currentVolume, emptyTimestamp } = req.body;
      const bag = await bagModel.update(req.params.id, { type, esp32Id, flowRate, status, currentVolume, emptyTimestamp });

      if (!bag) {
        return res.status(404).json({ error: 'Bag not found' });
      }
      res.json(bag);
    } catch (err) {
      console.error('Error update bag:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PUT /bags/:id/status - Đổi status (stop/resume/complete)
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['running', 'stopped', 'empty', 'completed'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }

      const bag = await bagModel.update(req.params.id, { status });
      if (!bag) {
        return res.status(404).json({ error: 'Bag not found' });
      }
      res.json(bag);
    } catch (err) {
      console.error('Error updateStatus:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // DELETE /bags/:id
  async delete(req, res) {
    try {
      const bag = await bagModel.delete(req.params.id);
      if (!bag) {
        return res.status(404).json({ error: 'Bag not found' });
      }
      res.json({ message: 'Bag deleted', bag });
    } catch (err) {
      console.error('Error delete bag:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /esp32/update - ESP32 webhook để gửi data (5s一次)
  async esp32Update(req, res) {
    try {
      const { esp32_id, volume, flow_rate } = req.body;

      if (!esp32_id || volume === undefined || flow_rate === undefined) {
        return res.status(400).json({ error: 'esp32_id, volume, flow_rate are required' });
      }

      // Cập nhật bag từ ESP32 + kiểm tra bất thường
      const result = await bagModel.updateFromESP32(esp32_id, { volume, flow_rate });

      if (!result) {
        return res.status(404).json({ error: 'Bag not found or not running' });
      }

      const { bag, anomaly } = result;
      res.json({ success: true, bag, anomaly: anomaly || null });
    } catch (err) {
      console.error('Error esp32Update:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /bags/anomalies - Kiểm tra tất cả bags cho bất thường
  async checkAnomalies(req, res) {
    try {
      const anomalies = await bagModel.checkAllBagsForAnomalies();
      res.json({ anomalies });
    } catch (err) {
      console.error('Error checkAnomalies:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
