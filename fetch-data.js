const fs = require('fs');

const API_KEY = process.env.TWELVEDATA_API_KEY;

// Exemple : Récupération du cours du Cuivre (HG=F)
async function fetchBrassData() {
  try {
    const response = await fetch(`https://api.twelvedata.com/time_series?symbol=HG=F&interval=1day&outputsize=1&apikey=${API_KEY}`);
    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.message);
    }

    const latestVal = data.values[0];
    
    // Structure de la donnée sauvegardée
    const result = {
      last_updated: new Date().toISOString(),
      copper_price_usd: parseFloat(latestVal.close),
      // Tu pourras ajouter d'autres calculs ici plus tard
    };

    fs.writeFileSync('./public/data.json', JSON.stringify(result, null, 2));
    console.log('Données mises à jour avec succès : ', result);
  } catch (error) {
    console.error('Erreur lors de la récupération des données :', error);
    process.exit(1);
  }
}

fetchBrassData();
