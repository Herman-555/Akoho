const Deces = require('../models/Deces');
const Database = require('../config/database');
const sql = Database.sql;

class DecesService {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    return Deces.findAll(this.pool);
  }

  async getById(id) {
    const deces = await Deces.findById(this.pool, id);
    if (!deces) {
      const err = new Error('Décès non trouvé');
      err.status = 404;
      throw err;
    }
    return deces;
  }

  async create(data) {
    const { id_lot, nbr_deces } = data;
    if (nbr_deces !== null && nbr_deces !== undefined && nbr_deces < 0) {
      const err = new Error('Le nombre de décès doit être positif ou nul');
      err.status = 400;
      throw err;
    }

    if (id_lot && nbr_deces > 0) {
      const lotResult = await this.pool
        .request()
        .input('id_lot', sql.Int, id_lot)
        .query('SELECT nbr_poulet FROM lot WHERE id_lot = @id_lot');

      if (!lotResult.recordset[0]) {
        const err = new Error('Lot non trouvé');
        err.status = 404;
        throw err;
      }

      const totalPoulets = lotResult.recordset[0].nbr_poulet;

      const decesResult = await this.pool
        .request()
        .input('id_lot', sql.Int, id_lot)
        .query('SELECT COALESCE(SUM(nbr_deces), 0) as total_deces FROM deces WHERE id_lot = @id_lot');

      const decesCumules = decesResult.recordset[0].total_deces;
      const restants = totalPoulets - decesCumules;

      if (nbr_deces > restants) {
        const err = new Error(`Le nombre de décès (${nbr_deces}) dépasse le nombre de poulets restants (${restants}) pour ce lot`);
        err.status = 400;
        throw err;
      }
    }

    return Deces.create(this.pool, data);
  }

  async update(id, data) {
    const { nbr_deces } = data;
    if (nbr_deces !== null && nbr_deces !== undefined && nbr_deces < 0) {
      const err = new Error('Le nombre de décès doit être positif ou nul');
      err.status = 400;
      throw err;
    }
    const deces = await Deces.update(this.pool, id, data);
    if (!deces) {
      const err = new Error('Décès non trouvé');
      err.status = 404;
      throw err;
    }
    return deces;
  }

  async delete(id) {
    const deces = await Deces.delete(this.pool, id);
    if (!deces) {
      const err = new Error('Décès non trouvé');
      err.status = 404;
      throw err;
    }
    return { message: 'Décès supprimé' };
  }
}

module.exports = DecesService;
