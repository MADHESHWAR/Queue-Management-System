const { getPool } = require('../config/db');

const Token = {
  // Helper to map DB row to standard format (with id and string _id)
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      _id: row.id.toString(),
      tokenNumber: row.tokenNumber,
      customerName: row.customerName,
      status: row.status,
      createdAt: row.createdAt
    };
  },

  async findLast() {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM tokens ORDER BY tokenNumber DESC LIMIT 1');
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  },

  async create(tokenNumber, customerName) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO tokens (tokenNumber, customerName, status) VALUES (?, ?, ?)',
      [tokenNumber, customerName, 'Waiting']
    );
    const [rows] = await pool.query('SELECT * FROM tokens WHERE id = ?', [result.insertId]);
    return this.mapRow(rows[0]);
  },

  async countWaitingAhead(tokenNumber) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM tokens WHERE status = ? AND tokenNumber < ?',
      ['Waiting', tokenNumber]
    );
    return rows[0].count;
  },

  async findAll() {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM tokens ORDER BY tokenNumber ASC');
    return rows.map(r => this.mapRow(r));
  },

  async findById(id) {
    const pool = getPool();
    // Convert parameter to integer to prevent type mismatch in query
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    const [rows] = await pool.query('SELECT * FROM tokens WHERE id = ?', [numId]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  },

  async findCurrentServing() {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM tokens WHERE status = ? ORDER BY tokenNumber DESC LIMIT 1',
      ['Serving']
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  },

  async findUpcoming(limit = 5) {
    const pool = getPool();
    const sanitizedLimit = parseInt(limit, 10) || 5;
    const [rows] = await pool.query(
      `SELECT * FROM tokens WHERE status = ? ORDER BY tokenNumber ASC LIMIT ${sanitizedLimit}`,
      ['Waiting']
    );
    return rows.map(r => this.mapRow(r));
  },

  async countWaiting() {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM tokens WHERE status = ?',
      ['Waiting']
    );
    return rows[0].count;
  },

  async completeAllServing() {
    const pool = getPool();
    await pool.query(
      'UPDATE tokens SET status = ? WHERE status = ?',
      ['Completed', 'Serving']
    );
  },

  async findFirstWaiting() {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM tokens WHERE status = ? ORDER BY tokenNumber ASC LIMIT 1',
      ['Waiting']
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  },

  async updateStatus(id, status) {
    const pool = getPool();
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    await pool.query(
      'UPDATE tokens SET status = ? WHERE id = ?',
      [status, numId]
    );
    return this.findById(numId);
  },

  async deleteAll() {
    const pool = getPool();
    await pool.query('TRUNCATE TABLE tokens');
  }
};

module.exports = Token;
