class SituationController {
  constructor(situationService) {
    this.situationService = situationService;
  }

  async getSituation(req, res, next) {
    try {
      const { lotId, date } = req.query;

      if (!lotId || !date) {
        return res.status(400).json({ error: 'lotId et date sont requis' });
      }

      const situation = await this.situationService.calculateSituation(parseInt(lotId), date);
      res.json(situation);
    } catch (err) {
      next(err);
    }
  }

  async getAllSituations(req, res, next) {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({ error: 'date est requis' });
      }

      const results = await this.situationService.calculateAllSituations(date);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  async getPoidsAkoho(req, res, next) {
    try {
      const { idRace, dateDebut, dateFin } = req.query;

      if (!idRace || !dateDebut || !dateFin) {
        return res.status(400).json({ error: 'idRace, dateDebut et dateFin sont requis' });
      }

      const result = await this.situationService.getPoidsAkoho(parseInt(idRace), dateDebut, dateFin);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SituationController;
