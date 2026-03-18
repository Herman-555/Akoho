# Calcul des Œufs Restants - Documentation

## Vue d'ensemble

Ce document explique l'implémentation de la logique de calcul des œufs restants avec deux approches différentes.

## Les Deux Logiques

### 1. Logique Actuelle (Complexe)
**Endpoint:** `GET /api/deces/remaining-eggs/current-logic?lotId={id}&targetDate={date}`

**Méthode:** `DecesService.calculateEstimatedRemainingEggs()`

**Approche:**
- Parcourt chronologiquement tous les décès
- Calcule une moyenne dynamique des œufs par femelle basée sur la production réelle
- Formule: `capacitePerdue = capaciteReste * X - moyenneParFemelle * X`
- Plus précise car elle tient compte de la production réelle

### 2. Nouvelle Logique (Simplifiée)
**Endpoint:** `GET /api/oeufs/remaining-eggs/new-logic?lotId={id}&targetDate={date}`

**Méthode:** `OeufsService.calculateRemainingEggsNewLogic()`

**Approche:**
- Utilise la capacité de ponte fixe de la race
- Formule: `CapaciteActuelle = (capaciteActuelle * nbrFemellesActuelles / nbrFemellesInitiales) - (capacite_ponte * femellesMortes)`
- Plus simple mais moins précise

## Formules

### Formule de Base (commune aux deux)
```
CapaciteActuelle = Capacite totale - Œufs pondues
```

### Si X femelles mortes

**Nouvelle Logique:**
```
CapaciteActuelle = (capaciteActuelle * nbrFemellesActuelles / nbrFemellesInitiales) - (capacite_ponte * X)
```

**Logique Actuelle:**
```
moyenneParFemelle = sumOeufs / femellesActuelles
capacitePerdue = capaciteReste * X - moyenneParFemelle * X
CapaciteActuelle = Math.ceil(capaciteReste - sumOeufs - capacitePerdue)
```

## Paramètres des Endpoints

- **lotId**: ID du lot (requis)
- **targetDate**: Date de situation (optionnel, par défaut aujourd'hui)

## Réponses

### Nouvelle Logique (OeufsService)
```json
{
  "capacite_totale": 600,
  "oeufs_pondus": 100,
  "femelles_initiales": 60,
  "femelles_actuelles": 50,
  "femelles_mortes": 10,
  "capacite_restante": 400
}
```

### Logique Actuelle (DecesService)
```json
{
  "femelles_actuelles": 50,
  "males_actuels": 0,
  "capacite_totale": 600,
  "oeufs_produits": 100,
  "oeufs_restants": 425
}
```

## Test Examples

### Test de base
```bash
# Nouvelle logique
GET http://localhost:3000/api/oeufs/remaining-eggs/new-logic?lotId=1

# Logique actuelle
GET http://localhost:3000/api/deces/remaining-eggs/current-logic?lotId=1
```

### Test avec date spécifique
```bash
# Nouvelle logique
GET http://localhost:3000/api/oeufs/remaining-eggs/new-logic?lotId=1&targetDate=2026-03-15

# Logique actuelle
GET http://localhost:3000/api/deces/remaining-eggs/current-logic?lotId=1&targetDate=2026-03-15
```

## Différences Principales

1. **Précision**: La logique actuelle est plus précise car elle utilise la production réelle
2. **Simplicité**: La nouvelle logique est plus simple à comprendre
3. **Performance**: La nouvelle logique est plus rapide (moins de requêtes DB)
4. **Maintenance**: La nouvelle logique est plus facile à maintenir

## Recommandations

- Utilisez la **nouvelle logique** pour des estimations rapides
- Utilisez la **logique actuelle** pour des calculs précis nécessitant l'historique complet