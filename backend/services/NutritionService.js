const Nutrition = require('../models/Nutrition');
const Database = require('../config/database');
const sql = Database.sql;

class NutritionService {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    return Nutrition.findAllDetails(this.pool);
  }

  async getById(id) {
    const detail = await Nutrition.findDetailById(this.pool, id);
    if (!detail) {
      const err = new Error('Détail nutrition non trouvé');
      err.status = 404;
      throw err;
    }
    return detail;
  }

  async create({ id_race, semaine, variation_poids, nourriture }) {
    if (semaine !== null && semaine !== undefined && (semaine < 0 || semaine > 12)) {
      const err = new Error('La semaine doit être entre 0 et 12');
      err.status = 400;
      throw err;
    }
    if (nourriture !== null && nourriture !== undefined && nourriture < 0) {
      const err = new Error('La quantité de nourriture doit être positive');
      err.status = 400;
      throw err;
    }

    let nutrition = await Nutrition.findNutritionByRace(this.pool, id_race);
    let id_nutrition;
    if (!nutrition) {
      const created = await Nutrition.createNutritionHeader(this.pool, id_race);
      id_nutrition = created.id_nutrition;
    } else {
      id_nutrition = nutrition.id_nutrition;
    }

    return Nutrition.createDetail(this.pool, { id_nutrition, semaine, variation_poids, nourriture });
  }

  async update(id, { semaine, variation_poids, nourriture }) {
    if (semaine !== null && semaine !== undefined && (semaine < 0 || semaine > 12)) {
      const err = new Error('La semaine doit être entre 0 et 12');
      err.status = 400;
      throw err;
    }
    if (nourriture !== null && nourriture !== undefined && nourriture < 0) {
      const err = new Error('La quantité de nourriture doit être positive');
      err.status = 400;
      throw err;
    }

    const detail = await Nutrition.updateDetail(this.pool, id, { semaine, variation_poids, nourriture });
    if (!detail) {
      const err = new Error('Détail nutrition non trouvé');
      err.status = 404;
      throw err;
    }
    return detail;
  }

  async delete(id) {
    const detail = await Nutrition.deleteDetail(this.pool, id);
    if (!detail) {
      const err = new Error('Détail nutrition non trouvé');
      err.status = 404;
      throw err;
    }
    return { message: 'Détail nutrition supprimé' };
  }

  async calculateAverageWeight(lotId, targetDate) {
    const lotData = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.date_creation, l.id_race, l.poids_initial, l.age FROM lot l WHERE l.id_lot = @id_lot
      `);

    if (!lotData.recordset[0]) {
      throw new Error('Lot non trouvé');
    }

    const { date_creation, id_race, poids_initial, age } = lotData.recordset[0];
    const creationDate = new Date(date_creation);
    const target = new Date(targetDate);
    const ageDays = Math.floor((target - creationDate) / (1000 * 60 * 60 * 24)) + 1;

    if (ageDays <= 0) {
      return 0;
    }

    const nutritionData = await this.pool
      .request()
      .input('id_race', sql.Int, id_race)
      .query(`
        SELECT nd.semaine, nd.variation_poids
        FROM nutrition n
        JOIN nutrition_detail nd ON n.id_nutrition = nd.id_nutrition
        WHERE n.id_race = @id_race
        ORDER BY nd.semaine ASC
      `);

    let weight = 0;
    if (poids_initial != 0) {
      weight = poids_initial;
    } else {
      weight = nutritionData.recordset.length > 0 ? nutritionData.recordset[0].variation_poids : 0;
    }

    const weeksComplete = Math.floor(ageDays / 7);
    const daysInCurrentWeek = ageDays % 7;
    let weightSeptiemes = 0;

    for (const row of nutritionData.recordset) {
      if (row.semaine > age && row.semaine <= weeksComplete + age) {
        weight += row.variation_poids;
      }
    }

    const currentSemaine = weeksComplete + age + 1;
    const currentWeekData = nutritionData.recordset.find(d => d.semaine === currentSemaine);
    if (currentWeekData) {
      if (weeksComplete === 0) {
        weightSeptiemes += currentWeekData.variation_poids * ageDays;
      } else if (daysInCurrentWeek > 0) {
        weightSeptiemes += currentWeekData.variation_poids * daysInCurrentWeek;
      }
    }

    return Math.max(0, weight + weightSeptiemes / 7);
  }

  async calculateFoodConsumption(lotId, targetDate) {
    const lotData = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .query(`
        SELECT l.date_creation, l.id_race, l.age, l.nbr_poulet FROM lot l WHERE l.id_lot = @id_lot
      `);

    if (!lotData.recordset[0]) {
      throw new Error('Lot non trouvé');
    }

    const { date_creation, id_race, age, nbr_poulet } = lotData.recordset[0];
    const creationDate = new Date(date_creation);
    const target = new Date(targetDate);
    const ageDays = Math.floor((target - creationDate) / (1000 * 60 * 60 * 24)) + 1;

    if (ageDays <= 0) {
      return 0;
    }

    const msPerDay = 1000 * 60 * 60 * 24;

    const decesData = await this.pool
      .request()
      .input('id_lot', sql.Int, lotId)
      .input('target_date', sql.Date, targetDate)
      .input('date_creation', sql.Date, date_creation)
      .query(`
        SELECT date_deces, SUM(nbr_deces) as total_deces
        FROM deces
        WHERE id_lot = @id_lot
          AND CAST(date_deces AS DATE) >= CAST(@date_creation AS DATE)
          AND CAST(date_deces AS DATE) <= @target_date
        GROUP BY date_deces
        ORDER BY date_deces ASC
      `);

    const nutritionData = await this.pool
      .request()
      .input('id_race', sql.Int, id_race)
      .query(`
        SELECT nd.semaine, nd.nourriture
        FROM nutrition n
        JOIN nutrition_detail nd ON n.id_nutrition = nd.id_nutrition
        WHERE n.id_race = @id_race
        ORDER BY nd.semaine ASC
      `);

    const weeksComplete = Math.floor(ageDays / 7);
    const daysInCurrentWeek = ageDays % 7;
    let currentNumbers = nbr_poulet;
    let totalFood = 0;
    // Accumuler les fractions de semaine en septièmes pour n'arrondir qu'à la fin
    // totalFoodSeptiemes = somme de (nbr_poulets * nourriture * jours) qu'on divisera par 7 à la fin
    let totalFoodSeptiemes = 0;

    const lastNutritionRow = nutritionData.recordset.length > 0
      ? nutritionData.recordset[nutritionData.recordset.length - 1]
      : null;
    let currentWeeklyFood = lastNutritionRow ? lastNutritionRow.nourriture : 0;
    const lastDataSemaine = lastNutritionRow ? lastNutritionRow.semaine : age;

    for (const row of nutritionData.recordset) {
      if (row.semaine > age && row.semaine <= weeksComplete + age) {
        const dateDebutSemaine = new Date(creationDate.getTime() + (row.semaine - age - 1) * 7 * msPerDay);
        const dateFinSemaine = new Date(dateDebutSemaine.getTime() + 7 * msPerDay);
        let hasDeathThisWeek = false;

        for (const deces of decesData.recordset) {
          const dateDeces = new Date(deces.date_deces);
          if (dateDeces >= dateDebutSemaine && dateDeces < dateFinSemaine) {
            hasDeathThisWeek = true;
            const oldNumbers = currentNumbers;
            currentNumbers -= deces.total_deces;
            const dayRankOfWeek = Math.floor((dateDeces - dateDebutSemaine) / msPerDay);
            totalFoodSeptiemes += oldNumbers * row.nourriture * dayRankOfWeek;
            totalFoodSeptiemes += currentNumbers * row.nourriture * Math.max(0, 7 - dayRankOfWeek);
            // Ancienne version (morts mangent le jour J) :
            // totalFoodSeptiemes += oldNumbers * row.nourriture * (dayRankOfWeek + 1);
            // totalFoodSeptiemes += currentNumbers * row.nourriture * Math.max(0, 7 - dayRankOfWeek - 1);
          }
        }
        if (!hasDeathThisWeek) {
          totalFood += currentNumbers * row.nourriture;
        }
      }
    }

    for (let semaine = Math.max(lastDataSemaine + 1, age + 1); semaine <= weeksComplete + age; semaine++) {
      const dateDebutSemaine = new Date(creationDate.getTime() + (semaine - age - 1) * 7 * msPerDay);
      const dateFinSemaine = new Date(dateDebutSemaine.getTime() + 7 * msPerDay);
      let hasDeathThisWeek = false;

      for (const deces of decesData.recordset) {
        const dateDeces = new Date(deces.date_deces);
        if (dateDeces >= dateDebutSemaine && dateDeces < dateFinSemaine) {
          hasDeathThisWeek = true;
          const oldNumbers = currentNumbers;
          currentNumbers -= deces.total_deces;
          const dayRankOfWeek = Math.floor((dateDeces - dateDebutSemaine) / msPerDay);
          totalFoodSeptiemes += oldNumbers * currentWeeklyFood * dayRankOfWeek;
          totalFoodSeptiemes += currentNumbers * currentWeeklyFood * Math.max(0, 7 - dayRankOfWeek);
          // Ancienne version (morts mangent le jour J) :
          // totalFoodSeptiemes += oldNumbers * currentWeeklyFood * (dayRankOfWeek + 1);
          // totalFoodSeptiemes += currentNumbers * currentWeeklyFood * Math.max(0, 7 - dayRankOfWeek - 1);
        }
      }
      if (!hasDeathThisWeek) {
        totalFood += currentNumbers * currentWeeklyFood;
      }
    }

    if (daysInCurrentWeek > 0) {
      const currentSemaine = weeksComplete + age + 1;
      const currentWeekData = nutritionData.recordset.find(d => d.semaine === currentSemaine);
      const weeklyFood = currentWeekData ? currentWeekData.nourriture : currentWeeklyFood;

      if (weeklyFood > 0) {
        const dateDebutSemaine = new Date(creationDate.getTime() + (currentSemaine - age - 1) * 7 * msPerDay);
        let hasDeathThisWeek = false;

        for (const deces of decesData.recordset) {
          const dateDeces = new Date(deces.date_deces);
          if (dateDeces >= dateDebutSemaine && dateDeces <= target) {
            hasDeathThisWeek = true;
            const oldNumbers = currentNumbers;
            currentNumbers -= deces.total_deces;
            const dayRankOfWeek = Math.floor((dateDeces - dateDebutSemaine) / msPerDay);
            totalFoodSeptiemes += oldNumbers * weeklyFood * dayRankOfWeek;
            totalFoodSeptiemes += currentNumbers * weeklyFood * Math.max(0, daysInCurrentWeek - dayRankOfWeek);
            // Ancienne version (morts mangent le jour J) :
            // totalFoodSeptiemes += oldNumbers * weeklyFood * (dayRankOfWeek + 1);
            // totalFoodSeptiemes += currentNumbers * weeklyFood * Math.max(0, daysInCurrentWeek - dayRankOfWeek - 1);
          }
        }
        if (!hasDeathThisWeek) {
          totalFoodSeptiemes += currentNumbers * weeklyFood * daysInCurrentWeek;
        }
      }
    }

    return totalFood + totalFoodSeptiemes / 7;
  }

  async getPoidsAkoho(idRace, dateDebut, dateFin) {
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    const ageDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (ageDays <= 0) {
      return { id_race: idRace, date_debut: dateDebut, date_fin: dateFin, poids: 0, age_jours: 0 };
    }

    const nutritionData = await this.pool
      .request()
      .input('id_race', sql.Int, idRace)
      .query(`
        SELECT nd.semaine, nd.variation_poids
        FROM nutrition n
        JOIN nutrition_detail nd ON n.id_nutrition = nd.id_nutrition
        WHERE n.id_race = @id_race
        ORDER BY nd.semaine ASC
      `);

    let weight = nutritionData.recordset.length > 0 ? nutritionData.recordset[0].variation_poids : 0;

    const weeksComplete = Math.floor(ageDays / 7);
    const daysInCurrentWeek = ageDays % 7;
    let weightSeptiemes = 0;

    for (const row of nutritionData.recordset) {
      if (row.semaine >= 1 && row.semaine <= weeksComplete) {
        weight += row.variation_poids;
      }
    }

    const currentSemaine = weeksComplete + 1;
    const currentWeekData = nutritionData.recordset.find(d => d.semaine === currentSemaine);
    if (currentWeekData) {
      if (weeksComplete === 0) {
        weightSeptiemes += currentWeekData.variation_poids * ageDays;
      } else if (daysInCurrentWeek > 0) {
        weightSeptiemes += currentWeekData.variation_poids * daysInCurrentWeek;
      }
    }

    return {
      id_race: idRace,
      date_debut: dateDebut,
      date_fin: dateFin,
      poids: Math.max(0, Math.round((weight + weightSeptiemes / 7) * 10000) / 10000),
      age_jours: ageDays
    };
  }
}

module.exports = NutritionService;
