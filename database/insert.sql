-- Nettoyage: supprimer les doublons nutrition pour id_race = 1
DELETE FROM nutrition_detail WHERE id_nutrition IN (SELECT id_nutrition FROM nutrition WHERE id_race = 1);
DELETE FROM nutrition WHERE id_race = 1;
GO

-- Insertion nutrition pour la race borbonèze (id_race = 1)
INSERT INTO nutrition (id_race) VALUES (1);
GO

-- Insertion des détails avec TOP 1 pour éviter l'erreur sous-requête multiple
DECLARE @id_nutrition INT = (SELECT TOP 1 id_nutrition FROM nutrition WHERE id_race = 1);

INSERT INTO nutrition_detail (id_nutrition, semaine, variation_poids, nourriture) VALUES
(@id_nutrition, 0, 50, 0),
(@id_nutrition, 1, 20, 75),
(@id_nutrition, 2, 25, 80),
(@id_nutrition, 3, 30, 100),
(@id_nutrition, 4, 40, 150),
(@id_nutrition, 5, 80, 170),
(@id_nutrition, 6, 85, 190),
(@id_nutrition, 7, 100, 200),
(@id_nutrition, 8, 100, 250),
(@id_nutrition, 9, 90, 270),
(@id_nutrition, 10, 140, 290),
(@id_nutrition, 11, 200, 300),
(@id_nutrition, 12, 220, 370),
(@id_nutrition, 13, 265, 390),
(@id_nutrition, 14, 285, 350),
(@id_nutrition, 15, 300, 300),
(@id_nutrition, 16, 350, 450),
(@id_nutrition, 17, 400, 500),
(@id_nutrition, 18, 420, 400),
(@id_nutrition, 19, 430, 500),
(@id_nutrition, 20, 500, 500),
(@id_nutrition, 21, 530, 650),
(@id_nutrition, 22, 600, 600),
(@id_nutrition, 23, 400, 750),
(@id_nutrition, 24, 100, 750),
(@id_nutrition, 25, 0, 600);
GO

-- INSERT INTO lot (nom_lot, date_creation, nbr_poulet) VALUES ('Lot 1', '2026-01-01', 500);