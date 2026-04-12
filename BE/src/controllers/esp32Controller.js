import { esp32DeviceModel } from '../models/esp32DeviceModel.js';
import { bagModel } from '../models/bagModel.js';

export const esp32Controller = {
  // GET /esp32 - Lấy tất cả ESP32 devices
  async getAll(req, res) {
    try {
      const devices = await esp32DeviceModel.findAll();
      res.json(devices);
    } catch (err) {
      console.error('Error getAll esp32:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /esp32/:id - Lấy ESP32 theo ID
  async getById(req, res) {
    try {
      const device = await esp32DeviceModel.findById(req.params.id);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      res.json(device);
    } catch (err) {
      console.error('Error getById esp32:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /esp32/update - ESP32 webhook (5s一次)
  // Auto register device nếu chưa có, update last_seen
  async update(req, res) {
    try {
      const { esp32_id, volume, flow_rate } = req.body;

      if (!esp32_id || volume === undefined || flow_rate === undefined) {
        return res.status(400).json({ error: 'esp32_id, volume, flow_rate are required' });
      }

      // Auto register ESP32 nếu chưa có, update last_seen
      await esp32DeviceModel.registerOrUpdate(esp32_id);

      // Cập nhật bag từ ESP32 + kiểm tra bất thường
      const result = await bagModel.updateFromESP32(esp32_id, { volume, flow_rate });

      if (!result) {
        // ESP32 đã register nhưng chưa gán bệnh nhân
        return res.status(404).json({
          error: 'Bag not found or not assigned to this ESP32',
          esp32_id,
          registered: true
        });
      }

      const { bag, anomaly } = result;
      res.json({ success: true, bag, anomaly: anomaly || null });
    } catch (err) {
      console.error('Error esp32Update:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /esp32/register - Đăng ký ESP32 thủ công
  async register(req, res) {
    try {
      const { esp32_id } = req.body;

      if (!esp32_id) {
        return res.status(400).json({ error: 'esp32_id is required' });
      }

      const device = await esp32DeviceModel.register(esp32_id);
      res.status(201).json(device);
    } catch (err) {
      console.error('Error register esp32:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
