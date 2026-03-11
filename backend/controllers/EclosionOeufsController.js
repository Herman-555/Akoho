class EclosionOeufsController {
  constructor(eclosionOeufsService) {
    this.eclosionOeufsService = eclosionOeufsService;
  }

  async getAll(req, res, next) {
    try {
      const eclosions = await this.eclosionOeufsService.getAll();
      res.json(eclosions);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await this.eclosionOeufsService.create(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = EclosionOeufsController;
