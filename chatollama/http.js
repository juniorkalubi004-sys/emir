const http = require('http');
require('dotenv').config();

const PORT = 3000;

const server = http.createServer(async (req, res) => {

  // 🔹 Gérer favicon automatiquement
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 🔹 Endpoint POST /ask
  if (req.method === 'POST' && req.url === '/ask') {
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body);

        // Headers streaming
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        });

        const response = await fetch('https://ollama.com/api/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-oss:120b-cloud',
            prompt: prompt,
            stream: true
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let ended = false; // pour éviter boucle infinie

        while (!ended) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            try {
              const json = JSON.parse(line);

              if (json.response) res.write(json.response);

              if (json.done) {
                res.end();
                ended = true;
                break;
              }
            } catch (err) {
              console.error('Erreur parsing JSON stream:', err);
            }
          }
        }

        if (!ended) res.end(); // sécurité si done jamais reçu

      } catch (err) {
        console.error('Erreur serveur:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Erreur de communication avec Ollama Cloud');
        }
      }
    });

  // 🔹 Page HTML simple
  } else if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h2>Chatbot Ollama Cloud</h2>
          <input id="prompt" placeholder="Écris quelque chose..." />
          <button onclick="sendPrompt()">Envoyer</button>
          <pre id="chat"></pre>

          <script>
            async function sendPrompt() {
              const prompt = document.getElementById('prompt').value;
              const chat = document.getElementById('chat');
              chat.textContent = '';

              const response = await fetch('/ask', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ prompt })
              });

              const reader = response.body.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                chat.textContent += decoder.decode(value);
              }
            }
          </script>
        </body>
      </html>
    `);

  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Serveur HTTP streaming robuste démarré → http://localhost:${PORT}`);
});
