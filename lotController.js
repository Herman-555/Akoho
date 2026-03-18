const lotModel = require("../models/LotModel");
const alimentationModel = require("../models/AlimentationModel");
const matyModel = require("../models/MatyModel");
const atodyModel = require("../models/Atody");

async function getLots(req,res){

    try{

        const lots = await lotModel.getLots();

        res.json(lots);

    }catch(err){

        console.log(err);
        res.status(500).send(err.message);

    }

}

async function addLot(req,res){

    try{

        const lot = req.body;
        const result = await lotModel.addLot(lot);
        res.status(201).json(result);

    }catch(err){

        console.log(err);
        res.status(500).send(err.message);

    }

}
    async function getLotParDate(req,res){

        try{
            const date = req.query.date;
            const lots = await lotModel.getLotParDate(date);
            res.json(lots);

        } catch(err){

            console.log(err);
            res.status(500).send(err.message);

    }

}

async function getDetailsParDate(req,res){
    try{
        const date = req.query.date;
        const lots = await lotModel.getDetailsParDate(date);
        const alimentation = await alimentationModel.getAll();
        const matyRecords = await matyModel.getMatyBeforeDate(date);
        const atodyRecords = await atodyModel.getAtodyBeforeDate(date);

        // Group maty records by lot
        const matyByLot = {};
        for (const m of matyRecords) {
            if (!matyByLot[m.idLot]) matyByLot[m.idLot] = [];
            matyByLot[m.idLot].push({ date: new Date(new Date(m.dateDeces).setHours(0, 0, 0, 0)), nbrMaty: m.nbrMaty });
        }

        // Group atody records by lot
        const atodyByLot = {};
        for (const a of atodyRecords) {
            if (!atodyByLot[a.idLot]) atodyByLot[a.idLot] = [];
            atodyByLot[a.idLot].push({ date: new Date(new Date(a.dateCollecte).setHours(0, 0, 0, 0)), nbrAtody: a.nbrAtody });
        }

        const details = lots.map(lot => {
            const filterDate = new Date(date);
            const startDate = new Date(lot.dateDebut);
            const totalDays = Math.floor((filterDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const initialSemaine = lot.semaine || 0;
            const elapsedWeeks = Math.floor(totalDays / 7);
            const remainingDays = totalDays % 7;
            const completeWeeks = initialSemaine + elapsedWeeks;

            const raceAlim = alimentation
                .filter(a => a.idRace === lot.idrace)
                .sort((a, b) => a.semaine - b.semaine);

            const lotMaty = matyByLot[lot.idLot] || [];

            // Calculate poidsMoyen: start from lot.poidsMoyen, add variations only for weeks after initialSemaine
            let poidsMoyen = lot.poidsMoyen;
            for (const a of raceAlim) {
                if (a.semaine > initialSemaine && a.semaine <= completeWeeks) {
                    poidsMoyen += a.variationPoids;
                } else if (a.semaine === completeWeeks + 1 && remainingDays > 0) {
                    poidsMoyen += (a.variationPoids / 7) * remainingDays;
                }
            }

            // Calculate sakafo day by day, using the alive count for each day
            let sakafo = 0;
            for (let day = 0; day < totalDays; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + day);
                currentDate.setHours(0, 0, 0, 0);

                const weekNum = initialSemaine + Math.floor(day / 7) + 1;
                const alimForWeek = raceAlim.find(a => a.semaine === weekNum);

                if (alimForWeek) {
                    const dailyFoodPerChicken = alimForWeek.poidsSakafo / 7;
                    let dead = 0;
                    for (const m of lotMaty) {
                        if (m.date <= currentDate) {
                            dead += m.nbrMaty;
                        }
                    }
                    const alive = lot.nbrPoulet - dead;
                    sakafo += dailyFoodPerChicken * alive;
                }
            }

            let paParUnite = lot.prixAchatParUnite;
            if(lot.estEclos == 1) {

                paParUnite = 0;

            }

            const pvAkoho = poidsMoyen * (lot.pvakohoParUnite || 0);
            const prixSakafo = sakafo * (lot.prixSakafoGramme || 0);

            const totalPrixSakafo = prixSakafo;
            const totalPvAkoho = pvAkoho * lot.nbPoule;
            const totalPrixAchat = (paParUnite || 0) * lot.nbrPoulet;
            const benefice = (totalPvAkoho + lot.coutAtody) - (totalPrixAchat + totalPrixSakafo);

            const ageSem = completeWeeks;
            const ageJour = remainingDays;
            const age = `S${ageSem} + ${ageJour}j`;

            // Calculate female/male stats and laying capacity
            const pourcentageFemelle = lot.pourcentageFemele || 0;
            const pourcentageMatyFemelle = lot.pourcentageMatyFemelle || 0;
            const capaciteParPoule = lot.capaciteAPondre || 0;

            // Initial females and males
            const initialFemales = lot.estEclos
                ? Math.floor(lot.nbrPoulet * (pourcentageFemelle / 100))
                : lot.nbrPoulet; // Non-hatched lots are 100% female
            const initialMales = lot.nbrPoulet - initialFemales;

            // Deaths distribution male/femelle
            let maleDeaths = 0;
            let femaleDeaths = 0;

            if (!lot.estEclos) {
                // Lot femelle-only: tous les morts sont des femelles
                femaleDeaths = lot.totalMaty;
            } else {
                // Lot mixte: suivre pourcentageMatyFemelle mais plafonner les males
                const expectedMaleDeaths = Math.floor(lot.totalMaty * (1 - pourcentageMatyFemelle / 100));
                if (expectedMaleDeaths > initialMales) {
                    maleDeaths = initialMales;
                    femaleDeaths = lot.totalMaty - maleDeaths;
                } else {
                    maleDeaths = expectedMaleDeaths;
                    femaleDeaths = lot.totalMaty - expectedMaleDeaths;
                }
            }

            const currentFemales = Math.max(0, initialFemales - femaleDeaths);
            const currentMales = Math.max(0, initialMales - maleDeaths);

            // Capacite: calcul séquentiel chronologique
            // À chaque mort de femelle, on recalcule capacité = capacité * (survivantes / avant)
            // À chaque ponte, on soustrait les oeufs de la capacité
            let remainingCapacity = 0;
            if (initialFemales > 0 && capaciteParPoule > 0) {
                const lotAtody = atodyByLot[lot.idLot] || [];

                // Créer les événements de mort femelle
                const events = [];

                // Pour les morts, on doit calculer combien de femelles meurent à chaque date
                let cumulativeMaleDeaths = 0;
                let cumulativeFemaleDeaths = 0;

                for (const m of lotMaty) {
                    let femaleDeath = 0;
                    if (!lot.estEclos) {
                        // Lot femelle-only: tous les morts sont des femelles
                        femaleDeath = m.nbrMaty;
                    } else {
                        // Lot mixte
                        const expectedMaleDeathsTotal = Math.floor((cumulativeMaleDeaths + cumulativeFemaleDeaths + m.nbrMaty) * (1 - pourcentageMatyFemelle / 100));
                        let maleDeath = expectedMaleDeathsTotal - cumulativeMaleDeaths;

                        // Plafonner si on dépasse le nombre de mâles
                        if (cumulativeMaleDeaths + maleDeath > initialMales) {
                            maleDeath = Math.max(0, initialMales - cumulativeMaleDeaths);
                        }
                        femaleDeath = m.nbrMaty - maleDeath;
                        cumulativeMaleDeaths += maleDeath;
                    }

                    if (femaleDeath > 0) {
                        events.push({ date: m.date, type: 'mort', nbrFemelleMorte: femaleDeath });
                    }
                    cumulativeFemaleDeaths += femaleDeath;
                }

                // Ajouter les événements de ponte
                for (const a of lotAtody) {
                    events.push({ date: a.date, type: 'ponte', nbrOeufs: a.nbrAtody });
                }

                // Trier par date (morts AVANT pontes si même date)
                events.sort((a, b) => {
                    const diff = a.date - b.date;
                    if (diff !== 0) return diff;
                    // Si même date, les morts passent avant les pontes
                    return a.type === 'mort' ? -1 : 1;
                });

                // Calculer séquentiellement
                remainingCapacity = initialFemales * capaciteParPoule;
                let femellesVivantes = initialFemales;

                for (const event of events) {
                    if (event.type === 'mort') {
                        // Appliquer le pourcentage de survie à la capacité restante
                        const survivantes = femellesVivantes - event.nbrFemelleMorte;
                        if (femellesVivantes > 0) {
                            remainingCapacity = remainingCapacity * (survivantes / femellesVivantes);
                        }
                        femellesVivantes = survivantes;
                    } else if (event.type === 'ponte') {
                        // Soustraire les oeufs pondus
                        remainingCapacity = remainingCapacity - event.nbrOeufs;
                    }
                }

                remainingCapacity = Math.max(0, remainingCapacity);
            }

            return {
                idLot: lot.idLot,
                raceName: lot.raceName,
                nbrPoulet: lot.nbrPoulet,
                prixAchat: Math.round(totalPrixAchat * 100) / 100,
                prixAchatParUnite: lot.prixAchatParUnite,
                pvakohoParUnite: lot.pvakohoParUnite,
                totalMaty: lot.totalMaty,
                nbPoule: lot.nbPoule,
                nbAtody: lot.nbAtody,
                coutAtody: lot.coutAtody,
                sakafo: Math.round(sakafo * 100) / 100,
                poidsMoyen: Math.round(poidsMoyen * 100) / 100,
                pvAkoho: Math.round(totalPvAkoho * 100) / 100,
                prixSakafo: Math.round(totalPrixSakafo * 100) / 100,
                benefice: Math.round(benefice * 100) / 100,
                age,
                capaciteAPondre: Math.round(remainingCapacity * 100) / 100,
                nbrMale: currentMales,
                nbrFemelle: currentFemales
            };
        });

        res.json(details);
    }catch(err){
        console.log(err);
        res.status(500).send(err.message);
    }
}

module.exports = { getLots, addLot, getLotParDate, getDetailsParDate };