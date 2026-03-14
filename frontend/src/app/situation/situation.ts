import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { SituationService, Situation } from './situation.service';
import { LotService } from '../lot/lot.service';
import { Lot } from '../models/lot.model';

@Component({
  selector: 'app-situation',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './situation.html',
  styleUrl: './situation.css'
})
export class SituationComponent implements OnInit {
  lots = signal<Lot[]>([]);
  situation = signal<Situation | null>(null);
  allSituations = signal<Situation[]>([]);
  error = signal<string | null>(null);
  loading = signal<boolean>(false);
  loadingAll = signal<boolean>(false);
  warning = signal<string | null>(null);

  selectedLotId: number | string = 'all';
  selectedDate: string = new Date().toISOString().split('T')[0];
  selectedLot: Lot | null = null;
  isAllLots = true;

  // Computed: fusionne les deux sources en une seule liste pour le tableau
  displayRows = computed<Situation[]>(() => {
    if (this.isAllLots) return this.allSituations();
    const s = this.situation();
    return s ? [s] : [];
  });

  private situationService = inject(SituationService);
  private lotService = inject(LotService);

  ngOnInit(): void {
    this.loadLots();
  }

  loadLots(): void {
    this.lotService.getAll().subscribe({
      next: (data) => this.lots.set(data),
      error: () => this.error.set('Erreur lors du chargement des lots')
    });
  }

  onLotSelected(): void {
    if (this.selectedLotId === 'all') {
      this.isAllLots = true;
      this.selectedLot = null;
      this.warning.set(null);
    } else {
      this.isAllLots = false;
      this.selectedLotId = Number(this.selectedLotId);
      this.selectedLot = this.lots().find(lot => lot.id_lot === this.selectedLotId) || null;
      this.warning.set(null);
    }
  }

  onSearch(): void {
    this.error.set(null);
    this.warning.set(null);
    this.situation.set(null);
    this.allSituations.set([]);

    if (!this.selectedDate) {
      this.error.set('Veuillez sélectionner une date');
      return;
    }

    if (this.isAllLots) {
      this.loadAllSituations();
      return;
    }

    if (this.selectedLot && this.selectedLot.date_creation) {
      const creationDate = new Date(this.selectedLot.date_creation);
      const selectedDate = new Date(this.selectedDate);
      if (selectedDate < creationDate) {
        this.warning.set(`La date sélectionnée (${this.selectedDate}) est antérieure à la création du lot (${this.selectedLot.date_creation}). Le lot ne sera pas affiché.`);
      }
    }

    this.loading.set(true);
    this.situationService.getSituation(this.selectedLotId as number, this.selectedDate).subscribe({
      next: (data) => {
        this.situation.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du calcul de la situation');
        this.loading.set(false);
      }
    });
  }

  loadAllSituations(): void {
    this.loadingAll.set(true);
    this.situationService.getAllSituations(this.selectedDate).subscribe({
      next: (data) => {
        this.allSituations.set(data);
        this.loadingAll.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du calcul des situations');
        this.loadingAll.set(false);
      }
    });
  }
}
