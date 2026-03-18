import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RaceService } from './race.service';
import { Race } from '../models/race.model';

@Component({
  selector: 'app-race-list',
  imports: [FormsModule],
  templateUrl: './race-list.html',
  styleUrl: './race-list.css'
})
export class RaceListComponent implements OnInit {
  races = signal<Race[]>([]);
  error = signal<string | null>(null);
  editingId = signal<number | null>(null);

  nomRace = '';
  prixAchat: number | null = null;
  prixVente: number | null = null;
  prixVenteMale: number | null = null;
  prixOeuf: number | null = null;
  prixNourriture: number | null = null;
  male: number | null = null;
  femelle: number | null = null;
  nbJoursEclosion: number | null = null;
  capacitePonte: number | null = null;
  oeufsPourris: number | null = null;
  decesMale: number | null = null;
  decesFemelle: number | null = null;

  editNomRace = '';
  editPrixAchat: number | null = null;
  editPrixVente: number | null = null;
  editPrixVenteMale: number | null = null;
  editPrixOeuf: number | null = null;
  editPrixNourriture: number | null = null;
  editMale: number | null = null;
  editFemelle: number | null = null;
  editNbJoursEclosion: number | null = null;
  editCapacitePonte: number | null = null;
  editOeufsPourris: number | null = null;
  editDecesMale: number | null = null;
  editDecesFemelle: number | null = null;

  private raceService = inject(RaceService);

  ngOnInit(): void {
    this.loadRaces();
  }

  loadRaces(): void {
    this.raceService.getAll().subscribe({
      next: (data) => this.races.set(data),
      error: () => this.error.set('Erreur lors du chargement des races')
    });
  }

  onCreate(): void {
    this.error.set(null);
    if (!this.nomRace) { this.error.set('Veuillez saisir un nom'); return; }
    this.raceService.create({
      nom_race: this.nomRace,
      prix_achat: this.prixAchat,
      prix_vente: this.prixVente,
      prix_vente_male: this.prixVenteMale,
      prix_oeuf: this.prixOeuf,
      prix_nourriture: this.prixNourriture,
      male: this.male,
      femelle: this.femelle,
      nb_jours_eclosion: this.nbJoursEclosion,
      capacite_ponte: this.capacitePonte,
      oeufs_pourris: this.oeufsPourris,
      deces_male: this.decesMale,
      deces_femelle: this.decesFemelle
    }).subscribe({
      next: () => {
        this.loadRaces();
        this.nomRace = '';
        this.prixAchat = null;
        this.prixVente = null;
        this.prixVenteMale = null;
        this.prixOeuf = null;
        this.prixNourriture = null;
        this.male = null;
        this.femelle = null;
        this.nbJoursEclosion = null;
        this.capacitePonte = null;
        this.oeufsPourris = null;
        this.decesMale = null;
        this.decesFemelle = null;
      },
      error: () => this.error.set('Erreur lors de la création')
    });
  }

  onEdit(race: Race): void {
    this.editingId.set(race.id_race);
    this.editNomRace = race.nom_race ?? '';
    this.editPrixAchat = race.prix_achat;
    this.editPrixVente = race.prix_vente;
    this.editPrixVenteMale = race.prix_vente_male;
    this.editPrixOeuf = race.prix_oeuf;
    this.editPrixNourriture = race.prix_nourriture;
    this.editMale = race.male;
    this.editFemelle = race.femelle;
    this.editNbJoursEclosion = race.nb_jours_eclosion;
    this.editCapacitePonte = race.capacite_ponte;
    this.editOeufsPourris = race.oeufs_pourris;
    this.editDecesMale = race.deces_male;
    this.editDecesFemelle = race.deces_femelle;
  }

  onCancelEdit(): void {
    this.editingId.set(null);
  }

  onSaveEdit(id: number): void {
    this.error.set(null);
    this.raceService.update(id, {
      nom_race: this.editNomRace,
      prix_achat: this.editPrixAchat,
      prix_vente: this.editPrixVente,
      prix_vente_male: this.editPrixVenteMale,
      prix_oeuf: this.editPrixOeuf,
      prix_nourriture: this.editPrixNourriture,
      male: this.editMale,
      femelle: this.editFemelle,
      nb_jours_eclosion: this.editNbJoursEclosion,
      capacite_ponte: this.editCapacitePonte,
      oeufs_pourris: this.editOeufsPourris,
      deces_male: this.editDecesMale,
      deces_femelle: this.editDecesFemelle
    }).subscribe({
      next: () => { this.editingId.set(null); this.loadRaces(); },
      error: () => this.error.set('Erreur lors de la modification')
    });
  }

  onDelete(id: number): void {
    this.error.set(null);
    this.raceService.delete(id).subscribe({
      next: () => this.loadRaces(),
      error: () => this.error.set('Erreur lors de la suppression')
    });
  }
}
