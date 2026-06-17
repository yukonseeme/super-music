const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { spawn } = require('child_process');
const cors = require('cors'); 
const path = require('path');

const app = express();
app.use(cors());

// robust path construction to avoid string escape bugs
const dbPath = path.join(__dirname, '..', 'audio', 'radioDb', 'stations.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to the SQLite database.');
});

app.get('/api/stations', (req, res) => {
    db.all("SELECT id, name, img_link FROM stations", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// live audio via FFmpeg proxy
app.get('/api/stream/:id', (req, res) => {
    const stationId = req.params.id;

    db.get("SELECT url FROM stations WHERE id = ?", [stationId], (err, row) => {
        if (err || !row) {
            return res.status(404).send('Station not found');
        }

        // set live audio headers for browser player
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');

        // FFmpeg to capture the live stream and pipe it to standard output as an MP3
        const ffmpeg = spawn('ffmpeg', [
            '-nostdin',                // IMPROVEMENT: Prevents FFmpeg from freezing waiting for console inputs
            '-i', row.url,             // live radio URL from DB
            '-f', 'mp3',               // force container format to MP3
            '-acodec', 'libmp3lame',   // Standard high-compatibility encoder
            '-ab', '128k',             // Output bitrate (128kbps is perfect for radio streams)
            '-ac', '2',                // Force stereo audio channels
            'pipe:1'                   // Stream stdout right to the server response
        ]);

        // Pipe the live FFmpeg buffer directly to the browser response object
        ffmpeg.stdout.pipe(res);

        // stderr logs so the process buffer doesn't fill up and freeze
        ffmpeg.stderr.on('data', (data) => {
            // console.log(`FFmpeg Log: ${data}`);
        });

        // Clean up the process if the user switches stations or closes the app
        req.on('close', () => {
            ffmpeg.kill('SIGKILL');
        });
        
        ffmpeg.on('error', (err) => {
            console.error('FFmpeg process error:', err);
        });
    });
});

app.listen(3000, () => console.log('Radio server active on http://localhost:3000'));