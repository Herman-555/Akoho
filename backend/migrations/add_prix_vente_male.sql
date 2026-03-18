-- Migration: Ajouter colonne prix_vente_male dans la table race
-- Date: 2026-03-18

ALTER TABLE race ADD prix_vente_male DECIMAL(10, 2) NULL;

-- Optionnel: Initialiser avec la meme valeur que prix_vente
UPDATE race SET prix_vente_male = prix_vente WHERE prix_vente_male IS NULL;
