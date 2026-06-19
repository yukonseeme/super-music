const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const cors = require('cors');
const path = require('path');

//yt dlp and yt search
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const ytext = require('youtube-ext');

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radio server active on port ${PORT}`);
});

module.exports = app;