const Database = require('../config/database');
const sql = Database.sql;

class Lot {
  static async findAll(pool) {
    const result = await pool.request().query(
      'SELECT l.*, r.nom_race FROM lot l LEFT JOIN race r ON l.id_race = r.id_race ORDER BY l.id_lot'
    );
    return result.recordset;
  }

  static async findById(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(
        'SELECT l.*, r.nom_race FROM lot l LEFT JOIN race r ON l.id_race = r.id_race WHERE l.id_lot = @id'
      );
    return result.recordset[0] || null;
  }

  static async create(pool, { id_race, age, date_creation, nbr_poulet, id_couverture, poids_initial }) {
    const result = await pool
      .request()
      .input('id_race', sql.Int, id_race ?? null)
      .input('age', sql.Int, age ?? null)
      .input('date_creation', sql.Date, date_creation ?? null)
      .input('nbr_poulet', sql.Int, nbr_poulet ?? null)
      .input('id_couverture', sql.Int, id_couverture ?? null)
      .input('poids_initial', sql.Decimal(10, 2), poids_initial ?? 0)
      .query(
        'INSERT INTO lot (id_race, age, date_creation, nbr_poulet, id_couverture, poids_initial) OUTPUT INSERTED.* VALUES (@id_race, @age, @date_creation, @nbr_poulet, @id_couverture, @poids_initial)'
      );
    return result.recordset[0];
  }

  static async update(pool, id, { id_race, age, date_creation, nbr_poulet, id_couverture, poids_initial }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('id_race', sql.Int, id_race ?? null)
      .input('age', sql.Int, age ?? null)
      .input('date_creation', sql.Date, date_creation ?? null)
      .input('nbr_poulet', sql.Int, nbr_poulet ?? null)
      .input('id_couverture', sql.Int, id_couverture ?? null)
      .input('poids_initial', sql.Decimal(10, 2), poids_initial ?? 0)
      .query(
        'UPDATE lot SET id_race=@id_race, age=@age, date_creation=@date_creation, nbr_poulet=@nbr_poulet, id_couverture=@id_couverture, poids_initial=@poids_initial OUTPUT INSERTED.* WHERE id_lot=@id'
      );
    return result.recordset[0] || null;
  }

  static async delete(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM lot OUTPUT DELETED.* WHERE id_lot=@id');
    return result.recordset[0] || null;
  }
}

module.exports = Lot;
