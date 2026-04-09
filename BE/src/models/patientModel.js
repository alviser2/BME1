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

  async create({ name, room, bed, age, condition }) {
    const id = `p${Date.now()}`;
    const query = `
      INSERT INTO patients (id, name, room, bed, age, condition)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    return (await pool.query(query, [id, name, room, bed, age || null, condition || null])).rows[0];
  },

  async update(id, { name, room, bed, age, condition }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (room !== undefined) { fields.push(`room = $${idx++}`); values.push(room); }
    if (bed !== undefined) { fields.push(`bed = $${idx++}`); values.push(bed); }
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
