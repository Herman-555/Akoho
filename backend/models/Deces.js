const Database = require('../config/database');
const sql = Database.sql;

class Deces {
  static async findAll(pool) {
    const result = await pool.request().query(
      `SELECT d.*, l.nbr_poulet, r.nom_race,
              r.male, r.femelle, r.deces_male, r.deces_femelle, l.id_couverture
       FROM deces d
       JOIN lot l ON d.id_lot = l.id_lot
       JOIN race r ON l.id_race = r.id_race
       ORDER BY d.date_deces DESC, d.id_deces`
    );
    return result.recordset;
  }

  static async findById(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT d.*, l.nbr_poulet, r.nom_race,
                r.male, r.femelle, r.deces_male, r.deces_femelle, l.id_couverture
         FROM deces d
         JOIN lot l ON d.id_lot = l.id_lot
         JOIN race r ON l.id_race = r.id_race
         WHERE d.id_deces = @id`
      );
    return result.recordset[0] || null;
  }

  static async create(pool, { id_lot, date_deces, nbr_deces }) {
    const result = await pool
      .request()
      .input('id_lot', sql.Int, id_lot ?? null)
      .input('date_deces', sql.Date, date_deces ?? null)
      .input('nbr_deces', sql.Int, nbr_deces ?? null)
      .query(
        'INSERT INTO deces (id_lot, date_deces, nbr_deces) OUTPUT INSERTED.* VALUES (@id_lot, @date_deces, @nbr_deces)'
      );
    return result.recordset[0];
  }

  static async update(pool, id, { id_lot, date_deces, nbr_deces }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('id_lot', sql.Int, id_lot ?? null)
      .input('date_deces', sql.Date, date_deces ?? null)
      .input('nbr_deces', sql.Int, nbr_deces ?? null)
      .query(
        'UPDATE deces SET id_lot=@id_lot, date_deces=@date_deces, nbr_deces=@nbr_deces OUTPUT INSERTED.* WHERE id_deces=@id'
      );
    return result.recordset[0] || null;
  }

  static async delete(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM deces OUTPUT DELETED.* WHERE id_deces=@id');
    return result.recordset[0] || null;
  }
}

module.exports = Deces;
