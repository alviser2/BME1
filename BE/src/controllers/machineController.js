import { machineModel } from '../models/machineModel.js';

export const machineController = {
  // GET /machines/reported
  async getReported(req, res) {
    try {
      const machines = await machineModel.findReported();
      res.json(machines);
    } catch (err) {
      console.error('Error getReported machines:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /machines/report
  async report(req, res) {
    try {
      const { esp32Id, roomBed } = req.body;

      if (!esp32Id || !roomBed) {
        return res.status(400).json({ error: 'esp32Id and roomBed are required' });
      }

      const machine = await machineModel.report({ esp32Id, roomBed });
      res.status(201).json(machine);
    } catch (err) {
      console.error('Error report machine:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PUT /machines/:esp32Id/resolve
  async resolve(req, res) {
    try {
      const machine = await machineModel.resolve(req.params.esp32Id);

      if (!machine) {
        return res.status(404).json({ error: 'No pending report found for this ESP32' });
      }
      res.json(machine);
    } catch (err) {
      console.error('Error resolve machine:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
