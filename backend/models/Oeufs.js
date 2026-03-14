const Database = require('../config/database');
const sql = Database.sql;

class Oeufs {
  static async findAll(pool) {
    const result = await pool.request().query(
      `SELECT o.*, l.id_race, r.nom_race, l.nbr_poulet,
        CASE WHEN EXISTS (SELECT 1 FROM couverture_oeufs co WHERE co.id_lot_oeufs = o.id_lot_oeufs) THEN 1 ELSE 0 END AS couvert
       FROM oeufs o
       JOIN lot l ON o.id_lot = l.id_lot
       JOIN race r ON l.id_race = r.id_race
       ORDER BY o.id_lot_oeufs`
    );
    return result.recordset;
  }

  static async findById(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT o.*, l.id_race, r.nom_race, l.nbr_poulet,
          CASE WHEN EXISTS (SELECT 1 FROM couverture_oeufs co WHERE co.id_lot_oeufs = o.id_lot_oeufs) THEN 1 ELSE 0 END AS couvert
         FROM oeufs o
         JOIN lot l ON o.id_lot = l.id_lot
         JOIN race r ON l.id_race = r.id_race
         WHERE o.id_lot_oeufs = @id`
      );
    return result.recordset[0] || null;
  }

  static async create(pool, { id_lot, date_recensement, nbr_oeufs }) {
    const result = await pool
      .request()
      .input('id_lot', sql.Int, id_lot ?? null)
      .input('date_recensement', sql.Date, date_recensement ?? null)
      .input('nbr_oeufs', sql.Int, nbr_oeufs ?? null)
      .query(
        'INSERT INTO oeufs (id_lot, date_recensement, nbr_oeufs) OUTPUT INSERTED.* VALUES (@id_lot, @date_recensement, @nbr_oeufs)'
      );
    return result.recordset[0];
  }

  static async update(pool, id, { id_lot, date_recensement, nbr_oeufs }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('id_lot', sql.Int, id_lot ?? null)
      .input('date_recensement', sql.Date, date_recensement ?? null)
      .input('nbr_oeufs', sql.Int, nbr_oeufs ?? null)
      .query(
        'UPDATE oeufs SET id_lot=@id_lot, date_recensement=@date_recensement, nbr_oeufs=@nbr_oeufs OUTPUT INSERTED.* WHERE id_lot_oeufs=@id'
      );
    return result.recordset[0] || null;
  }

  static async delete(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM oeufs OUTPUT DELETED.* WHERE id_lot_oeufs=@id');
    return result.recordset[0] || null;
  }

  // Méthode pour obtenir les œufs non éclos (estimation)
  static async findNonEclos(pool) {
    const result = await pool.request().query(
      `SELECT o.*, l.id_race, r.nom_race, r.nb_jours_eclosion,
        co.id_couverture, co.date_couverture,
        DATEADD(day, r.nb_jours_eclosion - 1, co.date_couverture) AS date_eclosion_prevue,
        CASE
          WHEN co.id_couverture IS NULL THEN 'Non couvert'
          WHEN ee.id_eclosion IS NOT NULL THEN 'Éclos'
          WHEN DATEADD(day, r.nb_jours_eclosion - 1, co.date_couverture) <= GETDATE() THEN 'Éclosion prévue'
          ELSE 'En couverture'
        END AS statut
       FROM oeufs o
       JOIN lot l ON o.id_lot = l.id_lot
       JOIN race r ON l.id_race = r.id_race
       LEFT JOIN couverture_oeufs co ON o.id_lot_oeufs = co.id_lot_oeufs
       LEFT JOIN eclosion_oeufs ee ON co.id_couverture = ee.id_couverture
       WHERE ee.id_eclosion IS NULL
       ORDER BY o.date_recensement DESC`
    );
    return result.recordset;
  }
}

module.exports = Oeufs;
