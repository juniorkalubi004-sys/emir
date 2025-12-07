//🌍 4. Streamer un fichier avec Express (encore plus simple)


import express from 'express';
import fs from 'fs';

const app = express();

app.get('/download', (req, res) => {
    const stream = fs.createReadStream('bigfile.zip');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=bigfile.zip');
    stream.pipe(res);
});

app.listen(3000);
