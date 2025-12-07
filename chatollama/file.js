
import http from 'http';
import fs from 'fs';

const server = http.createServer((req, res) => {
    const filePath = './video.mp4';
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const range = req.headers.range;

    if (!range) {
        // Aucun Range → envoyer tout le fichier
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Length': fileSize
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // Exemple de Range : "bytes=1000-"
    const start = Number(range.replace(/\D/g, ''));
    const end = fileSize - 1;

    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
});

server.listen(3000, () => {
    console.log("Serveur vidéo sur http://localhost:3000");
});





