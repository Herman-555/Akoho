const EclosionOeufs = require('../models/EclosionOeufs');
const Lot = require('../models/Lot');

class EclosionOeufsService {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    return EclosionOeufs.findAll(this.pool);
  }

  async create({ id_couverture, date_eclosion, nbr_oeufs_eclos }) {
    
    const couverture = await EclosionOeufs.findCouvertureWithRace(this.pool, id_couverture);
    if (!couverture) {
      const err = new Error('Couverture non trouvée');
      err.status = 404;
      throw err;
    }

    const count = await EclosionOeufs.countByCouverture(this.pool, id_couverture);
    if (count > 0) {
      const err = new Error('Une éclosion a déjà été enregistrée pour cette couverture');
      err.status = 400;
      throw err;
    }

    if (nbr_oeufs_eclos < 0 || nbr_oeufs_eclos > couverture.nbr_oeufs) {
      const err = new Error("Le nombre d'oeufs éclos doit être entre 0 et " + couverture.nbr_oeufs);
      err.status = 400;
      throw err;
    }

    if (new Date(date_eclosion) < new Date(couverture.date_couverture)) {
      const err = new Error(
        "La date d'éclosion ne peut pas être antérieure à la date de couverture (" +
          new Date(couverture.date_couverture).toISOString().substring(0, 10) +
          ')'
      );
      err.status = 400;
      throw err;
    }

    const nbr_oeufs_pourris = couverture.nbr_oeufs - nbr_oeufs_eclos;

    const eclosion = await EclosionOeufs.create(this.pool, {
      date_eclosion,
      nbr_oeufs_eclos,
      id_couverture,
      id_lot_oeufs: couverture.id_lot_oeufs,
      nbr_oeufs_pourris,
    });

    let newLot = null;
    if (nbr_oeufs_eclos > 0) {
      newLot = await Lot.create(this.pool, {
        id_race: couverture.id_race,
        age: 0,
        date_creation: date_eclosion,
        nbr_poulet: nbr_oeufs_eclos,
        id_couverture,
      });
    }

    return { eclosion, lot: newLot };
  }
}

module.exports = EclosionOeufsService;
