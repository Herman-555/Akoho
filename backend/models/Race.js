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

  static async create(pool, { nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture, male, femelle, nb_jours_eclosion, capacite_ponte, oeufs_pourris, deces_male, deces_femelle }) {
    const result = await pool
      .request()
      .input('nom_race', sql.VarChar(255), nom_race ?? null)
      .input('prix_achat', sql.Decimal(10, 2), prix_achat ?? null)
      .input('prix_vente', sql.Decimal(10, 2), prix_vente ?? null)
      .input('prix_oeuf', sql.Decimal(10, 2), prix_oeuf ?? null)
      .input('prix_nourriture', sql.Decimal(10, 2), prix_nourriture ?? null)
      .input('male', sql.Decimal(5, 2), male ?? null)
      .input('femelle', sql.Decimal(5, 2), femelle ?? null)
      .input('nb_jours_eclosion', sql.Int, nb_jours_eclosion ?? null)
      .input('capacite_ponte', sql.Int, capacite_ponte ?? null)
      .input('oeufs_pourris', sql.Decimal(5, 2), oeufs_pourris ?? null)
      .input('deces_male', sql.Decimal(5, 2), deces_male ?? 50)
      .input('deces_femelle', sql.Decimal(5, 2), deces_femelle ?? 50)
      .query(
        'INSERT INTO race (nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture, male, femelle, nb_jours_eclosion, capacite_ponte, oeufs_pourris, deces_male, deces_femelle) OUTPUT INSERTED.* VALUES (@nom_race, @prix_achat, @prix_vente, @prix_oeuf, @prix_nourriture, @male, @femelle, @nb_jours_eclosion, @capacite_ponte, @oeufs_pourris, @deces_male, @deces_femelle)'
      );
    return result.recordset[0];
  }

  static async update(pool, id, { nom_race, prix_achat, prix_vente, prix_oeuf, prix_nourriture, male, femelle, nb_jours_eclosion, capacite_ponte, oeufs_pourris, deces_male, deces_femelle }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('nom_race', sql.VarChar(255), nom_race ?? null)
      .input('prix_achat', sql.Decimal(10, 2), prix_achat ?? null)
      .input('prix_vente', sql.Decimal(10, 2), prix_vente ?? null)
      .input('prix_oeuf', sql.Decimal(10, 2), prix_oeuf ?? null)
      .input('prix_nourriture', sql.Decimal(10, 2), prix_nourriture ?? null)
      .input('male', sql.Decimal(5, 2), male ?? null)
      .input('femelle', sql.Decimal(5, 2), femelle ?? null)
      .input('nb_jours_eclosion', sql.Int, nb_jours_eclosion ?? null)
      .input('capacite_ponte', sql.Int, capacite_ponte ?? null)
      .input('oeufs_pourris', sql.Decimal(5, 2), oeufs_pourris ?? null)
      .input('deces_male', sql.Decimal(5, 2), deces_male ?? 50)
      .input('deces_femelle', sql.Decimal(5, 2), deces_femelle ?? 50)
      .query(
        'UPDATE race SET nom_race=@nom_race, prix_achat=@prix_achat, prix_vente=@prix_vente, prix_oeuf=@prix_oeuf, prix_nourriture=@prix_nourriture, male=@male, femelle=@femelle, nb_jours_eclosion=@nb_jours_eclosion, capacite_ponte=@capacite_ponte, oeufs_pourris=@oeufs_pourris, deces_male=@deces_male, deces_femelle=@deces_femelle OUTPUT INSERTED.* WHERE id_race=@id'
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
