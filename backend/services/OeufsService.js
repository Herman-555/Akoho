const Oeufs = require('../models/Oeufs');
const CouvertureOeufs = require('../models/CouvertureOeufs');
const EclosionOeufs = require('../models/EclosionOeufs');
const Lot = require('../models/Lot');
const sql = require('../config/database').sql;

class OeufsService {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    return Oeufs.findAll(this.pool);
  }

  async getById(id) {
    const oeufs = await Oeufs.findById(this.pool, id);
    if (!oeufs) {
      const err = new Error("Lot d'oeufs non trouvé");
      err.status = 404;
      throw err;
    }
    return oeufs;
  }

  async create(data) {
    const { id_lot, nbr_oeufs, date_recensement } = data;
    if (nbr_oeufs !== null && nbr_oeufs !== undefined && nbr_oeufs < 0) {
      const err = new Error("Le nombre d'oeufs doit être positif");
      err.status = 400;
      throw err;
    }

    // Validation de la capacité de ponte
    if (id_lot && nbr_oeufs) {
      await this.validateCapacitePonte(id_lot, nbr_oeufs, date_recensement);
    }

    // 1. Créer le lot d'œufs
    const oeufs = await Oeufs.create(this.pool, data);

    // Chaîne automatique : couverture → éclosion → nouveau lot
    if (date_recensement && oeufs) {
      try {
        // 2. Créer la couverture (lendemain de la date de recensement)
        const dateCouverture = new Date(date_recensement);
        dateCouverture.setDate(dateCouverture.getDate() + 1);

        const couverture = await CouvertureOeufs.create(this.pool, {
          id_lot_oeufs: oeufs.id_lot_oeufs,
          nbr_oeufs: oeufs.nbr_oeufs,
          date_couverture: dateCouverture
        });

        if (couverture) {
          // Récupérer les infos de la race (nb_jours_eclosion, oeufs_pourris)
          const raceResult = await this.pool
            .request()
            .input('id_lot', sql.Int, id_lot)
            .query(`
              SELECT r.id_race, r.nb_jours_eclosion, r.oeufs_pourris
              FROM lot l JOIN race r ON l.id_race = r.id_race
              WHERE l.id_lot = @id_lot
            `);

          const race = raceResult.recordset[0];
          if (race && race.nb_jours_eclosion) {
            // 3. Calculer la date d'éclosion et les nombres
            const dateEclosion = new Date(dateCouverture);
            dateEclosion.setDate(dateEclosion.getDate() + race.nb_jours_eclosion - 1);

            const tauxPourris = race.oeufs_pourris || 0;
            const nbrOeufsPourris = Math.round((oeufs.nbr_oeufs * tauxPourris) / 100);
            const nbrOeufsEclos = Math.max(0, oeufs.nbr_oeufs - nbrOeufsPourris);

            // Créer l'éclosion
            const eclosion = await EclosionOeufs.create(this.pool, {
              date_eclosion: dateEclosion,
              nbr_oeufs_eclos: nbrOeufsEclos,
              id_couverture: couverture.id_couverture,
              id_lot_oeufs: couverture.id_lot_oeufs,
              nbr_oeufs_pourris: nbrOeufsPourris
            });

            // 4. Créer le nouveau lot de poussins
            if (nbrOeufsEclos > 0) {
              await Lot.create(this.pool, {
                id_race: race.id_race,
                age: 0,
                date_creation: dateEclosion,
                nbr_poulet: nbrOeufsEclos,
                id_couverture: couverture.id_couverture
              });
            }
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la chaîne automatique couverture/éclosion/lot:', error.message);
      }
    }

    return oeufs;
  }

  async update(id, data) {
    const { nbr_oeufs } = data;
    if (nbr_oeufs !== null && nbr_oeufs !== undefined && nbr_oeufs < 0) {
      const err = new Error("Le nombre d'oeufs doit être positif");
      err.status = 400;
      throw err;
    }
    const oeufs = await Oeufs.update(this.pool, id, data);
    if (!oeufs) {
      const err = new Error("Lot d'oeufs non trouvé");
      err.status = 404;
      throw err;
    }
    return oeufs;
  }

  async delete(id) {
    const oeufs = await Oeufs.delete(this.pool, id);
    if (!oeufs) {
      const err = new Error("Lot d'oeufs non trouvé");
      err.status = 404;
      throw err;
    }
    return { message: "Lot d'oeufs supprimé" };
  }

  async getEstimationNonEclos() {
    return Oeufs.findNonEclos(this.pool);
  }

  async calculateEggCount(lotId, targetDate) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(o.nbr_oeufs), 0) as total
        FROM oeufs o
        WHERE o.id_lot = @id_lot
          AND o.date_recensement <= @target_date
          AND o.id_lot_oeufs NOT IN (
            SELECT co.id_lot_oeufs FROM couverture_oeufs co
            JOIN eclosion_oeufs eo ON eo.id_couverture = co.id_couverture
            WHERE eo.date_eclosion <= @target_date
          )
      `);
    return result.recordset[0].total || 0;
  }

  async calculatePerte(lotId, targetDate) {
    // La perte s'affiche sur le lot enfant (celui créé par éclosion)
    // Le lot enfant a id_couverture qui pointe vers la couverture d'où il est né
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(eo.nbr_oeufs_pourris), 0) as total_pourris
        FROM lot l
        JOIN eclosion_oeufs eo ON eo.id_couverture = l.id_couverture
        WHERE l.id_lot = @id_lot
          AND l.id_couverture IS NOT NULL
          AND eo.date_eclosion <= @target_date
      `);
    return result.recordset[0].total_pourris || 0;
  }

  // Méthode pour valider la capacité de ponte
  async validateCapacitePonte(id_lot, nbr_oeufs_nouveau, date_recensement) {
    // 1. Récupérer les infos du lot et de la race
    const lotResult = await this.pool
      .request()
      .input('id_lot', sql.Int, id_lot)
      .query(`
        SELECT l.*, r.capacite_ponte, r.femelle, r.nom_race 
        FROM lot l 
        JOIN race r ON l.id_race = r.id_race 
        WHERE l.id_lot = @id_lot
      `);
    
    const lot = lotResult.recordset[0];
    if (!lot) {
      const err = new Error("Lot non trouvé");
      err.status = 404;
      throw err;
    }

    // 2. Calculer le nombre de femelles dans le lot (en tenant compte des décès)
    // Filtre: seulement les décès dont la date >= date_creation du lot
    const decesResult = await this.pool
      .request()
      .input('id_lot', sql.Int, id_lot)
      .input('date_recensement', sql.Date, date_recensement)
      .query(`
        SELECT COALESCE(SUM(d.nbr_deces), 0) as total_deces
        FROM deces d
        JOIN lot l ON d.id_lot = l.id_lot
        WHERE d.id_lot = @id_lot
          AND CAST(d.date_deces AS DATE) >= CAST(l.date_creation AS DATE)
          AND d.date_deces <= @date_recensement
      `);
    
    const totalDeces = decesResult.recordset[0]?.total_deces || 0;
    const nbrPouletsVivants = lot.nbr_poulet - totalDeces;
    const pourcentageFemelle = lot.femelle || 50; // Si pas défini, on assume 50%
    const nbrFemelles = Math.round((nbrPouletsVivants * pourcentageFemelle) / 100);

    // 3. Calculer la capacité totale de ponte
    const capaciteTotale = nbrFemelles * (lot.capacite_ponte || 0);

    // 4. Vérifier les œufs déjà produits par ce lot
    const oeufsExistantsResult = await this.pool
      .request()
      .input('id_lot', sql.Int, id_lot)
      .query(`
        SELECT COALESCE(SUM(o.nbr_oeufs), 0) as total_oeufs_existants
        FROM oeufs o 
        WHERE o.id_lot = @id_lot
      `);
    
    const totalOeufsExistants = oeufsExistantsResult.recordset[0]?.total_oeufs_existants || 0;
    
    // 5. Validation
    if (capaciteTotale > 0 && (totalOeufsExistants + nbr_oeufs_nouveau) > capaciteTotale) {
      const err = new Error(
        `Capacité de ponte dépassée pour la race ${lot.nom_race}. ` +
        `Capacité: ${capaciteTotale} œufs (${nbrFemelles} femelles × ${lot.capacite_ponte}). ` +
        `Déjà produit: ${totalOeufsExistants}, tentative d'ajout: ${nbr_oeufs_nouveau}`
      );
      err.status = 400;
      throw err;
    }
  }
}

module.exports = OeufsService;
