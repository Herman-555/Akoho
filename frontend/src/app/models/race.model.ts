export interface Race {
  id_race: number;
  nom_race: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  prix_oeuf: number | null;
  prix_nourriture: number | null;
  male: number | null;
  femelle: number | null;
  nb_jours_eclosion: number | null;
  capacite_ponte: number | null;
  oeufs_pourris: number | null;
  deces_male: number | null;
  deces_femelle: number | null;
}
