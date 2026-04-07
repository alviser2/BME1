import { pool } from '../db/postgres.js';

// ========== PATIENT MODEL ==========
export const patientModel = {
  async findAll() {
    const query = `SELECT * FROM patients ORDER BY created_at DESC`;
    return (await pool.query(query)).rows;
  },

  async findById(id) {
    const query = `SELECT * FROM patients WHERE id = $1`;
    return (await pool.query(query, [id])).rows[0];
  },

  async create({ name, roomBed, age, condition }) {
    const id = `p${Date.now()}`;
    const query = `
      INSERT INTO patients (id, name, room_bed, age, condition)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    return (await pool.query(query, [id, name, roomBed, age || null, condition || null])).rows[0];
  },

  async update(id, { name, roomBed, age, condition }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (roomBed !== undefined) { fields.push(`room_bed = $${idx++}`); values.push(roomBed); }
    if (age !== undefined) { fields.push(`age = $${idx++}`); values.push(age || null); }
    if (condition !== undefined) { fields.push(`condition = $${idx++}`); values.push(condition || null); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE patients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    return (await pool.query(query, values)).rows[0];
  },

  async delete(id) {
    const query = `DELETE FROM patients WHERE id = $1 RETURNING *`;
    return (await pool.query(query, [id])).rows[0];
  }
};
