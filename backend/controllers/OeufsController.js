class OeufsController {
  constructor(oeufsService) {
    this.oeufsService = oeufsService;
  }

  async getAll(req, res, next) {
    try {
      const oeufs = await this.oeufsService.getAll();
      res.json(oeufs);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const oeufs = await this.oeufsService.getById(req.params.id);
      res.json(oeufs);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const oeufs = await this.oeufsService.create(req.body);
      res.status(201).json(oeufs);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const oeufs = await this.oeufsService.update(req.params.id, req.body);
      res.json(oeufs);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.oeufsService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OeufsController;
