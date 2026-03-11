class CouvertureOeufsController {
  constructor(couvertureOeufsService) {
    this.couvertureOeufsService = couvertureOeufsService;
  }

  async getAll(req, res, next) {
    try {
      const couvertures = await this.couvertureOeufsService.getAll();
      res.json(couvertures);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const couverture = await this.couvertureOeufsService.create(req.body);
      res.status(201).json(couverture);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CouvertureOeufsController;
