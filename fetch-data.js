const fs = require('fs');

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchBrassData() {
  try {
    // Solution A : Récupération du cuivre via le symbole Spot XCU/USD
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=XCU/USD&interval=1day&outputsize=1&apikey=${API_KEY}`;
    const copperResponse = await fetch(copperUrl);
    const copperData = await copperResponse.json();

    // Vérification de la réponse API
    if (copperData.status === 'error' || !copperData.values || !copperData.values[0]) {
      throw new Error(`Erreur API XCU/USD : ${copperData.message || JSON.stringify(copperData)}`);
    }

    // Le cours XCU/USD est généralement exprimé en USD par Once troy (1 oz troy = 0.0311034768 kg)
    const copperUsdPerOz = parseFloat(copperData.values[0].close);
    const copperUsdPerKg = copperUsdPerOz / 0.0311034768;

    // Récupération du taux EUR/USD pour la conversion
    let eurUsdRate = 1.08;
    try {
      const eurUsdUrl = `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;
      const eurUsdResponse = await fetch(eurUsdUrl);
      const eurUsdData = await eurUsdResponse.json();
      if (eurUsdData.price) {
        eurUsdRate = parseFloat(eurUsdData.price);
      }
    } catch (e) {
      console.warn("Utilisation du taux EUR/USD par défaut (1.08)");
    }

    const copperEurPerKg = copperUsdPerKg / eurUsdRate;

    // Estimation CW614N (58% Cuivre + coût transformation / composante zinc)
    const estimatedBrassEurPerKg = (copperEurPerKg * 0.58) + 1.80;

    const result = {
      last_updated: new Date().toISOString(),
      copper_usd_oz: copperUsdPerOz.toFixed(2),
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
