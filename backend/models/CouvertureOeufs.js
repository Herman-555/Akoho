const Database = require('../config/database');
const sql = Database.sql;

class CouvertureOeufs {
  static async findAll(pool) {
    const result = await pool.request().query(
      `SELECT co.*, o.nbr_oeufs AS total_oeufs, o.date_recensement AS date_lot_oeufs, r.nom_race, l.id_race
       FROM couverture_oeufs co
       JOIN oeufs o ON co.id_lot_oeufs = o.id_lot_oeufs
       JOIN lot l ON o.id_lot = l.id_lot
       JOIN race r ON l.id_race = r.id_race
       ORDER BY co.id_couverture`
    );
    return result.recordset;
  }

  static async findOeufsWithRace(pool, id_lot_oeufs) {
    const result = await pool
      .request()
      .input('id_lot_oeufs', sql.Int, id_lot_oeufs)
      .query(
        'SELECT o.*, l.id_race FROM oeufs o JOIN lot l ON o.id_lot = l.id_lot WHERE o.id_lot_oeufs = @id_lot_oeufs'
      );
    return result.recordset[0] || null;
  }

  static async countByLotOeufs(pool, id_lot_oeufs) {
    const result = await pool
      .request()
      .input('id_lot_oeufs', sql.Int, id_lot_oeufs)
      .query('SELECT COUNT(*) AS cnt FROM couverture_oeufs WHERE id_lot_oeufs = @id_lot_oeufs');
    return result.recordset[0].cnt;
  }

  static async create(pool, { id_lot_oeufs, nbr_oeufs, date_couverture }) {
    const result = await pool
      .request()
      .input('ilo', sql.Int, id_lot_oeufs)
      .input('nbr', sql.Int, nbr_oeufs)
      .input('dc', sql.Date, date_couverture)
      .query(
        'INSERT INTO couverture_oeufs (id_lot_oeufs, nbr_oeufs, date_couverture) OUTPUT INSERTED.* VALUES (@ilo, @nbr, @dc)'
      );
    return result.recordset[0];
  }
}

module.exports = CouvertureOeufs;
