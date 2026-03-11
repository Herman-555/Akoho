const Database = require('../config/database');
const sql = Database.sql;

class Nutrition {
  static async findAllDetails(pool) {
    const result = await pool.request().query(
      `SELECT nd.id_nutrition_fille, nd.id_nutrition, nd.semaine, nd.variation_poids, nd.nourriture, n.id_race, r.nom_race
       FROM nutrition_detail nd
       JOIN nutrition n ON nd.id_nutrition = n.id_nutrition
       JOIN race r ON n.id_race = r.id_race
       ORDER BY r.nom_race, nd.semaine`
    );
    return result.recordset;
  }

  static async findDetailById(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT nd.id_nutrition_fille, nd.id_nutrition, nd.semaine, nd.variation_poids, nd.nourriture, n.id_race, r.nom_race
         FROM nutrition_detail nd
         JOIN nutrition n ON nd.id_nutrition = n.id_nutrition
         JOIN race r ON n.id_race = r.id_race
         WHERE nd.id_nutrition_fille = @id`
      );
    return result.recordset[0] || null;
  }

  static async findNutritionByRace(pool, id_race) {
    const result = await pool
      .request()
      .input('id_race', sql.Int, id_race)
      .query('SELECT id_nutrition FROM nutrition WHERE id_race = @id_race');
    return result.recordset[0] || null;
  }

  static async createNutritionHeader(pool, id_race) {
    const result = await pool
      .request()
      .input('id_race', sql.Int, id_race)
      .query('INSERT INTO nutrition (id_race) OUTPUT INSERTED.id_nutrition VALUES (@id_race)');
    return result.recordset[0];
  }

  static async createDetail(pool, { id_nutrition, semaine, variation_poids, nourriture }) {
    const result = await pool
      .request()
      .input('id_nutrition', sql.Int, id_nutrition)
      .input('semaine', sql.Int, semaine ?? null)
      .input('variation_poids', sql.Decimal(10, 2), variation_poids ?? null)
      .input('nourriture', sql.Decimal(10, 2), nourriture ?? null)
      .query(
        'INSERT INTO nutrition_detail (id_nutrition, semaine, variation_poids, nourriture) OUTPUT INSERTED.* VALUES (@id_nutrition, @semaine, @variation_poids, @nourriture)'
      );
    return result.recordset[0];
  }

  static async updateDetail(pool, id, { semaine, variation_poids, nourriture }) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('semaine', sql.Int, semaine ?? null)
      .input('variation_poids', sql.Decimal(10, 2), variation_poids ?? null)
      .input('nourriture', sql.Decimal(10, 2), nourriture ?? null)
      .query(
        'UPDATE nutrition_detail SET semaine=@semaine, variation_poids=@variation_poids, nourriture=@nourriture OUTPUT INSERTED.* WHERE id_nutrition_fille=@id'
      );
    return result.recordset[0] || null;
  }

  static async deleteDetail(pool, id) {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM nutrition_detail OUTPUT DELETED.* WHERE id_nutrition_fille=@id');
    return result.recordset[0] || null;
  }
}

module.exports = Nutrition;
