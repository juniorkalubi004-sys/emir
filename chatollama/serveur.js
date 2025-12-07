const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Charger la configuration depuis config.json
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
  const configFile = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configFile);
  console.log('✅ Configuration chargée depuis config.json');
} catch (err) {
  console.warn('⚠️  config.json non trouvé ou invalide, utilisation des valeurs par défaut');
  config = {
    port: 3000,
    ollama: {
      apiKey: 'YOUR_API_KEY',
      apiUrl: 'https://ollama.com/api/generate',
      defaultModel: 'gpt-oss:120b-cloud'
    }
  };
}

// Variables d'environnement peuvent surcharger la configuration
const PORT = process.env.PORT || config.port || 3000;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || config.ollama.apiKey;
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || config.ollama.apiUrl;
const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || config.ollama.defaultModel;

// Log de confirmation
console.log('🔧 Configuration appliquée:');
console.log('   Port:', PORT);
console.log('   API URL:', OLLAMA_API_URL);
console.log('   Modèle par défaut:', DEFAULT_MODEL);
console.log('   Clé API présente:', !!OLLAMA_API_KEY);

app.use(express.json());
app.use(express.static(__dirname)); // Pour index.html

app.post('/ask', async (req, res) => {
  // On accepte désormais un payload flexible : { prompt, model, inputs, images, ... }
  const { prompt, model, inputs, images } = req.body || {};
  console.log('📌 Prompt reçu:', prompt);

  // Headers pour envoyer les données au fur et à mesure
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    console.log('🔄 Appel API Ollama... model=', model || DEFAULT_MODEL);

    // Construire le payload en acceptant des champs multimodaux si fournis
    const payload = Object.assign(
      { stream: true },
      // permettre d'écraser le modèle depuis la requête côté client
      model ? { model } : { model: DEFAULT_MODEL },
      // prompt si présent
      prompt ? { prompt } : {},
      // inputs (pour multimodal) si fournis
      inputs ? { inputs } : {},
      // images (tableau de URLs ou base64) si fournis
      images ? { images } : {}
    );

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📊 Status réponse:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API:', errorText);
      res.write(`Erreur API: ${response.status} - ${errorText}`);
      res.end();
      return;
    }

    if (!response.body) {
      console.error('❌ Pas de body dans la réponse');
      res.write('Erreur: Pas de body dans la réponse');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let totalChunks = 0;
    let totalLines = 0;
    let totalResponse = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log(`✅ Stream terminé. Total chunks: ${totalChunks}, lignes: ${totalLines}, caractères: ${totalResponse.length}`);
        break;
      }

      totalChunks++;
      const chunk = decoder.decode(value, { stream: true });
      console.log(`📦 Chunk ${totalChunks} (${chunk.length} bytes):`, chunk.substring(0, 100));

      // Chaque ligne = un JSON séparé
      const lines = chunk.split("\n").filter(line => line.trim() !== "");
      totalLines += lines.length;

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          console.log('✓ JSON parsé:', { done: json.done, response_len: json.response?.length || 0 });

          // Tentative d'écriture aux clients : texte et, si présent, métadonnées multimodales
          if (json.response) {
            res.write(json.response);
            totalResponse += json.response;
            console.log('💬 Écrit au client:', json.response.substring(0, 50));
          }

          // Si la réponse contient des éléments image ou multimodaux, on les loggue
          if (json.images) {
            console.log('🖼️ Images dans le flux:', json.images);
            // Vous pouvez décider ici d'émettre un wrapper JSON pour le client,
            // ex: res.write(JSON.stringify({ images: json.images }));
          }

          // Si fin → terminer
          if (json.done) {
            console.log('🏁 Fin du stream détectée');
            res.end();
            return;
          }

        } catch (err) {
          console.error("❌ Erreur parsing JSON:", err.message, "Ligne:", line.substring(0, 100));
        }
      }
    }

    console.log('✅ Fin normal du stream, envoi res.end()');
    res.end();

  } catch (error) {
    console.error("❌ Erreur Ollama Cloud:", error);
    res.status(500).send("Erreur de communication avec Ollama Cloud: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Serveur streaming démarré → http://localhost:${PORT}\n`);
});
