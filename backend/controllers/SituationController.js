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

  async getPeriodicSituation(req, res, next) {
    try {
      const { lotId, date, period } = req.query;

      if (!lotId || !date) {
        return res.status(400).json({ error: 'lotId et date sont requis' });
      }

      const validPeriods = ['jour', 'semaine'];
      const selectedPeriod = validPeriods.includes(period) ? period : 'semaine';

      const results = await this.situationService.calculatePeriodicSituation(parseInt(lotId), date, selectedPeriod);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SituationController;
