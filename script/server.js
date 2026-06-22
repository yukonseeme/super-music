const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise'); 
const { OAuth2Client } = require('google-auth-library'); 
const https = require('https');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

//yt dlp and yt search
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const ytext = require('youtube-ext');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '..', 'audio', 'radioDb', 'stations.db');

// legacy streaming stations
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to the SQLite database.');
});

 // new mysql connection
const mysqlDb = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD, 
    database: 'super_music_db',
    port: process.env.DB_PORT || 3306
});

// google auth
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: "Missing identity token verification payload." });
    }

    try {
        // Validate integrity token directly with Google servers
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, 
        });
        
        const payload = ticket.getPayload();
        const googleId = payload['sub']; // Unique tracking ID
        const email = payload['email'];
        const name = payload['name'];

        // Query active MySQL database instance to check for existing record match
        const [rows] = await mysqlDb.execute(
            'SELECT user_id, name, email FROM users WHERE google_id = ?', 
            [googleId]
        );

        // Match found Log them in seamlessly
        if (rows.length > 0) {
            return res.status(200).json({
                message: "Authentication successful",
                user: rows[0]
            });
        }
        const [result] = await mysqlDb.execute(
            'INSERT INTO users (google_id, name, email) VALUES (?, ?, ?)',
            [googleId, name, email]
        );

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                user_id: result.insertId,
                name: name,
                email: email
            }
        });

    } catch (error) {
        console.error("Google auth validation error:", error);
        return res.status(401).json({ error: "Invalid Google token authentication failed." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await mysqlDb.execute('SELECT user_id, name, email FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or matching user configuration record." });
        }
        res.json({ user: rows[0] });
    } catch (err) {
        res.status(500).json({ error: "MySQL internal platform query trace failure." });
    }
});


app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID
    });
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

//
app.get('/api/search-track', async (req, res) => {
    const songQuery = req.query.search;
    if (!songQuery) return res.status(400).json({ error: 'Search query is required' });

    try {
        const searchResults = await yts(songQuery);
        const videos = searchResults.videos || [];

        if (videos.length === 0) return res.json([]);

        const trackList = videos.slice(0, 10).map((video, index) => ({
            index: index + 1,
            id: video.videoId, 
            name: video.title,
            artist: video.author?.name || 'Unknown Artist',
            img_link: video.thumbnail || video.image || './assets/album_1.jpg',
            duration: video.timestamp || '3:30'
        }));

        res.json(trackList);
    } catch (err) {
        console.error('YT-Search Engine Error:', err.message);
        res.json([]); 
    }
});

// extract direct audio stream URLs on demand
app.get('/api/get-stream-url', async (req, res) => {
    const videoId = req.query.id; 
    if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

    try {
        // Fetch format streams directly via alternative scraping paths
        const streamInfo = await ytext.getStreamInfo(`https://www.youtube.com/watch?v=${videoId}`);
        
        if (!streamInfo || !streamInfo.url) {
            return res.status(404).json({ error: 'Audio stream link unavailable' });
        }
        
        res.json({ stream_url: streamInfo.url });
    } catch (err) {
        console.error('Extraction Error:', err.message);
        res.status(500).json({ error: 'Failed to extract cloud stream link' });
    }
});

app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radio server active on port ${PORT}`);
});

module.exports = app;