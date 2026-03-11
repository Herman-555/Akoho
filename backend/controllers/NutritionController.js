class NutritionController {
  constructor(nutritionService) {
    this.nutritionService = nutritionService;
  }

  async getAll(req, res, next) {
    try {
      const details = await this.nutritionService.getAll();
      res.json(details);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const detail = await this.nutritionService.getById(req.params.id);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const detail = await this.nutritionService.create(req.body);
      res.status(201).json(detail);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const detail = await this.nutritionService.update(req.params.id, req.body);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.nutritionService.delete(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NutritionController;
