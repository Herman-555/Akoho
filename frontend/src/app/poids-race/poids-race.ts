import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { SituationService, PoidsRaceResult } from '../situation/situation.service';
import { RaceService } from '../race/race.service';
import { Race } from '../models/race.model';

@Component({
  selector: 'app-poids-race',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './poids-race.html',
  styleUrl: './poids-race.css'
})
export class PoidsRaceComponent implements OnInit {
  races = signal<Race[]>([]);
  result = signal<PoidsRaceResult | null>(null);
  error = signal<string | null>(null);
  loading = signal<boolean>(false);

  selectedRaceId: number | null = null;
  dateDebut: string = new Date().toISOString().split('T')[0];
  dateFin: string = new Date().toISOString().split('T')[0];

  private situationService = inject(SituationService);
  private raceService = inject(RaceService);

  ngOnInit(): void {
    this.raceService.getAll().subscribe({
      next: (data) => this.races.set(data),
      error: () => this.error.set('Erreur lors du chargement des races')
    });
  }

  onSearch(): void {
    this.error.set(null);
    this.result.set(null);

    if (!this.selectedRaceId) {
      this.error.set('Veuillez sélectionner une race');
      return;
    }
    if (!this.dateDebut || !this.dateFin) {
      this.error.set('Veuillez sélectionner les deux dates');
      return;
    }
    if (this.dateFin < this.dateDebut) {
      this.error.set('La date de fin doit être postérieure à la date de début');
      return;
    }

    this.loading.set(true);
    this.situationService.getPoidsAkoho(this.selectedRaceId, this.dateDebut, this.dateFin).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du calcul du poids');
        this.loading.set(false);
      }
    });
  }

  getRaceName(): string {
    const race = this.races().find(r => r.id_race === this.selectedRaceId);
    return race?.nom_race || '';
  }
}
