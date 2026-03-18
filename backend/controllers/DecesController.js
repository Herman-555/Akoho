class DecesController {
  constructor(decesService) {
    this.decesService = decesService;
  }

  async getAll(req, res, next) {
    try {
      const deces = await this.decesService.getAll();
      res.json(deces);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const deces = await this.decesService.getById(req.params.id);
      res.json(deces);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const deces = await this.decesService.create(req.body);
      res.status(201).json(deces);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const deces = await this.decesService.update(req.params.id, req.body);
      res.json(deces);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.decesService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getRemainingEggsCurrentLogic(req, res, next) {
    try {
      const { lotId, targetDate } = req.query;
      if (!lotId) {
        return res.status(400).json({ error: 'lotId est requis' });
      }

      const dateToUse = targetDate ? new Date(targetDate) : new Date();
      const result = await this.decesService.calculateEstimatedRemainingEggs(parseInt(lotId), dateToUse);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DecesController;
