const fs = require('fs');
const path = './docs/data.json';

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchMultiMetalData() {
  try {
    // 1. Taux EUR/USD
    let eurUsdRate = 1.08;
    try {
      const eurUsdRes = await fetch(`https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`);
      const eurUsdData = await eurUsdRes.json();
      if (eurUsdData.price) eurUsdRate = parseFloat(eurUsdData.price);
    } catch (e) {
      console.warn("EUR/USD par défaut : 1.08");
    }

    // 2. Cuivre (CPER ETF)
    const copperRes = await fetch(`https://api.twelvedata.com/time_series?symbol=CPER&interval=1day&outputsize=1&apikey=${API_KEY}`);
    const copperData = await copperRes.json();
    const cperUsd = parseFloat(copperData.values[0].close);
    const copperEurKg = (cperUsd * 0.38) / eurUsdRate; // ~8,20 €/kg

    // 3. Calculs des barres métaux (€/kg)
    
    // LAITON CW614N (Base fournisseur 11,11€ + 0,65€ transfo = 11,76€)
    const rawBrassEurKg = (copperEurKg * 0.585) + (2.70 * 0.39);
    const brassBaseSupplier = rawBrassEurKg * 1.82; // ~11,11 €/kg
    const brassCw614 = brassBaseSupplier + 0.65;    // ~11,76 €/kg

    // ALUMINIUM 2011 / 2024
    const aluLmeEurKg = 2.35 / eurUsdRate;
    const alu2011 = (aluLmeEurKg * 1.40) + 0.85; // ~3,90 €/kg

    // INOX 303 (1.4305)
    const inox303 = 2.10 + (copperEurKg * 0.18) + 0.95; // ~4,50 €/kg

    // ACIER DE DÉCOLLETAGE 11SMnPb30 (S250PB)
    const steel11smnpb30 = 0.95 + 0.60; // ~1,55 €/kg

    const todayStr = new Date().toISOString().split('T')[0];

    // 4. Chargement et réinitialisation propre de l'historique
    const newEntry = {
      date: todayStr,
      brass: parseFloat(brassCw614.toFixed(2)),
      alu: parseFloat(alu2011.toFixed(2)),
      inox: parseFloat(inox303.toFixed(2)),
      steel: parseFloat(steel11smnpb30.toFixed(2))
    };

    let history = [];
    if (fs.existsSync(path)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (Array.isArray(fileContent.history)) {
          history = fileContent.history;
        }
      } catch (e) {}
    }

    const existingIndex = history.findIndex(item => item.date === todayStr);
    if (existingIndex >= 0) {
      history[existingIndex] = newEntry;
    } else {
      history.push(newEntry);
    }

    if (history.length > 30) history = history.slice(-30);

    const output = {
      last_updated: new Date().toISOString(),
      current: {
        brass_cw614_eur_kg: brassCw614.toFixed(2),
        alu_2011_eur_kg: alu2011.toFixed(2),
        inox_303_eur_kg: inox303.toFixed(2),
        steel_11smnpb30_eur_kg: steel11smnpb30.toFixed(2),
        eur_usd_rate: eurUsdRate.toFixed(4)
      },
      history: history
    };

    if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
    fs.writeFileSync(path, JSON.stringify(output, null, 2));
    console.log('Données multi-matières générées avec succès :', output.current);

  } catch (error) {
    console.error('Erreur lors du calcul :', error.message);
    process.exit(1);
  }
}

fetchMultiMetalData();
