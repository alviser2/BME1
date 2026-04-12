import { pool } from '../db/mysql.js';

// ========== PATIENT MODEL (MySQL) ==========
export const patientModel = {
  async findAll() {
    const query = `SELECT * FROM patients ORDER BY created_at DESC`;
    const [rows] = await pool.query(query);
    return rows;
  },

  async findById(id) {
    const query = `SELECT * FROM patients WHERE id = ?`;
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  },

  async create({ name, room, bed, age, condition }) {
    const id = `p${Date.now()}`;
    const query = `
      INSERT INTO patients (id, name, room, bed, age, \`condition\`)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.query(query, [id, name, room, bed, age || null, condition || null]);
    return this.findById(id);
  },

  async update(id, { name, room, bed, age, condition }) {
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (room !== undefined) { fields.push('room = ?'); values.push(room); }
    if (bed !== undefined) { fields.push('bed = ?'); values.push(bed); }
    if (age !== undefined) { fields.push('age = ?'); values.push(age || null); }
    if (condition !== undefined) { fields.push('\`condition\` = ?'); values.push(condition || null); }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(query, values);
    return this.findById(id);
  },

  async delete(id) {
    const query = `DELETE FROM patients WHERE id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0 ? { id } : null;
  }
};
