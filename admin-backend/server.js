const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'mcp-admin-secret-key-change-in-production';
const ADMIN_PATH = path.join(__dirname, 'admin.json');
const USERS_PATH = path.join(__dirname, 'users.json');
const PYTHON_PATH = 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
const BRIDGE_PATH = path.join(__dirname, '..');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ Helper Functions ============

function readAdmin() {
    try {
        return JSON.parse(fs.readFileSync(ADMIN_PATH, 'utf8'));
    } catch {
        // Default admin: admin/admin123
        const defaultAdmin = {
            username: 'admin',
            passwordHash: bcrypt.hashSync('admin123', 10)
        };
        fs.writeFileSync(ADMIN_PATH, JSON.stringify(defaultAdmin, null, 2));
        return defaultAdmin;
    }
}

function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    } catch {
        const defaultUsers = { users: [] };
        fs.writeFileSync(USERS_PATH, JSON.stringify(defaultUsers, null, 2));
        return defaultUsers;
    }
}

function writeUsers(data) {
    fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
}

// ============ Auth Middleware ============

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ============ Bridge Process Management ============

const bridgeProcesses = {}; // userId -> { process, pid }

function generateUserConfig(user) {
    const configPath = path.join(BRIDGE_PATH, `config_${user.id}.json`);
    const mcpServers = {};

    // Brave Search (if enabled and has API key)
    if (user.braveEnabled && user.braveApiKey) {
        mcpServers['brave-search'] = {
            url: 'http://localhost:8080/sse',
            transport: 'sse'
        };
    }

    // Weather (if enabled)
    if (user.weatherEnabled) {
        mcpServers['weather'] = {
            command: PYTHON_PATH,
            args: ['weather-server.py'],
            transport: 'stdio'
        };
    }

    // RSS (always enabled, per-user feeds)
    mcpServers['rss-news'] = {
        command: PYTHON_PATH,
        args: ['rss-server.py', '--user', user.id],
        transport: 'stdio'
    };

    fs.writeFileSync(configPath, JSON.stringify({ mcpServers }, null, 2));
    return configPath;
}

function killUserBridge(userId) {
    return new Promise((resolve) => {
        if (bridgeProcesses[userId]) {
            try {
                bridgeProcesses[userId].process.kill('SIGKILL');
            } catch { }
            delete bridgeProcesses[userId];
        }

        // Also kill by command line pattern
        exec(`wmic process where "commandline like '%config_${userId}%'" call terminate`, () => {
            resolve();
        });
    });
}

async function startUserBridge(user) {
    await killUserBridge(user.id);

    if (!user.mcpEndpoint) {
        console.log(`[${user.name}] No MCP endpoint, skipping`);
        return false;
    }

    const configPath = generateUserConfig(user);

    console.log(`[${user.name}] Starting bridge...`);

    const proc = spawn(PYTHON_PATH, ['mcp-pipe.py', 'mcp-bridge.py'], {
        cwd: BRIDGE_PATH,
        env: {
            ...process.env,
            MCP_ENDPOINT: user.mcpEndpoint,
            CONFIG_PATH: configPath,
            BRAVE_API_KEY: user.braveApiKey || ''
        },
        detached: false,
        stdio: 'inherit'
    });

    bridgeProcesses[user.id] = { process: proc, pid: proc.pid };

    proc.on('exit', (code) => {
        console.log(`[${user.name}] Bridge exited with code ${code}`);
        delete bridgeProcesses[user.id];

        // Update user status
        const data = readUsers();
        const idx = data.users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            data.users[idx].status = 'stopped';
            data.users[idx].pid = null;
            writeUsers(data);
        }
    });

    // Update user status
    const data = readUsers();
    const idx = data.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
        data.users[idx].status = 'running';
        data.users[idx].pid = proc.pid;
        writeUsers(data);
    }

    return true;
}

// ============ Auth Routes ============

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const admin = readAdmin();

    if (username !== admin.username) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, admin.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
});

app.post('/api/change-password', authMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = readAdmin();

    if (!bcrypt.compareSync(currentPassword, admin.passwordHash)) {
        return res.status(401).json({ error: 'Current password incorrect' });
    }

    admin.passwordHash = bcrypt.hashSync(newPassword, 10);
    fs.writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2));

    res.json({ success: true, message: 'Password changed' });
});

app.get('/api/profile', authMiddleware, (req, res) => {
    const admin = readAdmin();
    res.json({ username: admin.username });
});

app.post('/api/change-username', authMiddleware, (req, res) => {
    const { newUsername, password } = req.body;
    const admin = readAdmin();

    if (!bcrypt.compareSync(password, admin.passwordHash)) {
        return res.status(401).json({ error: 'Password incorrect' });
    }

    admin.username = newUsername;
    fs.writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2));

    // Generate new token with new username
    const token = jwt.sign({ username: newUsername }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, message: 'Username changed', token });
});

// ============ User Management Routes ============

app.get('/api/users', authMiddleware, (req, res) => {
    const data = readUsers();
    // Return users without sensitive data
    const users = data.users.map(u => ({
        ...u,
        braveApiKey: u.braveApiKey ? '***' : ''
    }));
    res.json(users);
});

app.post('/api/users', authMiddleware, (req, res) => {
    const data = readUsers();
    const { name, mcpEndpoint, braveEnabled, braveApiKey, weatherEnabled, feeds } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const newUser = {
        id: `user_${Date.now()}`,
        name,
        mcpEndpoint: mcpEndpoint || '',
        braveEnabled: braveEnabled || false,
        braveApiKey: braveApiKey || '',
        weatherEnabled: weatherEnabled || false,
        feeds: feeds || [],
        status: 'stopped',
        pid: null,
        createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    writeUsers(data);

    res.json({ success: true, user: newUser });
});

app.get('/api/users/:id', authMiddleware, (req, res) => {
    const data = readUsers();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
    const data = readUsers();
    const idx = data.users.findIndex(u => u.id === req.params.id);

    if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { name, mcpEndpoint, braveEnabled, braveApiKey, weatherEnabled, feeds } = req.body;

    if (name !== undefined) data.users[idx].name = name;
    if (mcpEndpoint !== undefined) data.users[idx].mcpEndpoint = mcpEndpoint;
    if (braveEnabled !== undefined) data.users[idx].braveEnabled = braveEnabled;
    if (braveApiKey !== undefined) data.users[idx].braveApiKey = braveApiKey;
    if (weatherEnabled !== undefined) data.users[idx].weatherEnabled = weatherEnabled;
    if (feeds !== undefined) data.users[idx].feeds = feeds;

    writeUsers(data);

    // Restart bridge if running
    if (data.users[idx].status === 'running') {
        await startUserBridge(data.users[idx]);
    }

    res.json({ success: true, user: data.users[idx] });
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
    const data = readUsers();
    const idx = data.users.findIndex(u => u.id === req.params.id);

    if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Stop bridge first
    await killUserBridge(req.params.id);

    // Remove config file
    const configPath = path.join(BRIDGE_PATH, `config_${req.params.id}.json`);
    try { fs.unlinkSync(configPath); } catch { }

    data.users.splice(idx, 1);
    writeUsers(data);

    res.json({ success: true, message: 'User deleted' });
});

// ============ Bridge Control Routes ============

app.post('/api/users/:id/start', authMiddleware, async (req, res) => {
    const data = readUsers();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!user.mcpEndpoint) {
        return res.status(400).json({ error: 'MCP Endpoint required' });
    }

    await startUserBridge(user);
    res.json({ success: true, message: `Bridge started for ${user.name}` });
});

app.post('/api/users/:id/stop', authMiddleware, async (req, res) => {
    const data = readUsers();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    await killUserBridge(user.id);

    // Update status
    const idx = data.users.findIndex(u => u.id === req.params.id);
    data.users[idx].status = 'stopped';
    data.users[idx].pid = null;
    writeUsers(data);

    res.json({ success: true, message: `Bridge stopped for ${user.name}` });
});

// ============ User Feed Routes ============

app.get('/api/users/:id/feeds', authMiddleware, (req, res) => {
    const data = readUsers();
    const user = data.users.find(u => u.id === req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.feeds || []);
});

app.post('/api/users/:id/feeds', authMiddleware, (req, res) => {
    const data = readUsers();
    const idx = data.users.findIndex(u => u.id === req.params.id);

    if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { title, url, category } = req.body;
    if (!title || !url) {
        return res.status(400).json({ error: 'Title and URL required' });
    }

    const newFeed = {
        id: Date.now().toString(),
        title,
        url,
        category: category || 'Uncategorized'
    };

    data.users[idx].feeds = data.users[idx].feeds || [];
    data.users[idx].feeds.push(newFeed);
    writeUsers(data);

    res.json({ success: true, feed: newFeed });
});

app.delete('/api/users/:id/feeds/:feedId', authMiddleware, (req, res) => {
    const data = readUsers();
    const idx = data.users.findIndex(u => u.id === req.params.id);

    if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    data.users[idx].feeds = (data.users[idx].feeds || []).filter(f => f.id !== req.params.feedId);
    writeUsers(data);

    res.json({ success: true, message: 'Feed deleted' });
});

// ============ Start Server ============

app.listen(PORT, () => {
    console.log(`MCP Admin Backend running at http://localhost:${PORT}`);
    console.log('Default admin login: admin / admin123');
});
