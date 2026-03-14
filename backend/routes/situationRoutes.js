const express = require('express');

function createSituationRoutes(situationController) {
  const router = express.Router();

  router.get('/', (req, res, next) => situationController.getSituation(req, res, next));
  router.get('/all', (req, res, next) => situationController.getAllSituations(req, res, next));
  router.get('/poids-race', (req, res, next) => situationController.getPoidsAkoho(req, res, next));

  return router;
}

module.exports = createSituationRoutes;
