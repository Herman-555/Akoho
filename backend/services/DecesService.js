const Deces = require('../models/Deces');
const Database = require('../config/database');
const sql = Database.sql;

class DecesService {
  constructor(pool) {
    this.pool = pool;
  }

  calculerVraisDecesParLot(decesRecords) {
    // Grouper par lot
    const parLot = {};
    for (const d of decesRecords) {
      if (!parLot[d.id_lot]) parLot[d.id_lot] = [];
      parLot[d.id_lot].push(d);
    }

    for (const idLot of Object.keys(parLot)) {
      const records = parLot[idLot];
      // Trier par date puis par id pour ordre chronologique
      records.sort((a, b) => new Date(a.date_deces) - new Date(b.date_deces) || a.id_deces - b.id_deces);

      const premier = records[0];
      const initial = this.repartirPouletsInitiaux(
        premier.nbr_poulet, premier.id_couverture,
        premier.femelle, premier.male
      );
      let malesRestants = initial.males;
      let femellesRestantes = initial.femelles;

      for (const d of records) {
        const decesEffectifs = this.plafonnerDeces(d.nbr_deces, malesRestants + femellesRestantes);
        const { decesMales, decesFemelles } = this.calculerDecesParSexe(decesEffectifs, d.deces_male, d.deces_femelle);
        const apres = this.appliquerDebordementDeces(malesRestants, femellesRestantes, decesMales, decesFemelles);

        d.deces_males = malesRestants - apres.males;
        d.deces_femelles = femellesRestantes - apres.femelles;

        malesRestants = apres.males;
        femellesRestantes = apres.femelles;
      }
    }

    return decesRecords;
  }

  async getAll() {
    const records = await Deces.findAll(this.pool);
    return this.calculerVraisDecesParLot(records);
  }

  async getById(id) {
    const deces = await Deces.findById(this.pool, id);
    if (!deces) {
      const err = new Error('Décès non trouvé');
      err.status = 404;
      throw err;
    }
    // Charger tous les décès du même lot pour calculer séquentiellement
    const tousLesDeces = await this.pool
      .request()
      .input('id_lot', sql.Int, deces.id_lot)
      .query(`
        SELECT d.*, l.nbr_poulet, r.nom_race,
               r.male, r.femelle, r.deces_male, r.deces_femelle, l.id_couverture
        FROM deces d
        JOIN lot l ON d.id_lot = l.id_lot
        JOIN race r ON l.id_race = r.id_race
        WHERE d.id_lot = @id_lot
        ORDER BY d.date_deces, d.id_deces
      `);
    this.calculerVraisDecesParLot(tousLesDeces.recordset);
    const enrichi = tousLesDeces.recordset.find(d => d.id_deces === id);
    return enrichi || deces;
  }

  async create(data) {
    const { id_lot, date_deces, nbr_deces } = data;
    if (nbr_deces !== null && nbr_deces !== undefined && nbr_deces < 0) {
      const err = new Error('Le nombre de décès doit être positif ou nul');
      err.status = 400;
      throw err;
    }

    if (id_lot) {
      const lotResult = await this.pool
        .request()
        .input('id_lot', sql.Int, id_lot)
        .query('SELECT l.nbr_poulet, l.date_creation, r.deces_male, r.deces_femelle FROM lot l JOIN race r ON l.id_race = r.id_race WHERE l.id_lot = @id_lot');

      if (!lotResult.recordset[0]) {
        const err = new Error('Lot non trouvé');
        err.status = 404;
        throw err;
      }

      const { nbr_poulet: totalPoulets, date_creation, deces_male, deces_femelle } = lotResult.recordset[0];

      // Valider que date_deces >= date_creation du lot
      if (date_deces) {
        const dateDeces = new Date(date_deces);
        const dateCreation = new Date(date_creation);
        dateDeces.setHours(0, 0, 0, 0);
        dateCreation.setHours(0, 0, 0, 0);
        if (dateDeces < dateCreation) {
          const err = new Error(`La date de décès (${date_deces}) est antérieure à la date de création du lot (${date_creation.toISOString().split('T')[0]})`);
          err.status = 400;
          throw err;
        }
      }

      if (nbr_deces > 0) {
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
    }

    return Deces.create(this.pool, data);
  }

  async update(id, data) {
    const { id_lot, date_deces, nbr_deces } = data;
    if (nbr_deces !== null && nbr_deces !== undefined && nbr_deces < 0) {
      const err = new Error('Le nombre de décès doit être positif ou nul');
      err.status = 400;
      throw err;
    }

    if (id_lot) {
      const lotResult = await this.pool
        .request()
        .input('id_lot', sql.Int, id_lot)
        .query('SELECT l.nbr_poulet, l.date_creation, r.deces_male, r.deces_femelle FROM lot l JOIN race r ON l.id_race = r.id_race WHERE l.id_lot = @id_lot');

      if (!lotResult.recordset[0]) {
        const err = new Error('Lot non trouvé');
        err.status = 404;
        throw err;
      }

      const { nbr_poulet: totalPoulets, date_creation, deces_male, deces_femelle } = lotResult.recordset[0];

      // Valider que date_deces >= date_creation du lot
      if (date_deces) {
        const dateDeces = new Date(date_deces);
        const dateCreation = new Date(date_creation);
        dateDeces.setHours(0, 0, 0, 0);
        dateCreation.setHours(0, 0, 0, 0);
        if (dateDeces < dateCreation) {
          const err = new Error(`La date de décès (${date_deces}) est antérieure à la date de création du lot (${date_creation.toISOString().split('T')[0]})`);
          err.status = 400;
          throw err;
        }
      }

      // Vérifier que nbr_deces ne dépasse pas les poulets restants (en excluant le record courant)
      if (nbr_deces > 0) {
        const decesResult = await this.pool
          .request()
          .input('id_lot', sql.Int, id_lot)
          .input('id_deces', sql.Int, id)
          .query('SELECT COALESCE(SUM(nbr_deces), 0) as total_deces FROM deces WHERE id_lot = @id_lot AND id_deces != @id_deces');

        const decesCumules = decesResult.recordset[0].total_deces;
        const restants = totalPoulets - decesCumules;

        if (nbr_deces > restants) {
          const err = new Error(`Le nombre de décès (${nbr_deces}) dépasse le nombre de poulets restants (${restants}) pour ce lot`);
          err.status = 400;
          throw err;
        }
      }
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

  async calculateTotalDeaths(lotId, targetDate) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(d.nbr_deces), 0) as total
        FROM deces d
        JOIN lot l ON d.id_lot = l.id_lot
        WHERE d.id_lot = @id_lot
          AND CAST(d.date_deces AS DATE) >= CAST(l.date_creation AS DATE)
          AND CAST(d.date_deces AS DATE) <= @target_date
      `);
    return result.recordset[0].total || 0;
  }

  async calculateChickenCount(lotId, targetDate) {
    const lot = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query('SELECT nbr_poulet, id_couverture FROM lot WHERE id_lot = @id_lot');

    if (!lot.recordset[0]) {
      throw new Error('Lot non trouvé');
    }

    const initialCount = lot.recordset[0].nbr_poulet;
    const deaths = await this.calculateTotalDeaths(lotId, targetDate);
    return Math.max(0, initialCount - deaths);
  }


  entierPositif(valeur) {
    return Math.max(0, Math.trunc(valeur || 0));
  }

  normaliserPoids(poids) {
    return poids.map(p => Math.max(0, Number(p) || 0));
  }

  calculerQuotas(total, poids) {
    const sommePoids = poids.reduce((acc, p) => acc + p, 0);
    return poids.map(p => (total * p) / sommePoids);
  }

  partiesEntieres(quotas) {
    return quotas.map(q => Math.floor(q));
  }

  trierParFractionDecroissante(quotas) {
    return quotas
      .map((q, idx) => ({ idx, fraction: q - Math.floor(q), quota: q }))
      .sort((a, b) => {
        if (b.fraction !== a.fraction) return b.fraction - a.fraction;
        return b.quota - a.quota;
      });
  }

  distribuerReste(partiesEntieres, reste, ordre) {
    const resultat = [...partiesEntieres];
    let k = 0;
    while (reste > 0) {
      resultat[ordre[k % ordre.length].idx] += 1;
      reste -= 1;
      k += 1;
    }
    return resultat;
  }

  repartirEntier(total, poids) {
    const totalSur = this.entierPositif(total);
    const poidsSurs = this.normaliserPoids(poids);
    const sommePoids = poidsSurs.reduce((acc, p) => acc + p, 0);

    if (totalSur === 0 || sommePoids === 0) {
      return poidsSurs.map(() => 0);
    }

    const quotas = this.calculerQuotas(totalSur, poidsSurs);
    const parties = this.partiesEntieres(quotas);
    const reste = totalSur - parties.reduce((acc, p) => acc + p, 0);
    const ordre = this.trierParFractionDecroissante(quotas);

    return this.distribuerReste(parties, reste, ordre);
  }

  // --- Fonctions de répartition initiale des poulets ---

  repartirPouletsInitiaux(nbrPoulet, idCouverture, pourcentageFemelle, pourcentageMale) {
    if (idCouverture === null) {
      return {
        femelles: this.entierPositif(nbrPoulet),
        males: 0
      };
    }
    const totalPoulets = this.entierPositif(nbrPoulet);
    const [femelles, males] = this.repartirEntier(totalPoulets, [pourcentageFemelle || 0, pourcentageMale || 0]);
    return { femelles, males };
  }

  // --- Fonctions de calcul des décès par sexe ---

  calculerDecesParSexe(totalDeces, pourcentageMale, pourcentageFemelle) {
    // Si uniquement des femelles (male = 0), tous les décès vont aux femelles
    if ((pourcentageMale || 0) === 0) {
      return {
        decesMales: 0,
        decesFemelles: totalDeces
      };
    }

    // Si uniquement des mâles (femelle = 0), tous les décès vont aux mâles
    if ((pourcentageFemelle || 0) === 0) {
      return {
        decesMales: totalDeces,
        decesFemelles: 0
      };
    }

    // Sinon, arrondi inférieur pour les mâles, le reste pour les femelles
    const decesMales = Math.floor(totalDeces * (pourcentageMale || 0) / 100);
    const decesFemelles = totalDeces - decesMales;

    return { decesMales, decesFemelles };
  }

  plafonnerDeces(totalDeces, totalPoulets) {
    return Math.min(this.entierPositif(totalDeces), totalPoulets);
  }

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

  calculerPouletsRestants(baseMales, baseFemelles, totalDeces, pourcentageDecesMale, pourcentageDecesFemelle) {
    const decesEffectifs = this.plafonnerDeces(totalDeces, baseMales + baseFemelles);
    const { decesMales, decesFemelles } = this.calculerDecesParSexe(decesEffectifs, pourcentageDecesMale, pourcentageDecesFemelle);
    return this.appliquerDebordementDeces(baseMales, baseFemelles, decesMales, decesFemelles);
  }

  // --- Fonctions de calcul des oeufs ---

  async compterOeufsProduits(lotId, targetDate) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT COALESCE(SUM(nbr_oeufs), 0) as total
        FROM oeufs
        WHERE id_lot = @id_lot AND date_recensement <= @target_date
      `);
    return result.recordset[0].total || 0;
  }

  async getLotAvecRace(lotId) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.nbr_poulet, l.id_couverture, l.date_creation, r.femelle, r.male, r.capacite_ponte, r.deces_male, r.deces_femelle
        FROM lot l
        JOIN race r ON l.id_race = r.id_race
        WHERE l.id_lot = @id_lot
      `);
    return result.recordset[0] || null;
  }

  async getDecesChronologiques(lotId, dateCreation, targetDate) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('date_creation', sql.Date, dateCreation)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT d.id_deces, d.date_deces, d.nbr_deces
        FROM deces d
        WHERE d.id_lot = @id_lot
          AND CAST(d.date_deces AS DATE) >= CAST(@date_creation AS DATE)
          AND CAST(d.date_deces AS DATE) <= @target_date
        ORDER BY d.date_deces, d.id_deces
      `);
    return result.recordset;
  }

  async compterOeufsEntreDates(lotId, dateDebut, dateFin) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('date_debut', sql.Date, dateDebut)
      .input('date_fin', sql.Date, dateFin)
      .query(`
        SELECT COALESCE(SUM(nbr_oeufs), 0) as total
        FROM oeufs
        WHERE id_lot = @id_lot
          AND date_recensement >= @date_debut
          AND date_recensement <= @date_fin
      `);
    return result.recordset[0].total || 0;
  }

  async getOeufsChronologiques(lotId, dateCreation, targetDate) {
    const result = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('date_creation', sql.Date, dateCreation)
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT o.id_lot_oeufs, o.date_recensement, o.nbr_oeufs
        FROM oeufs o
        WHERE o.id_lot = @id_lot
          AND CAST(o.date_recensement AS DATE) >= CAST(@date_creation AS DATE)
          AND CAST(o.date_recensement AS DATE) <= @target_date
        ORDER BY o.date_recensement, o.id_lot_oeufs
      `);
    return result.recordset;
  }

  // --- Fonction principale d'estimation ---

  // Ancienne méthode - sauvegarde
  async calculateEstimatedRemainingEggs_old(lotId, targetDate) {
    const lot = await this.getLotAvecRace(lotId);

    if (!lot) {
      return { femelles_actuelles: 0, males_actuels: 0, capacite_totale: 0, oeufs_produits: 0, oeufs_restants: 0 };
    }

    const { nbr_poulet, id_couverture, date_creation, femelle, male, capacite_ponte, deces_male, deces_femelle } = lot;

    const initial = this.repartirPouletsInitiaux(nbr_poulet, id_couverture, femelle, male);
    let femellesActuelles = initial.femelles;
    let malesActuels = initial.males;

    const capacitePonteInitiale = femellesActuelles * (capacite_ponte || 0);
    let capaciteReste = capacitePonteInitiale;

    const decesListe = await this.getDecesChronologiques(lotId, date_creation, targetDate);
    const oeufsProduitsTotaux = await this.compterOeufsProduits(lotId, targetDate);

    let oeufsCumules = 0;

    for (const deces of decesListe) {
      const oeufsTotalJusquIci = await this.compterOeufsEntreDates(lotId, date_creation, deces.date_deces);
      const sumOeufs = oeufsTotalJusquIci - oeufsCumules;

      const decesEffectifs = this.plafonnerDeces(deces.nbr_deces, malesActuels + femellesActuelles);
      const { decesMales, decesFemelles } = this.calculerDecesParSexe(decesEffectifs, deces_male, deces_femelle);
      const apres = this.appliquerDebordementDeces(malesActuels, femellesActuelles, decesMales, decesFemelles);
      const X = femellesActuelles - apres.femelles;

      if (femellesActuelles > 0 && X > 0) {
        const moyenneParFemelle = sumOeufs / femellesActuelles;
        const capacitePerdue = capaciteReste * X - moyenneParFemelle * X;
        capaciteReste = Math.ceil(capaciteReste - sumOeufs - capacitePerdue);
      } else {
        capaciteReste = capaciteReste - sumOeufs;
      }

      capaciteReste = Math.max(0, capaciteReste);

      oeufsCumules = oeufsTotalJusquIci;
      femellesActuelles = apres.femelles;
      malesActuels = apres.males;
    }

    const oeufsApresLastDeces = oeufsProduitsTotaux - oeufsCumules;
    capaciteReste = Math.max(0, capaciteReste - oeufsApresLastDeces);

    return {
      femelles_actuelles: femellesActuelles,
      males_actuels: malesActuels,
      capacite_totale: capacitePonteInitiale,
      oeufs_produits: oeufsProduitsTotaux,
      oeufs_restants: capaciteReste
    };
  }

  // Nouvelle méthode avec logique événementielle (morts + pontes fusionnées et triées)
  async calculateEstimatedRemainingEggs(lotId, targetDate) {
    const lot = await this.getLotAvecRace(lotId);

    if (!lot) {
      return { femelles_actuelles: 0, males_actuels: 0, capacite_totale: 0, oeufs_produits: 0, oeufs_restants: 0 };
    }

    const { nbr_poulet, id_couverture, date_creation, femelle, male, capacite_ponte, deces_male, deces_femelle } = lot;

    // 1. Calcul initial des femelles et mâles
    const initial = this.repartirPouletsInitiaux(nbr_poulet, id_couverture, femelle, male);
    const initialFemelles = initial.femelles;
    const initialMales = initial.males;

    // 2. Capacité initiale
    const capacitePonteInitiale = initialFemelles * (capacite_ponte || 0);

    if (initialFemelles === 0 || capacite_ponte === 0) {
      const oeufsProduits = await this.compterOeufsProduits(lotId, targetDate);
      return {
        femelles_actuelles: 0,
        males_actuels: initialMales,
        capacite_totale: 0,
        oeufs_produits: oeufsProduits,
        oeufs_restants: 0
      };
    }

    // 3. Récupérer les décès et les œufs chronologiquement
    const decesListe = await this.getDecesChronologiques(lotId, date_creation, targetDate);
    const oeufsListe = await this.getOeufsChronologiques(lotId, date_creation, targetDate);
    const oeufsProduitsTotaux = await this.compterOeufsProduits(lotId, targetDate);

    // 4. Créer les événements de mort avec calcul des femelles mortes
    const events = [];
    let cumulativeMaleDeaths = 0;
    let cumulativeFemaleDeaths = 0;

    for (const deces of decesListe) {
      const dateEvent = new Date(deces.date_deces);
      dateEvent.setHours(0, 0, 0, 0);

      let femaleDeath = 0;
      let maleDeath = 0;

      if (id_couverture === null) {
        // Lot créé via interface = uniquement femelles, tous les morts sont des femelles
        femaleDeath = deces.nbr_deces;
      } else {
        // Lot mixte (éclosion) : suivre les pourcentages mais plafonner
        const totalDecesJusquIci = cumulativeMaleDeaths + cumulativeFemaleDeaths + deces.nbr_deces;
        const expectedMaleDeathsTotal = Math.floor(totalDecesJusquIci * (deces_male || 0) / 100);
        maleDeath = expectedMaleDeathsTotal - cumulativeMaleDeaths;

        // Plafonner si on dépasse le nombre de mâles
        if (cumulativeMaleDeaths + maleDeath > initialMales) {
          maleDeath = Math.max(0, initialMales - cumulativeMaleDeaths);
        }
        femaleDeath = deces.nbr_deces - maleDeath;
        cumulativeMaleDeaths += maleDeath;
      }

      if (femaleDeath > 0 || maleDeath > 0) {
        events.push({
          date: dateEvent,
          type: 'mort',
          nbrFemelleMorte: femaleDeath,
          nbrMaleMort: maleDeath
        });
      }
      cumulativeFemaleDeaths += femaleDeath;
    }

    // 5. Ajouter les événements de ponte
    for (const oeuf of oeufsListe) {
      const dateEvent = new Date(oeuf.date_recensement);
      dateEvent.setHours(0, 0, 0, 0);

      events.push({
        date: dateEvent,
        type: 'ponte',
        nbrOeufs: oeuf.nbr_oeufs
      });
    }

    // 6. Trier par date (morts AVANT pontes si même date)
    events.sort((a, b) => {
      const diff = a.date - b.date;
      if (diff !== 0) return diff;
      // Si même date, les morts passent avant les pontes
      return a.type === 'mort' ? -1 : 1;
    });

    // 7. Calculer séquentiellement
    let remainingCapacity = capacitePonteInitiale;
    let femellesVivantes = initialFemelles;
    let malesVivants = initialMales;

    for (const event of events) {
      if (event.type === 'mort') {
        // Appliquer le pourcentage de survie à la capacité restante
        const survivantes = femellesVivantes - event.nbrFemelleMorte;
        if (femellesVivantes > 0) {
          remainingCapacity = remainingCapacity * (survivantes / femellesVivantes);
        }
        femellesVivantes = survivantes;
        malesVivants -= (event.nbrMaleMort || 0);
      } else if (event.type === 'ponte') {
        // Soustraire les oeufs pondus
        remainingCapacity = remainingCapacity - event.nbrOeufs;
      }
    }

    remainingCapacity = Math.max(0, remainingCapacity);

    return {
      femelles_actuelles: Math.max(0, femellesVivantes),
      males_actuels: Math.max(0, malesVivants),
      capacite_totale: capacitePonteInitiale,
      oeufs_produits: oeufsProduitsTotaux,
      oeufs_restants: Math.round(remainingCapacity)
    };
  }
}

module.exports = DecesService;
