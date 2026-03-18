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
  // Ancienne méthode - sauvegarde
  async calculateRemainingEggsNewLogic_old(lotId, targetDate) {
    // 1. Récupérer les informations du lot
    const lotResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.*, r.capacite_ponte, r.femelle, r.male, r.deces_male, r.deces_femelle
        FROM lot l
        JOIN race r ON l.id_race = r.id_race
        WHERE l.id_lot = @id_lot
      `);

    const lot = lotResult.recordset[0];
    if (!lot) {
      throw new Error("Lot non trouvé");
    }

    // 2. Calcul initial des femelles (selon la répartition de la race)
    const nbrFemellesInitiales = lot.id_couverture === null
      ? lot.nbr_poulet // Lot créé via interface = uniquement femelles
      : Math.round((lot.nbr_poulet * (lot.femelle || 50)) / 100); // Lot d'éclosion

    // 3. Capacité totale initiale
    const capaciteTotale = nbrFemellesInitiales * (lot.capacite_ponte || 0);

    // 4. Total des œufs déjà pondus
    const oeufsResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(o.nbr_oeufs), 0) as total_oeufs
        FROM oeufs o
        WHERE o.id_lot = @id_lot AND o.date_recensement <= @target_date
      `);

    const oeufsPondus = oeufsResult.recordset[0].total_oeufs || 0;

    // 5. Capacité actuelle = Capacité totale - Œufs pondus
    let capaciteActuelle = capaciteTotale - oeufsPondus;

    // 6. Récupérer les décès de femelles
    const decesResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(d.nbr_deces), 0) as total_deces
        FROM deces d
        JOIN lot l ON d.id_lot = l.id_lot
        WHERE d.id_lot = @id_lot
          AND CAST(d.date_deces AS DATE) >= CAST(l.date_creation AS DATE)
          AND d.date_deces <= @target_date
      `);

    const totalDeces = decesResult.recordset[0].total_deces || 0;

    // 7. Calculer le nombre de femelles mortes (basé sur le pourcentage de la race)
    const femellesMortes = Math.round((totalDeces * (lot.deces_femelle || 50)) / 100);

    // 8. Appliquer votre formule: CapaciteActuelle = (capaciteActuelle / NBR) - capacite_ponte_par_poulet * X
    const nbrFemellesActuelles = nbrFemellesInitiales - femellesMortes;

    if (femellesMortes > 0 && nbrFemellesInitiales > 0) {
      // Selon votre logique: (capaciteActuelle / NBR) - capacite_ponte_par_poulet * X
      capaciteActuelle = Math.ceil(
        (capaciteActuelle * nbrFemellesActuelles / nbrFemellesInitiales) -
        (lot.capacite_ponte * femellesMortes)
      );
    }

    return {
      capacite_totale: capaciteTotale,
      oeufs_pondus: oeufsPondus,
      femelles_initiales: nbrFemellesInitiales,
      femelles_actuelles: nbrFemellesActuelles,
      femelles_mortes: femellesMortes,
      capacite_restante: Math.max(0, capaciteActuelle)
    };
  }

  // Fonction utilitaire pour appliquer le débordement des décès
  appliquerDebordementDeces(males, femelles, decesMales, decesFemelles) {
    let malesRestants = males - decesMales;
    let femellesRestantes = femelles - decesFemelles;

    if (malesRestants < 0) {
      femellesRestantes += malesRestants;
      malesRestants = 0;
    }
    if (femellesRestantes < 0) {
      malesRestants += femellesRestantes;
      femellesRestantes = 0;
    }

    return {
      males: Math.max(0, malesRestants),
      femelles: Math.max(0, femellesRestantes)
    };
  }

  // Nouvelle méthode selon la logique métier fournie (version itérative)
  async calculateRemainingEggsNewLogic(lotId, targetDate) {
    // 1. Récupérer les informations du lot
    const lotResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.*, r.capacite_ponte, r.femelle, r.male, r.deces_male, r.deces_femelle
        FROM lot l
        JOIN race r ON l.id_race = r.id_race
        WHERE l.id_lot = @id_lot
      `);

    const lot = lotResult.recordset[0];
    if (!lot) {
      throw new Error("Lot non trouvé");
    }

    const dateCreation = new Date(lot.date_creation);
    const dateSituation = new Date(targetDate);

    // 2. Calcul initial à t0 (date de création) - femelles ET mâles
    let nbrFemellesInitiales, nbrMalesInitiaux;
    if (lot.id_couverture === null) {
      // Lot créé via interface = uniquement femelles
      nbrFemellesInitiales = lot.nbr_poulet;
      nbrMalesInitiaux = 0;
    } else {
      // Lot d'éclosion = répartition selon la race
      nbrFemellesInitiales = Math.round((lot.nbr_poulet * (lot.femelle || 50)) / 100);
      nbrMalesInitiaux = Math.round((lot.nbr_poulet * (lot.male || 50)) / 100);
    }

    // 3. Capacité totale initiale à t0
    let capacite = nbrFemellesInitiales * (lot.capacite_ponte || 0);
    let nbrFemelles = nbrFemellesInitiales;
    let nbrMales = nbrMalesInitiaux;
    let dateReference = dateCreation;

    // 4. Récupérer tous les décès entre t0 et t, triés par date
    const decesResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('date_creation', sql.Date, dateCreation)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT d.date_deces, d.nbr_deces
        FROM deces d
        WHERE d.id_lot = @id_lot
          AND CAST(d.date_deces AS DATE) > CAST(@date_creation AS DATE)
          AND CAST(d.date_deces AS DATE) <= @target_date
        ORDER BY d.date_deces ASC
      `);

    const decesRecords = decesResult.recordset;

    // 5. Traiter chaque décès de manière itérative
    for (const deces of decesRecords) {
      const dateDeces = new Date(deces.date_deces);

      // 5.1. Calculer les décès par sexe selon les pourcentages de la race
      const decesMales = Math.trunc(deces.nbr_deces * (lot.deces_male || 0) / 100);
      const decesFemelles = Math.trunc(deces.nbr_deces * (lot.deces_femelle || 0) / 100);

      // 5.2. Appliquer le débordement (redistribuer si un sexe n'a plus d'individus)
      const restants = this.appliquerDebordementDeces(nbrMales, nbrFemelles, decesMales, decesFemelles);

      // 5.3. Calculer le nombre réel de femelles mortes (après débordement)
      const vraisDecesFemelles = nbrFemelles - restants.femelles;

      // 5.4. Sommer les œufs produits entre dateReference et dateDeces
      const oeufsResult = await this.pool
        .request()
        .input('id_lot', sql.Int, lotId)
        .input('date_ref', sql.Date, dateReference)
        .input('date_deces', sql.Date, dateDeces)
        .query(`
          SELECT COALESCE(SUM(o.nbr_oeufs), 0) as oeufs_periode
          FROM oeufs o
          WHERE o.id_lot = @id_lot
            AND CAST(o.date_recensement AS DATE) > CAST(@date_ref AS DATE)
            AND CAST(o.date_recensement AS DATE) <= CAST(@date_deces AS DATE)
        `);

      const oeufsPondus = oeufsResult.recordset[0].oeufs_periode || 0;

      // 5.5. Appliquer la formule: Capacite = (Capacite - OeufsPondus) * (NbrFemelles - X) / NbrFemelles
      if (nbrFemelles > 0) {
        capacite = ((capacite - oeufsPondus) * (nbrFemelles - vraisDecesFemelles)) / nbrFemelles;
      }

      // 5.6. Mettre à jour les compteurs avec les valeurs après débordement
      nbrFemelles = restants.femelles;
      nbrMales = restants.males;
      dateReference = dateDeces;
    }

    // 6. Calculer les œufs produits après le dernier décès (ou depuis t0 si pas de décès)
    const oeufsFinalResult = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('date_ref', sql.Date, dateReference)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(o.nbr_oeufs), 0) as oeufs_periode
        FROM oeufs o
        WHERE o.id_lot = @id_lot
          AND CAST(o.date_recensement AS DATE) > CAST(@date_ref AS DATE)
          AND CAST(o.date_recensement AS DATE) <= @target_date
      `);

    const oeufsPeriodeFinale = oeufsFinalResult.recordset[0].oeufs_periode || 0;

    // 7. Capacité restante finale
    const capaciteRestante = Math.max(0, capacite - oeufsPeriodeFinale);

    // 8. Total des œufs pondus pour information
    const oeufsTotal = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(o.nbr_oeufs), 0) as total_oeufs
        FROM oeufs o
        WHERE o.id_lot = @id_lot AND o.date_recensement <= @target_date
      `);

    const oeufsPondusTotal = oeufsTotal.recordset[0].total_oeufs || 0;

    return {
      capacite_totale: nbrFemellesInitiales * (lot.capacite_ponte || 0),
      oeufs_pondus: oeufsPondusTotal,
      femelles_initiales: nbrFemellesInitiales,
      femelles_actuelles: nbrFemelles,
      femelles_mortes: nbrFemellesInitiales - nbrFemelles,
      capacite_restante: Math.round(capaciteRestante)
    };
  }

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
