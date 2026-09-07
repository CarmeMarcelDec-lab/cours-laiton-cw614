const fs = require('fs');

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchBrassData() {
  try {
    // Utilisation de l'ETF Cuivre (CPER) accessible gratuitement
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=CPER&interval=1day&outputsize=1&apikey=${API_KEY}`;
    const copperResponse = await fetch(copperUrl);
    const copperData = await copperResponse.json();

    if (copperData.status === 'error' || !copperData.values || !copperData.values[0]) {
      throw new Error(`Erreur API CPER : ${copperData.message || JSON.stringify(copperData)}`);
    }

    // Prix de l'action ETF CPER en USD
    const cperPriceUsd = parseFloat(copperData.values[0].close);

    // Récupération du taux EUR/USD
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

    // Ratio d'estimation : Le cours du laiton de décolletage (CW614N) en €/kg 
    // suit une corrélation directe avec l'indice CPER.
    // Coefficient ajusté sur la valeur moyenne du barreau de laiton (~11 €/kg).
    const estimatedBrassEurPerKg = (cperPriceUsd * 0.38) / eurUsdRate + 1.50;
    const estimatedCopperEurKg = (cperPriceUsd * 0.38) / eurUsdRate;

    const result = {
      last_updated: new Date().toISOString(),
      cper_etf_usd: cperPriceUsd.toFixed(2),
      copper_eur_kg: estimatedCopperEurKg.toFixed(2),
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
