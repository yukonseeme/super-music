const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '..')));

const dbPath = path.join(__dirname, '..', 'audio', 'radioDb', 'stations.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to the SQLite database.');
});

app.get('/api/stations', (req, res) => {
    db.all("SELECT id, name, url, img_link FROM stations", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/api/stream/:id', (req, res) => {
    const stationId = req.params.id;

    db.get("SELECT url FROM stations WHERE id = ?", [stationId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Station not found' });
        }

        const streamUrl = row.url;
        const url = new URL(streamUrl);
        const transport = url.protocol === 'https:' ? https : http;

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const proxyReq = transport.get(streamUrl, (proxyRes) => {
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.status(502).send('Stream unavailable');
        });

        req.on('close', () => {
            proxyReq.destroy();
        });
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radio server active on port ${PORT}`);
});

module.exports = app;