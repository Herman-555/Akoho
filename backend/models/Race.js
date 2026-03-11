const Database = require('../config/database');
const sql = Database.sql;

class Race {
  static async findAll(pool) {
    const result = await pool.request().query('SELECT * FROM race');
    return result.recordset;
  }

  static async findById(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM race WHERE id_race = @id');
    return result.recordset[0] || null;
  }

  static async create(pool, { nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture }) {
    const result = await pool
      .request()
      .input('nom_race', sql.VarChar(255), nom_race ?? null)
      .input('prix_achat', sql.Decimal(10, 2), prix_achat ?? null)
      .input('prix_vente', sql.Decimal(10, 2), prix_vente ?? null)
      .input('prix_oeuf', sql.Decimal(10, 2), prix_oeuf ?? null)
      .input('prix_nourriture', sql.Decimal(10, 2), prix_nourriture ?? null)
      .query(
        'INSERT INTO race (nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture) OUTPUT INSERTED.* VALUES (@nom_race, @prix_achat, @prix_vente, @prix_oeuf, @prix_nourriture)'
      );
    return result.recordset[0];
  }

  static async update(pool, id, { nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('nom_race', sql.VarChar(255), nom_race ?? null)
      .input('prix_achat', sql.Decimal(10, 2), prix_achat ?? null)
      .input('prix_vente', sql.Decimal(10, 2), prix_vente ?? null)
      .input('prix_oeuf', sql.Decimal(10, 2), prix_oeuf ?? null)
      .input('prix_nourriture', sql.Decimal(10, 2), prix_nourriture ?? null)
      .query(
        'UPDATE race SET nom_race=@nom_race, prix_achat=@prix_achat, prix_vente=@prix_vente, prix_oeuf=@prix_oeuf, prix_nourriture=@prix_nourriture OUTPUT INSERTED.* WHERE id_race=@id'
      );
    return result.recordset[0] || null;
  }

  static async delete(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM race OUTPUT DELETED.* WHERE id_race=@id');
    return result.recordset[0] || null;
  }
}

module.exports = Race;
