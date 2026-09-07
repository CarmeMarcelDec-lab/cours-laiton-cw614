const fs = require('fs');
const path = './docs/data.json';

const API_KEY = process.env.TWELVEDATA_API_KEY;

if (!API_KEY) {
  console.error("ERREUR : La variable TWELVEDATA_API_KEY est manquante dans les secrets GitHub.");
  process.exit(1);
}

async function fetchHistoricalData() {
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

    // 2. Récupération des 30 derniers jours de cotation sur le Cuivre (CPER)
    const copperUrl = `https://api.twelvedata.com/time_series?symbol=CPER&interval=1day&outputsize=30&apikey=${API_KEY}`;
    const copperRes = await fetch(copperUrl);
    const copperData = await copperRes.json();

    if (!copperData.values || !Array.isArray(copperData.values)) {
      throw new Error("Impossible de récupérer la série temporelle CPER");
    }

    // Les données de l'API arrivent du plus récent au plus ancien, on inverse pour l'ordre chronologique
    const historicalValues = copperData.values.reverse();

    // 3. Calcul rétroactif pour chaque journée de l'historique
    const history = historicalValues.map(entry => {
      const dateStr = entry.datetime;
      const cperUsd = parseFloat(entry.close);
      const copperEurKg = (cperUsd * 0.38) / eurUsdRate;

      // LAITON CW614N (Base 11,11 € + 0,65 € transfo)
      const rawBrassEurKg = (copperEurKg * 0.585) + (2.70 * 0.39);
      const brassBaseSupplier = rawBrassEurKg * 1.278;
      const brassCw614 = brassBaseSupplier + 0.65;

      // ALU 2017A
      const aluLmeEurKg = 2.35 / eurUsdRate;
      const alu2017 = (aluLmeEurKg * 1.35) + 0.90;

      // INOX 303 (1.4305)
      const inox303 = 2.10 + (copperEurKg * 0.18) + 0.95;

      // ACIER S300PB
      const steelS300pb = 0.95 + 0.60;

      return {
        date: dateStr,
        brass: parseFloat(brassCw614.toFixed(2)),
        alu2017: parseFloat(alu2017.toFixed(2)),
        inox303: parseFloat(inox303.toFixed(2)),
        s300pb: parseFloat(steelS300pb.toFixed(2))
      };
    });

    const latest = history[history.length - 1];

    const output = {
      last_updated: new Date().toISOString(),
      current: {
        brass_cw614_eur_kg: latest.brass.toFixed(2),
        alu_2017_eur_kg: latest.alu2017.toFixed(2),
        inox_303_eur_kg: latest.inox303.toFixed(2),
        steel_s300pb_eur_kg: latest.s300pb.toFixed(2),
        eur_usd_rate: eurUsdRate.toFixed(4)
      },
      history: history
    };

    if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
    fs.writeFileSync(path, JSON.stringify(output, null, 2));
    console.log(`Succès ! Historique de ${history.length} jours généré.`);

  } catch (error) {
    console.error('Erreur lors du calcul historique :', error.message);
    process.exit(1);
  }
}

fetchHistoricalData();
