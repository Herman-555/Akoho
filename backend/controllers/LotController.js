class LotController {
  constructor(lotService) {
    this.lotService = lotService;
  }

  async getAll(req, res, next) {
    try {
      const lots = await this.lotService.getAll();
      res.json(lots);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const lot = await this.lotService.getById(req.params.id);
      res.json(lot);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const lot = await this.lotService.create(req.body);
      res.status(201).json(lot);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const lot = await this.lotService.update(req.params.id, req.body);
      res.json(lot);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.lotService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = LotController;
