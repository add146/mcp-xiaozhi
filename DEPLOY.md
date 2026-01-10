# Deployment Guide - aaPanel + Cloudflare Zero Trust

## Prerequisites
- Server dengan aaPanel terinstall
- Python 3.10+ 
- Node.js 18+
- Domain di Cloudflare
- Cloudflare Zero Trust (Access)

## Step 1: Clone Repository

```bash
cd /www/wwwroot
git clone https://github.com/add146/mcp-xiaozhi.git
cd mcp-xiaozhi
```

## Step 2: Install Dependencies

```bash
# Install Python dependencies
pip3 install fastmcp feedparser

# Install Node.js dependencies
cd admin-backend
npm install
cd ..
```

## Step 3: Setup PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start Admin Backend
cd /www/wwwroot/mcp-xiaozhi/admin-backend
pm2 start server.js --name "mcp-admin"

# Save PM2 config
pm2 save
pm2 startup
```

## Step 4: aaPanel - Setup Reverse Proxy

1. Buka aaPanel → **Website** → **Add Site**
2. Domain: `mcp.khibroh.com`
3. Setelah dibuat, klik **Setting** → **Reverse Proxy**
4. Add Proxy:
   - **Target URL**: `http://127.0.0.1:3000`
   - **Send Domain**: `$host`

## Step 5: SSL Certificate

1. Di aaPanel → Website → `mcp.khibroh.com` → Setting
2. Klik **SSL** → **Let's Encrypt**
3. Apply certificate

## Step 6: Cloudflare Zero Trust

### A. Tambah Aplikasi di Cloudflare Access

1. Login Cloudflare Dashboard → **Zero Trust**
2. Klik **Access** → **Applications**
3. **Add an application** → **Self-hosted**

### B. Configure Application

```
Application name: MCP Admin Panel
Session duration: 24 hours
Application domain: mcp.khibroh.com
```

### C. Add Policy

```
Policy name: Admin Only
Action: Allow
Include:
  - Emails: your-email@domain.com
  - (atau) Login Methods: One-time PIN
```

### D. DNS Settings

Pastikan di Cloudflare DNS:
```
Type: A
Name: mcp
Content: [IP Server Anda]
Proxy: ON (orange cloud)
```

## Step 7: Firewall

Di aaPanel → **Security** → **Firewall**:
- Pastikan port 3000 **TIDAK** dibuka ke public
- Cloudflare akan proxy melalui port 80/443

## Final Architecture

```
User → Cloudflare (SSL + Zero Trust Auth)
    ↓
Cloudflare Tunnel/Proxy → Server IP:80/443
    ↓
aaPanel Nginx Reverse Proxy → localhost:3000
    ↓
MCP Admin Backend (Node.js)
    ↓
MCP Bridge Processes (Python per-user)
```

## Testing

1. Buka `https://mcp.khibroh.com`
2. Cloudflare Zero Trust login muncul
3. Setelah auth, redirect ke MCP Admin login
4. Login: `admin / admin123` (ganti segera!)

## Monitoring

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs mcp-admin

# Restart if needed
pm2 restart mcp-admin
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Cek `pm2 status` - pastikan running |
| Connection refused | Pastikan reverse proxy ke `127.0.0.1:3000` |
| SSL error | Cloudflare → SSL mode: Full (strict) |
| Zero Trust tidak muncul | Cek DNS proxy ON (orange) |
