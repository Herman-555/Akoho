Voici la version mise à jour et détaillée du fichier todo.md. J'ai intégré les nouvelles règles de gestion et les champs de la base de données que j'ai découverts en analysant le code source, en particulier les services du backend.

Vous pouvez copier et coller ce contenu pour remplacer l'intégralité de votre fichier todo.md.

---

# Documentation du Projet AKOHO - Gestion d'Élevage de Poulets

## Contexte

Application web full-stack de gestion d'élevage de poulets (volaille) développée avec :
- **Backend** : Node.js + Express (API REST)
- **Frontend** : Angular 21
- **Base de données** : SQL Server

L'application permet de gérer le cycle de vie complet d'un élevage : races, lots de poulets, nutrition, mortalité, ponte d'œufs, couvaison et éclosion, ainsi que le calcul de la situation financière.

---

## Architecture du Projet

Le projet est divisé en trois parties principales :
1.  **frontend** : Une application monopage (SPA) développée avec Angular, responsable de l'interface utilisateur.
2.  **backend** : Une API RESTful développée avec Node.js et Express, qui gère toute la logique métier et la communication avec la base de données.
3.  **database** : Contient les scripts SQL pour la création de la base de données, des tables et l'insertion de données initiales.

---

## Fonctionnalités Implémentées

### 1. Gestion des Races (`/api/race`)

**Description** : Gestion des différentes races de poulets, incluant leurs caractéristiques de reproduction, de mortalité et leurs prix.

**Champs** :
| Champ | Type | Description |
|---|---|---|
| `id_race` | INT | Identifiant unique |
| `nom_race` | VARCHAR(255) | Nom de la race |
| `prix_achat` | DECIMAL(10,2) | Prix d'achat au gramme |
| `prix_vente` | DECIMAL(10,2) | Prix de vente au gramme |
| `prix_oeuf` | DECIMAL(10,2) | Prix unitaire d'un œuf |
| `prix_nourriture` | DECIMAL(10,2) | Prix de la nourriture au gramme |
| `male` | DECIMAL(5,2) | Pourcentage de mâles à la naissance (%) |
| `femelle` | DECIMAL(5,2) | Pourcentage de femelles à la naissance (%) |
| `nb_jours_eclosion` | INT | Durée d'incubation des œufs (jours) |
| `capacite_ponte` | INT | Nombre d'œufs pondus par une femelle par semaine |
| `oeufs_pourris` | DECIMAL(5,2) | Pourcentage d'œufs qui n'écloront pas (%) |
| `deces_male` | DECIMAL(5,2) | Taux de mortalité hebdomadaire des mâles (%) |
| `deces_femelle` | DECIMAL(5,2) | Taux de mortalité hebdomadaire des femelles (%) |

**Règles métier** :
- La somme des pourcentages `male` et `femelle` doit être égale à 100.

---

### 2. Gestion des Lots (`/api/lot`)

**Description** : Un lot représente un groupe de poulets de même race, créé soit par achat, soit par éclosion.

**Champs** :
| Champ | Type | Description |
|---|---|---|
| `id_lot` | INT | Identifiant unique |
| `id_race` | INT | Référence à la race |
| `age` | INT | Âge en semaines à l'achat (0 si éclosion) |
| `date_creation` | DATE | Date de création du lot |
| `nbr_poulet` | INT | Nombre total initial de poulets |
| `nbr_male` | INT | Nombre initial de mâles |
| `nbr_femelle` | INT | Nombre initial de femelles |
| `id_couverture` | INT | `NULL` si acheté, sinon référence à la couverture d'origine |
| `poids_initial` | DECIMAL | Poids initial au gramme (0 si né par éclosion) |

**Règles métier** :
- Lors de la création, `nbr_male` et `nbr_femelle` sont calculés à partir de `nbr_poulet` et des pourcentages (`male`, `femelle`) de la race.
- Si `id_couverture = NULL` → lot acheté (avec `poids_initial > 0`).
- Si `id_couverture ≠ NULL` → lot issu d'une éclosion (`poids_initial = 0`, `age = 0`).

---

### 3. Gestion de la Nutrition (`/api/nutrition`)

**Description** : Définit les paramètres nutritionnels (gain de poids et consommation) par race et par semaine d'âge.

**Tables** :
- `nutrition` : Associe une race à un plan nutritionnel.
- `nutrition_detail` : Détails par semaine.

**Champs `nutrition_detail`** :
| Champ | Type | Description |
|---|---|---|
| `semaine` | INT | Semaine d'âge (0-12) |
| `variation_poids` | DECIMAL | Gain de poids hebdomadaire en grammes |
| `nourriture` | DECIMAL | Quantité de nourriture hebdomadaire en grammes |

---

### 4. Gestion des Décès (`/api/deces`)

**Description** : Enregistrement des mortalités dans les lots, avec une distinction par sexe.

**Champs** :
| Champ | Type | Description |
|---|---|---|
| `id_deces` | INT | Identifiant |
| `date_deces` | DATE | Date du décès |
| `id_lot` | INT | Lot concerné |
| `nbr_deces` | INT | Nombre total de poulets décédés |
| `nbr_male_deces` | INT | (Calculé) Nombre de mâles décédés |
| `nbr_femelle_deces`| INT | (Calculé) Nombre de femelles décédées |

**Règles métier** :
- Le `nbr_deces` fourni dans la requête est réparti en `nbr_male_deces` et `nbr_femelle_deces` en se basant sur les taux de mortalité (`deces_male`, `deces_femelle`) de la race.
- Le nombre de mâles et de femelles restants dans le lot est mis à jour après chaque enregistrement.

---

### 5. Gestion des Œufs (`/api/oeufs`)

**Description** : Recensement des œufs pondus par lot.

**Champs** :
| Champ | Type | Description |
|---|---|---|
| `id_lot_oeufs` | INT | Identifiant du lot d'œufs |
| `id_lot` | INT | Lot de poulets source |
| `date_recensement`| DATE | Date de la ponte |
| `nbr_oeufs` | INT | Nombre d'œufs |

---

### 6. Couverture des Œufs (`/api/couverture-oeufs`)

**Description** : Mise en couveuse d'un lot d'œufs pour éclosion.

**Règles métier** :
- Un lot d'œufs ne peut être couvert qu'**une seule fois**.
- La date de couverture doit être **≥ date_recensement** du lot d'œufs.

---

### 7. Éclosion des Œufs (`/api/eclosion-oeufs`)

**Description** : Enregistrement de l'éclosion et création automatique d'un nouveau lot de poussins.

**Règles métier** :
- Une couverture ne peut avoir qu'**une seule éclosion**.
- `nbr_oeufs_pourris` est calculé : `nbr_oeufs_couverture - nbr_oeufs_eclos`.
- **Création automatique d'un nouveau lot** si `nbr_oeufs_eclos > 0` :
  - `age = 0`, `poids_initial = 0`
  - `nbr_poulet = nbr_oeufs_eclos`
  - `nbr_male` et `nbr_femelle` sont calculés selon les pourcentages de la race.

---

### 8. Situation (`/api/situation`)

**Description** : Endpoint le plus complexe. Calcule l'état financier et physique d'un lot à une date `t` donnée.

**Paramètres** : `?lotId=X&date=YYYY-MM-DD`

**Données retournées (principales)** :
| Champ | Description |
|---|---|
| `nbr_male_vivant` | Nombre de mâles vivants à la date `t` |
| `nbr_femelle_vivant` | Nombre de femelles vivantes à la date `t` |
| `total_deces` | Total des décès cumulés |
| `oeufs_restants` | Œufs disponibles (non couvés) |
| `poids_moyen` | Poids moyen estimé d'un poulet (g) |
| `valeur_poulets` | Valeur totale des poulets vivants |
| `valeur_oeufs` | Valeur des œufs disponibles |
| `cout_achat` | Coût d'achat initial du lot (si applicable) |
| `cout_nourriture` | Coût total de la nourriture consommée |
| `benefice` | `(valeur_poulets + valeur_oeufs) - (cout_achat + cout_nourriture)` |

**Règles métier complexes** :

#### Calcul des poulets vivants par sexe :
- Le calcul part du nombre initial (`nbr_male`, `nbr_femelle`) et soustrait les décès enregistrés pour chaque sexe jusqu'à la date `t`.

#### Calcul du poids moyen :
1.  Le calcul se base sur le `poids_initial` du lot.
2.  Pour chaque semaine complète écoulée depuis la `date_creation`, on ajoute la `variation_poids` (depuis `nutrition_detail`).
3.  Pour les jours de la semaine en cours, on ajoute une variation au prorata journalier.

#### Calcul de la nourriture consommée (`cout_nourriture`) :
- Le calcul est effectué **au jour le jour** depuis la `date_creation` jusqu'à la date `t`.
- Chaque jour, on calcule le nombre de poulets vivants (mâles + femelles).
- La consommation journalière est une interpolation de la consommation hebdomadaire (`nourriture` dans `nutrition_detail`).
- Le coût total est la somme de `consommation_journaliere * prix_nourriture_gramme`.

#### Calcul des œufs pondus et restants :
- **Œufs pondus** : Calculés au jour le jour en fonction du nombre de femelles vivantes et de la `capacite_ponte` de la race.
- **Œufs restants** : `total_oeufs_pondus - total_oeufs_mis_en_couveuse`.

---

## Points d'API

| Méthode | Route | Description |
|---|---|---|
| GET, POST, PUT, DELETE | `/api/race` | CRUD pour les races |
| GET, POST, PUT, DELETE | `/api/lot` | CRUD pour les lots |
| GET, POST, PUT, DELETE | `/api/nutrition` | CRUD pour la nutrition |
| GET, POST, PUT, DELETE | `/api/deces` | CRUD pour les décès |
| GET, POST, PUT, DELETE | `/api/oeufs` | CRUD pour les œufs |
| GET, POST | `/api/couverture-oeufs`| Lister et créer des couvertures |
| GET, POST | `/api/eclosion-oeufs`| Lister et créer des éclosions |
| GET | `/api/situation` | Calculer la situation d'un lot |

---

## Configuration et Démarrage

### Backend
- Port : **3000**
- CORS configuré pour `http://localhost:4200`
- Base de données : SQL Server (config dans database.js)

```bash
# Backend
cd backend
npm install
npm start
```

### Frontend
- Port : **4200**
- URL de l'API : Configurée dans api.config.ts

```bash
# Frontend
cd frontend
npm install
ng serve
```