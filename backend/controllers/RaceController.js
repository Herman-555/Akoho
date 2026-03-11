class RaceController {
  constructor(raceService) {
    this.raceService = raceService;
  }

  async getAll(req, res, next) {
    try {
      const races = await this.raceService.getAll();
      res.json(races);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const race = await this.raceService.getById(req.params.id);
      res.json(race);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const race = await this.raceService.create(req.body);
      res.status(201).json(race);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const race = await this.raceService.update(req.params.id, req.body);
      res.json(race);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.raceService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = RaceController;
