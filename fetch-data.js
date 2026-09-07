const fs = require('fs');

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchBrassData() {
  try {
    // 1. Récupération du cours du Cuivre via /time_series (plus stable sur le plan gratuit)
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=COPPER&interval=1day&outputsize=1&apikey=${API_KEY}`;
    const copperResponse = await fetch(copperUrl);
    const copperData = await copperResponse.json();

    if (copperData.status === 'error' || !copperData.values || !copperData.values[0]) {
      throw new Error(`Erreur API Cuivre : ${copperData.message || JSON.stringify(copperData)}`);
    }

    const copperUsdPerLb = parseFloat(copperData.values[0].close);

    // 2. Récupération du taux de change EUR/USD
    let eurUsdRate = 1.08; // Valeur par défaut
    try {
      const eurUsdUrl = `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;
      const eurUsdResponse = await fetch(eurUsdUrl);
      const eurUsdData = await eurUsdResponse.json();
      if (eurUsdData.price) {
        eurUsdRate = parseFloat(eurUsdData.price);
      }
    } catch (e) {
      console.warn("Impossible de récupérer le taux EUR/USD exact, utilisation du taux par défaut (1.08)");
    }

    // Conversions : 1 lb = 0.453592 kg
    const copperUsdPerKg = copperUsdPerLb / 0.453592;
    const copperEurPerKg = copperUsdPerKg / eurUsdRate;

    // Estimation CW614N (58% Cuivre + composante Zinc/transformation)
    const estimatedBrassEurPerKg = (copperEurPerKg * 0.58) + 1.80;

    const result = {
      last_updated: new Date().toISOString(),
      copper_usd_lb: copperUsdPerLb.toFixed(4),
      copper_eur_kg: copperEurPerKg.toFixed(2),
      brass_cw614_eur_kg: estimatedBrassEurPerKg.toFixed(2),
      eur_usd_rate: eurUsdRate.toFixed(4)
    };

    if (!fs.existsSync('./public')) {
      fs.mkdirSync('./public');
    }

    fs.writeFileSync('./public/data.json', JSON.stringify(result, null, 2));
    console.log('Succès ! Fichier data.json généré avec succès :', result);

  } catch (error) {
    console.error('Échec de la récupération :', error.message);
    process.exit(1);
  }
}

fetchBrassData();
