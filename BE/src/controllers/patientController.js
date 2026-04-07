import { patientModel } from '../models/patientModel.js';

export const patientController = {
  // GET /patients
  async getAll(req, res) {
    try {
      const patients = await patientModel.findAll();
      res.json(patients);
    } catch (err) {
      console.error('Error getAll patients:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /patients/:id
  async getById(req, res) {
    try {
      const patient = await patientModel.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      res.json(patient);
    } catch (err) {
      console.error('Error getById patient:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /patients
  async create(req, res) {
    try {
      const { name, roomBed, age, condition } = req.body;

      if (!name || !roomBed) {
        return res.status(400).json({ error: 'name and roomBed are required' });
      }

      const patient = await patientModel.create({ name, roomBed, age, condition });
      res.status(201).json(patient);
    } catch (err) {
      console.error('Error create patient:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PUT /patients/:id
  async update(req, res) {
    try {
      const { name, roomBed, age, condition } = req.body;
      const patient = await patientModel.update(req.params.id, { name, roomBed, age, condition });

      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      res.json(patient);
    } catch (err) {
      console.error('Error update patient:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // DELETE /patients/:id
  async delete(req, res) {
    try {
      const patient = await patientModel.delete(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      res.json({ message: 'Patient deleted', patient });
    } catch (err) {
      console.error('Error delete patient:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
