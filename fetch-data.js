const fs = require('fs');
const path = './docs/data.json';

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchBrassData() {
  try {
    // 1. Cours du Cuivre (via ETF CPER)
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=CPER&interval=1day&outputsize=1&apikey=${API_KEY}`;
    const copperRes = await fetch(copperUrl);
    const copperData = await copperRes.json();
    if (!copperData.values || !copperData.values[0]) throw new Error("Erreur API CPER");
    const cperUsd = parseFloat(copperData.values[0].close);

    // 2. Cours du Zinc (via symbole ZINC/USD ou estimation corrélée CPER)
    let zincUsdKg = 2.80; // Valeur par défaut spot zinc/kg
    try {
      const zincUrl = `https://api.twelvedata.com/time_series?symbol=ZINC&interval=1day&outputsize=1&apikey=${API_KEY}`;
      const zincRes = await fetch(zincUrl);
      const zincData = await zincRes.json();
      if (zincData.values && zincData.values[0]) {
        zincUsdKg = parseFloat(zincData.values[0].close);
      }
    } catch (e) {
      console.warn("Utilisation valeur indicative pour le Zinc");
    }

    // 3. Taux EUR/USD
    let eurUsdRate = 1.08;
    try {
      const eurUsdUrl = `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;
      const eurUsdRes = await fetch(eurUsdUrl);
      const eurUsdData = await eurUsdRes.json();
      if (eurUsdData.price) eurUsdRate = parseFloat(eurUsdData.price);
    } catch (e) {
      console.warn("Taux EUR/USD par défaut (1.08)");
    }

    // Calculations (€/kg)
    const copperEurKg = (cperUsd * 0.38) / eurUsdRate;
    const zincEurKg = zincUsdKg / eurUsdRate;

    // Formule CW614N : 58.5% Cu + 39% Zn + 1.50€/kg transformation/profilage
    const brassCw614EurKg = (copperEurKg * 0.585) + (zincEurKg * 0.39) + 1.50;

    const todayStr = new Date().toISOString().split('T')[0];

    // 4. Lecture de l'historique existant dans docs/data.json
    let history = [];
    if (fs.existsSync(path)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (Array.isArray(fileContent.history)) {
          history = fileContent.history;
        }
      } catch (e) {
        console.warn("Impossible de lire l'historique précédent, réinitialisation.");
      }
    }

    // Mise à jour de la journée (ou remplacement si déjà exécuté aujourd'hui)
    const existingIndex = history.findIndex(item => item.date === todayStr);
    const newEntry = {
      date: todayStr,
      brass: parseFloat(brassCw614EurKg.toFixed(2)),
      copper: parseFloat(copperEurKg.toFixed(2)),
      zinc: parseFloat(zincEurKg.toFixed(2))
    };

    if (existingIndex >= 0) {
      history[existingIndex] = newEntry;
    } else {
      history.push(newEntry);
    }

    // Conserver uniquement les 30 derniers jours
    if (history.length > 30) {
      history = history.slice(-30);
    }

    const output = {
      last_updated: new Date().toISOString(),
      current: {
        brass_cw614_eur_kg: brassCw614EurKg.toFixed(2),
        copper_eur_kg: copperEurKg.toFixed(2),
        zinc_eur_kg: zincEurKg.toFixed(2),
        eur_usd_rate: eurUsdRate.toFixed(4)
      },
      history: history
    };

    if (!fs.existsSync('./docs')) {
      fs.mkdirSync('./docs');
    }

    fs.writeFileSync(path, JSON.stringify(output, null, 2));
    console.log('Succès ! Génération docs/data.json :', output.current);

  } catch (error) {
    console.error('Échec de la mise à jour :', error.message);
    process.exit(1);
  }
}

fetchBrassData();
