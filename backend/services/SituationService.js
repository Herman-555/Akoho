const Database = require('../config/database');
const sql = Database.sql;

class SituationService {
  constructor(pool, { nutritionService, decesService, oeufsService } = {}) {
    this.pool = pool;
    this.nutritionService = nutritionService;
    this.decesService = decesService;
    this.oeufsService = oeufsService;
  }

  toUtcDateOnlyKey(value) {
    const d = new Date(value);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  async calculateSituation(lotId, targetDate) {
    const lotData = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.nbr_poulet, l.id_couverture, l.date_creation, r.prix_achat, r.prix_vente, r.prix_oeuf, r.prix_nourriture, l.poids_initial, r.male AS male_pct, r.femelle AS femelle_pct
        FROM lot l
        JOIN race r ON l.id_race = r.id_race
        WHERE l.id_lot = @id_lot
      `);

    if (!lotData.recordset[0]) {
      throw new Error('Lot non trouvé');
    }

    const { nbr_poulet: initialChickenCount, id_couverture, prix_achat, prix_vente, prix_oeuf, prix_nourriture, date_creation, poids_initial, male_pct, femelle_pct } = lotData.recordset[0];

    const creationDateKey = this.toUtcDateOnlyKey(date_creation);
    const consultationDateKey = this.toUtcDateOnlyKey(targetDate);

    if (consultationDateKey < creationDateKey) {
      return null;
    }

    // Calcul des différentes métriques via les services dédiés
    const nbr_deces = await this.decesService.calculateTotalDeaths(lotId, targetDate);
    const nbr_poulet = await this.decesService.calculateChickenCount(lotId, targetDate);
    const nbr_oeufs = await this.oeufsService.calculateEggCount(lotId, targetDate);
    const poids_moyen = await this.nutritionService.calculateAverageWeight(lotId, targetDate);
    const nourriture_total = await this.nutritionService.calculateFoodConsumption(lotId, targetDate);

    const estimationOeufs = await this.decesService.calculateEstimatedRemainingEggs(lotId, targetDate);

    const perte = await this.oeufsService.calculatePerte(lotId, targetDate);
    const perteValeur = perte * prix_oeuf;

    // Calculs de prix
    const estimation_poulet_raw = Number(poids_moyen) * Number(nbr_poulet) * Number(prix_vente);
    const estimation_poulet = Math.round(estimation_poulet_raw);

    const estimation_oeufs = nbr_oeufs * prix_oeuf;

    const prix_achat_akoho = id_couverture === null
      ? prix_achat * (nbr_deces + nbr_poulet)
      : 0;

    const prix_sakafo = nourriture_total * prix_nourriture;

    const chiffre_affaire_total = estimation_poulet + Math.round(estimation_oeufs);

    const depense_total = Math.round(prix_achat_akoho) + Math.round(prix_sakafo) + Math.round(perteValeur);

    const benefice_total = chiffre_affaire_total - depense_total;

    return {
      id_lot: lotId,
      date_consultation: targetDate,
      nbr_poulet_a_date_t: nbr_poulet,
      nbr_deces: nbr_deces,
      males_actuels: estimationOeufs.males_actuels,
      femelles_actuelles: estimationOeufs.femelles_actuelles,
      nbr_oeufs: nbr_oeufs,
      poids_moyen: Math.round(poids_moyen * 10000) / 10000,
      estimation_poulet: estimation_poulet,
      estimation_oeufs: Math.round(estimation_oeufs),
      prix_achat_akoho: Math.round(prix_achat_akoho),
      prix_sakafo: Math.round(prix_sakafo),
      chiffre_affaire_total: chiffre_affaire_total,
      depense_total: depense_total,
      benefice_total: benefice_total,
      capacite_ponte_totale: estimationOeufs.capacite_totale,
      oeufs_produits: estimationOeufs.oeufs_produits,
      oeufs_restants_estimatifs: estimationOeufs.oeufs_restants,
      perte: perte,
      perte_valeur: Math.round(perteValeur)
    };
  }

  async calculateAllSituations(targetDate) {
    const lotsResult = await this.pool
      .request()
      .input('target_date', sql.Date, targetDate)
      .query(`
        SELECT id_lot
        FROM lot
        WHERE CAST(date_creation AS DATE) <= @target_date
        ORDER BY id_lot
      `);

    const results = [];
    for (const row of lotsResult.recordset) {
      const situation = await this.calculateSituation(row.id_lot, targetDate);
      if (situation) {
        results.push(situation);
      }
    }
    return results;
  }

  async getPoidsAkoho(idRace, dateDebut, dateFin) {
    return this.nutritionService.getPoidsAkoho(idRace, dateDebut, dateFin);
  }
}

module.exports = SituationService;
