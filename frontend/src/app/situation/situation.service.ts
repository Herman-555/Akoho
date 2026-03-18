import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface Situation {
  id_lot: number;
  date_consultation: string;
  nbr_poulet_a_date_t: number;
  nbr_deces: number;
  nbr_oeufs: number;
  poids_moyen: number;
  estimation_poulet: number;
  estimation_femelles?: number;
  estimation_males?: number;
  estimation_oeufs: number;
  prix_achat_akoho: number;
  prix_sakafo: number;
  chiffre_affaire_total: number;
  depense_total: number;
  benefice_total: number;
  // Nouveaux champs pour les œufs estimatifs restants
  males_actuels?: number;
  femelles_actuelles?: number;
  capacite_ponte_totale?: number;
  oeufs_produits?: number;
  oeufs_restants_estimatifs?: number;
  perte?: number;
  perte_valeur?: number;
}

export interface PoidsRaceResult {
  id_race: number;
  date_debut: string;
  date_fin: string;
  poids: number;
  age_jours: number;
}

@Injectable({ providedIn: 'root' })
export class SituationService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/situation`;

  getSituation(lotId: number, date: string): Observable<Situation> {
    return this.http.get<Situation>(this.apiUrl, {
      params: {
        lotId: lotId.toString(),
        date: date
      }
    });
  }

  getAllSituations(date: string): Observable<Situation[]> {
    return this.http.get<Situation[]>(`${this.apiUrl}/all`, {
      params: { date }
    });
  }

  getPoidsAkoho(idRace: number, dateDebut: string, dateFin: string): Observable<PoidsRaceResult> {
    return this.http.get<PoidsRaceResult>(`${this.apiUrl}/poids-race`, {
      params: { idRace: idRace.toString(), dateDebut, dateFin }
    });
  }
}
