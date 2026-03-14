const CouvertureOeufs = require('../models/CouvertureOeufs');
const EclosionOeufs = require('../models/EclosionOeufs');
const Lot = require('../models/Lot');
const sql = require('../config/database').sql;

class CouvertureOeufsService {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    return CouvertureOeufs.findAll(this.pool);
  }

  async create({ id_lot_oeufs, date_couverture }) {
    // 1. Fetch the oeufs lot
    const oeufsLot = await CouvertureOeufs.findOeufsWithRace(this.pool, id_lot_oeufs);
    if (!oeufsLot) {
      const err = new Error("Lot d'oeufs non trouvé");
      err.status = 404;
      throw err;
    }

    // 2. Check not already covered
    const count = await CouvertureOeufs.countByLotOeufs(this.pool, id_lot_oeufs);
    if (count > 0) {
      const err = new Error("Ce lot d'oeufs est déjà en couverture");
      err.status = 400;
      throw err;
    }

    // 3. Validate date >= egg lot date
    if (new Date(date_couverture) < new Date(oeufsLot.date_recensement)) {
      const err = new Error(
        "La date de couverture ne peut pas être antérieure à la date du lot d'oeufs (" +
          new Date(oeufsLot.date_recensement).toISOString().substring(0, 10) +
          ')'
      );
      err.status = 400;
      throw err;
    }

    // 4. Insert couverture (nbr_oeufs = whole lot)
    const couverture = await CouvertureOeufs.create(this.pool, {
      id_lot_oeufs,
      nbr_oeufs: oeufsLot.nbr_oeufs,
      date_couverture,
    });
    
    // Automatisation: Programmer l'éclosion selon nb_jours_eclosion de la race
    if (couverture) {
      try {
        // Obtenir les infos de la race pour nb_jours_eclosion et oeufs_pourris
        const raceResult = await this.pool
          .request()
          .input('id_race', sql.Int, oeufsLot.id_race)
          .query('SELECT nb_jours_eclosion, oeufs_pourris FROM race WHERE id_race = @id_race');
        
        const race = raceResult.recordset[0];
        if (race && race.nb_jours_eclosion) {
          const dateEclosion = new Date(date_couverture);
          dateEclosion.setDate(dateEclosion.getDate() + race.nb_jours_eclosion - 1);
          
          // Calculer les œufs pourris selon le pourcentage de la race
          const tauxPourris = race.oeufs_pourris || 0;
          const nbrOeufsPourris = Math.round((oeufsLot.nbr_oeufs * tauxPourris) / 100);
          const nbrOeufsEclos = oeufsLot.nbr_oeufs - nbrOeufsPourris;
          
          // Créer automatiquement l'éclosion
          const eclosion = await EclosionOeufs.create(this.pool, {
            date_eclosion: dateEclosion,
            nbr_oeufs_eclos: Math.max(0, nbrOeufsEclos),
            id_couverture: couverture.id_couverture,
            id_lot_oeufs: couverture.id_lot_oeufs,
            nbr_oeufs_pourris: nbrOeufsPourris
          });
          
          // Créer le nouveau lot de poussins si il y a des éclosions
          if (nbrOeufsEclos > 0) {
            await Lot.create(this.pool, {
              id_race: oeufsLot.id_race,
              age: 0,
              date_creation: dateEclosion,
              nbr_poulet: nbrOeufsEclos,
              id_couverture: couverture.id_couverture
            });
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la programmation automatique de l\'éclosion:', error.message);
      }
    }
    
    return couverture;
  }
}

module.exports = CouvertureOeufsService;
