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
    
    // LAITON CW614N :
    // rawBrassEurKg = ~8,69 €/kg. Multiplié par 1.278 = 11,11 €/kg (Base laiton fournisseur).
    // On ajoute ensuite 0.65 €/kg (Base transformation).
    const rawBrassEurKg = (copperEurKg * 0.585) + (2.70 * 0.39);
    const brassBaseSupplier = rawBrassEurKg * 1.278; // Calé exactement sur 11,11 €/kg
    const brassCw614 = brassBaseSupplier + 0.65;    // Total = 11,76 €/kg

    // ALU 2017A (Barres étirées décolletage)
    const aluLmeEurKg = 2.35 / eurUsdRate;
    const alu2017 = (aluLmeEurKg * 1.35) + 0.90; // ~3,63 €/kg

    // INOX 303 (1.4305)
    const inox303 = 2.10 + (copperEurKg * 0.18) + 0.95; // ~4,50 €/kg

    // ACIER S300PB (1.0718 / 11SMnPb30)
    const steelS300pb = 0.95 + 0.60; // ~1,55 €/kg

    const todayStr = new Date().toISOString().split('T')[0];

    // 4. Historique
    const newEntry = {
      date: todayStr,
      brass: parseFloat(brassCw614.toFixed(2)),
      alu2017: parseFloat(alu2017.toFixed(2)),
      inox303: parseFloat(inox303.toFixed(2)),
      s300pb: parseFloat(steelS300pb.toFixed(2))
    };

    let history = [];
    if (fs.existsSync(path)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (Array.isArray(fileContent.history)) history = fileContent.history;
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
        alu_2017_eur_kg: alu2017.toFixed(2),
        inox_303_eur_kg: inox303.toFixed(2),
        steel_s300pb_eur_kg: steelS300pb.toFixed(2),
        eur_usd_rate: eurUsdRate.toFixed(4)
      },
      history: history
    };

    if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
    fs.writeFileSync(path, JSON.stringify(output, null, 2));
    console.log('Mise à jour réussie :', output.current);

  } catch (error) {
    console.error('Erreur lors du calcul :', error.message);
    process.exit(1);
  }
}

fetchMultiMetalData();
