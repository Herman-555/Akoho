const Database = require('../config/database');
const sql = Database.sql;

class EclosionOeufs {
  static async findAll(pool) {
    const result = await pool.request().query(
      `SELECT e.*, co.nbr_oeufs AS total_oeufs_couverture, co.date_couverture, r.nom_race, l.id_race
       FROM eclosion_oeufs e
       JOIN couverture_oeufs co ON e.id_couverture = co.id_couverture
       JOIN oeufs o ON e.id_lot_oeufs = o.id_lot_oeufs
       JOIN lot l ON o.id_lot = l.id_lot
       JOIN race r ON l.id_race = r.id_race
       ORDER BY e.id_eclosion`
    );
    return result.recordset;
  }

  static async findCouvertureWithRace(pool, id_couverture) {
    const result = await pool
      .request()
      .input('id_couverture', sql.Int, id_couverture)
      .query(
        `SELECT co.*, o.id_lot, l.id_race
         FROM couverture_oeufs co
         JOIN oeufs o ON co.id_lot_oeufs = o.id_lot_oeufs
         JOIN lot l ON o.id_lot = l.id_lot
         WHERE co.id_couverture = @id_couverture`
      );
    return result.recordset[0] || null;
  }

  static async countByCouverture(pool, id_couverture) {
    const result = await pool
      .request()
      .input('id_couverture', sql.Int, id_couverture)
      .query('SELECT COUNT(*) AS cnt FROM eclosion_oeufs WHERE id_couverture = @id_couverture');
    return result.recordset[0].cnt;
  }

  static async create(pool, { date_eclosion, nbr_oeufs_eclos, id_couverture, id_lot_oeufs, nbr_oeufs_pourris }) {
    const result = await pool
      .request()
      .input('de', sql.Date, date_eclosion)
      .input('noe', sql.Int, nbr_oeufs_eclos)
      .input('ic', sql.Int, id_couverture)
      .input('ilo', sql.Int, id_lot_oeufs)
      .input('nop', sql.Int, nbr_oeufs_pourris)
      .query(
        'INSERT INTO eclosion_oeufs (date_eclosion, nbr_oeufs_eclos, id_couverture, id_lot_oeufs, nbr_oeufs_pourris) OUTPUT INSERTED.* VALUES (@de, @noe, @ic, @ilo, @nop)'
      );
    return result.recordset[0];
  }
}

module.exports = EclosionOeufs;
