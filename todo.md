# Documentation du Projet AKOHO - Gestion d'Élevage de Poulets

## Contexte

Application web full-stack de gestion d'élevage de poulets (volaille) développée avec :
- **Backend** : Node.js + Express (API REST)
- **Frontend** : Angular 21
- **Base de données** : SQL Server

L'application permet de gérer le cycle de vie complet d'un élevage : races, lots de poulets, nutrition, mortalité, ponte d'œufs, couvaison et éclosion.

---

## Architecture du Projet

---

## Fonctionnalités Implémentées

### 1. Gestion des Races (`/api/race`)

**Description** : Gestion des différentes races de poulets avec leurs prix associés.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_race | INT | Identifiant unique |
| nom_race | VARCHAR(255) | Nom de la race |
| prix_achat | DECIMAL(10,2) | Prix d'achat au gramme |
| prix_vente | DECIMAL(10,2) | Prix de vente au gramme |
| prix_oeuf | DECIMAL(10,2) | Prix unitaire d'un œuf |
| prix_nourriture | DECIMAL(10,2) | Prix de la nourriture au gramme |

**Opérations CRUD** : GET, POST, PUT, DELETE

---

### 2. Gestion des Lots (`/api/lot`)

**Description** : Un lot représente un groupe de poulets de même race, créé soit par achat, soit par éclosion.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_lot | INT | Identifiant unique |
| id_race | INT | Référence à la race |
| age | INT | Âge en semaines à l'achat |
| date_creation | DATE | Date de création du lot |
| nbr_poulet | INT | Nombre initial de poulets |
| id_couverture | INT | NULL si acheté, sinon référence à la couverture d'origine |
| poids_initial | DECIMAL | Poids initial au gramme (0 si né par éclosion) |

**Règles métier** :
- L'âge doit être compris entre **0 et 12 semaines**
- Si `id_couverture = NULL` → lot acheté (avec poids_initial > 0)
- Si `id_couverture ≠ NULL` → lot issu d'une éclosion (poids_initial = 0)

---

### 3. Gestion de la Nutrition (`/api/nutrition`)

**Description** : Définit les paramètres nutritionnels par race et par semaine d'âge.

**Tables** :
- `nutrition` : Associe une race à un plan nutritionnel
- `nutrition_detail` : Détails par semaine

**Champs nutrition_detail** :
| Champ | Type | Description |
|-------|------|-------------|
| id_nutrition_fille | INT | Identifiant |
| id_nutrition | INT | Référence au plan |
| semaine | INT | Semaine d'âge (0-12) |
| variation_poids | DECIMAL | Variation de poids en grammes |
| nourriture | DECIMAL | Quantité de nourriture en grammes |

**Règles métier** :
- La semaine doit être entre **0 et 12**
- La quantité de nourriture doit être **positive**
- Création automatique du header nutrition si inexistant pour la race

---

### 4. Gestion des Décès (`/api/deces`)

**Description** : Enregistrement des mortalités dans les lots.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_deces | INT | Identifiant |
| date_deces | DATE | Date du décès |
| id_lot | INT | Lot concerné |
| nbr_deces | INT | Nombre de poulets décédés |

**Règles métier** :
- Le nombre de décès doit être **positif ou nul**

---

### 5. Gestion des Œufs (`/api/oeufs`)

**Description** : Recensement des œufs pondus par lot.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_lot_oeufs | INT | Identifiant du lot d'œufs |
| id_lot | INT | Lot de poulets source |
| date_recensement | DATE | Date de la ponte |
| nbr_oeufs | INT | Nombre d'œufs |

**Règles métier** :
- Le nombre d'œufs doit être **positif**

---

### 6. Couverture des Œufs (`/api/couverture-oeufs`)

**Description** : Mise en couveuse d'un lot d'œufs pour éclosion.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_couverture | INT | Identifiant |
| id_lot_oeufs | INT | Lot d'œufs mis en couveuse |
| nbr_oeufs | INT | Nombre d'œufs (= total du lot) |
| date_couverture | DATE | Date de mise en couveuse |

**Règles métier** :
- Un lot d'œufs ne peut être couvert qu'**une seule fois**
- La date de couverture doit être **>= date_recensement** du lot d'œufs
- Tous les œufs du lot sont mis en couverture automatiquement

---

### 7. Éclosion des Œufs (`/api/eclosion-oeufs`)

**Description** : Enregistrement de l'éclosion et création automatique d'un nouveau lot de poussins.

**Champs** :
| Champ | Type | Description |
|-------|------|-------------|
| id_eclosion | INT | Identifiant |
| date_eclosion | DATE | Date de l'éclosion |
| nbr_oeufs_eclos | INT | Nombre d'œufs éclos |
| id_couverture | INT | Couverture source |
| id_lot_oeufs | INT | Lot d'œufs source |
| nbr_oeufs_pourris | INT | Œufs non éclos (calculé) |

**Règles métier** :
- Une couverture ne peut avoir qu'**une seule éclosion**
- `nbr_oeufs_eclos` doit être entre **0 et nbr_oeufs** de la couverture
- La date d'éclosion doit être **>= date_couverture**
- `nbr_oeufs_pourris = nbr_oeufs_couverture - nbr_oeufs_eclos`
- **Création automatique d'un nouveau lot** si `nbr_oeufs_eclos > 0` :
  - `age = 0`
  - `nbr_poulet = nbr_oeufs_eclos`
  - `id_couverture = id de la couverture`
  - `poids_initial = 0`

---

### 8. Situation (`/api/situation`)

**Description** : Calcul de la situation financière et de l'état d'un lot à une date donnée.

**Paramètres** : `?lotId=X&date=YYYY-MM-DD`

**Données retournées** :
| Champ | Description | Formule |
|-------|-------------|---------|
| nbr_poulet_a_date_t | Poulets vivants | `nbr_initial - total_deces` |
| nbr_deces | Total décès cumulés | Somme des décès jusqu'à la date |
| nbr_oeufs | Œufs disponibles | Œufs non envoyés en couveuse |
| poids_moyen | Poids moyen (g) | Calcul basé sur nutrition |
| estimation_poulet | Valeur des poulets | `poids_moyen × prix_vente × nbr_poulet` |
| estimation_oeufs | Valeur des œufs | `nbr_oeufs × prix_oeuf` |
| prix_achat_akoho | Coût d'achat initial | Si acheté : `prix_achat × nbr_initial × poids_initial` |
| prix_sakafo | Coût nourriture | `nourriture_consommée × prix_nourriture` |

**Règles métier complexes** :

#### Calcul du poids moyen :
1. Le jour de création = jour 0
2. Pour chaque semaine complète, ajouter `variation_poids` de la table nutrition
3. Pour la semaine en cours : interpolation linéaire `(variation_poids / 7) × jours_écoulés`
4. Si `poids_initial > 0` → base = poids_initial, sinon base = variation_poids semaine 0

#### Calcul de la nourriture consommée :
1. Boucle par semaine depuis la création
2. Pour chaque semaine : `nbr_poulets_vivants × nourriture_hebdomadaire`
3. En cas de décès : calcul au prorata avant/après le décès
4. Si données nutrition absentes pour une semaine → utiliser la dernière valeur connue

---

## Points d'API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/race` | Liste toutes les races |
| GET | `/api/race/:id` | Détail d'une race |
| POST | `/api/race` | Créer une race |
| PUT | `/api/race/:id` | Modifier une race |
| DELETE | `/api/race/:id` | Supprimer une race |
| GET | `/api/lot` | Liste tous les lots |
| GET | `/api/lot/:id` | Détail d'un lot |
| POST | `/api/lot` | Créer un lot |
| PUT | `/api/lot/:id` | Modifier un lot |
| DELETE | `/api/lot/:id` | Supprimer un lot |
| GET | `/api/nutrition` | Liste nutrition_detail avec race |
| GET | `/api/nutrition/:id` | Détail nutrition |
| POST | `/api/nutrition` | Créer nutrition_detail |
| PUT | `/api/nutrition/:id` | Modifier nutrition_detail |
| DELETE | `/api/nutrition/:id` | Supprimer nutrition_detail |
| GET | `/api/deces` | Liste des décès |
| POST | `/api/deces` | Enregistrer décès |
| PUT | `/api/deces/:id` | Modifier décès |
| DELETE | `/api/deces/:id` | Supprimer décès |
| GET | `/api/oeufs` | Liste des lots d'œufs |
| POST | `/api/oeufs` | Créer lot d'œufs |
| PUT | `/api/oeufs/:id` | Modifier lot d'œufs |
| DELETE | `/api/oeufs/:id` | Supprimer lot d'œufs |
| GET | `/api/couverture-oeufs` | Liste des couvertures |
| POST | `/api/couverture-oeufs` | Créer couverture |
| GET | `/api/eclosion-oeufs` | Liste des éclosions |
| POST | `/api/eclosion-oeufs` | Créer éclosion |
| GET | `/api/situation?lotId=X&date=Y` | Calculer situation |

---

## Configuration

### Backend
- Port : **3000**
- CORS configuré pour `http://localhost:4200`
- Base de données : SQL Server (config dans `backend/config/database.js`)

### Frontend
- Port : **4200**
- API URL : Configuré dans `frontend/src/app/config/api.config.ts`

---

## Démarrage

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
ng serve
