const fs = require('fs');
const path = './docs/data.json';

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchBrassData() {
  try {
    // 1. Cours du Cuivre via ETF CPER (USD)
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=CPER&interval=1day&outputsize=1&apikey=${API_KEY}`;
    const copperRes = await fetch(copperUrl);
    const copperData = await copperRes.json();
    if (!copperData.values || !copperData.values[0]) throw new Error("Erreur API CPER");
    const cperUsd = parseFloat(copperData.values[0].close);

    // 2. Taux EUR/USD
    let eurUsdRate = 1.08;
    try {
      const eurUsdUrl = `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;
      const eurUsdRes = await fetch(eurUsdUrl);
      const eurUsdData = await eurUsdRes.json();
      if (eurUsdData.price) eurUsdRate = parseFloat(eurUsdData.price);
    } catch (e) {
      console.warn("Taux EUR/USD par défaut (1.08)");
    }

    // 3. Calculs physiques directs (€/kg)
    // CPER tourne autour de 25-28 $. On calibre le Cuivre spot brut à ~8,20 €/kg
    const copperEurKg = (cperUsd * 0.31) / eurUsdRate; 
    const zincEurKg = 2.70 / eurUsdRate; // ~2.50 €/kg

    // Formule Laiton CW614N (Barres décolletage) : 
    // 58.5% Cuivre + 39% Zinc + 0.90 €/kg (étirage / filage)
    const rawBrassEurKg = (copperEurKg * 0.585) + (zincEurKg * 0.39);
    const brassCw614EurKg = rawBrassEurKg + 0.90;

    const todayStr = new Date().toISOString().split('T')[0];

    // Réinitialisation forcée de l'historique propre
    const newEntry = {
      date: todayStr,
      brass: parseFloat(brassCw614EurKg.toFixed(2)),
      copper: parseFloat(copperEurKg.toFixed(2)),
      zinc: parseFloat(zincEurKg.toFixed(2))
    };

    const output = {
      last_updated: new Date().toISOString(),
      current: {
        brass_cw614_eur_kg: brassCw614EurKg.toFixed(2),
        copper_eur_kg: copperEurKg.toFixed(2),
        zinc_eur_kg: zincEurKg.toFixed(2),
        eur_usd_rate: eurUsdRate.toFixed(4)
      },
      history: [newEntry] // Remise à zéro propre avec le cours exact du jour
    };

    if (!fs.existsSync('./docs')) {
      fs.mkdirSync('./docs');
    }

    fs.writeFileSync(path, JSON.stringify(output, null, 2));
    console.log('Réinitialisation réussie ! Nouveaux cours :', output.current);

  } catch (error) {
    console.error('Échec de la mise à jour :', error.message);
    process.exit(1);
  }
}

fetchBrassData();
