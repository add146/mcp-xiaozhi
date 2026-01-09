const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper functions
function readConfig() {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { braveApiKey: '', mcpEndpoint: '', feeds: [] };
    }
}

function writeConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// API Routes
app.get('/api/config', (req, res) => {
    const config = readConfig();
    res.json({
        braveApiKey: config.braveApiKey || '',
        mcpEndpoint: config.mcpEndpoint || ''
    });
});

app.post('/api/config', (req, res) => {
    const config = readConfig();
    const { braveApiKey, mcpEndpoint } = req.body;

    if (braveApiKey !== undefined) config.braveApiKey = braveApiKey;
    if (mcpEndpoint !== undefined) config.mcpEndpoint = mcpEndpoint;

    writeConfig(config);
    res.json({ success: true, message: 'Configuration saved!' });
});

app.get('/api/feeds', (req, res) => {
    const config = readConfig();
    res.json(config.feeds || []);
});

app.post('/api/feeds', (req, res) => {
    const config = readConfig();
    const { title, url, category } = req.body;

    if (!title || !url) {
        return res.status(400).json({ error: 'Title and URL are required' });
    }

    const newFeed = {
        id: Date.now().toString(),
        title,
        url,
        category: category || 'Uncategorized'
    };

    config.feeds = config.feeds || [];
    config.feeds.push(newFeed);
    writeConfig(config);

    res.json({ success: true, feed: newFeed });
});

app.delete('/api/feeds/:id', (req, res) => {
    const config = readConfig();
    const { id } = req.params;

    config.feeds = (config.feeds || []).filter(f => f.id !== id);
    writeConfig(config);

    res.json({ success: true, message: 'Feed deleted!' });
});

app.put('/api/feeds/:id', (req, res) => {
    const config = readConfig();
    const { id } = req.params;
    const { title, url, category } = req.body;

    const feedIndex = config.feeds.findIndex(f => f.id === id);
    if (feedIndex === -1) {
        return res.status(404).json({ error: 'Feed not found' });
    }

    config.feeds[feedIndex] = { ...config.feeds[feedIndex], title, url, category };
    writeConfig(config);

    res.json({ success: true, feed: config.feeds[feedIndex] });
});

// Export OPML
app.get('/api/export/opml', (req, res) => {
    const config = readConfig();
    const feeds = config.feeds || [];

    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>MCP RSS Feeds</title>
  </head>
  <body>
`;

    const categories = [...new Set(feeds.map(f => f.category))];
    categories.forEach(cat => {
        opml += `    <outline text="${cat}" title="${cat}">\n`;
        feeds.filter(f => f.category === cat).forEach(feed => {
            opml += `      <outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.url}" />\n`;
        });
        opml += `    </outline>\n`;
    });

    opml += `  </body>
</opml>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=feeds.opml');
    res.send(opml);
});

app.listen(PORT, () => {
    console.log(`MCP Admin Backend running at http://localhost:${PORT}`);
});
