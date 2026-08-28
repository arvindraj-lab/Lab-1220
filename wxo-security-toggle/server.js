#!/usr/bin/env node

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * watsonx Orchestrate (WXO) Security Toggle Backend Server
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lightweight, zero-dependency HTTP server that:
 *   1. Serves the interactive Web UI (index.html)
 *   2. Provides a CORS proxy (/api/proxy) for browser API calls to IBM/AWS
 *   3. Exposes auto-detected configuration (/api/config) to pre-fill the Web UI
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Environment Auto-Discovery ────────────────────────────────────────────────
function loadEnvFiles() {
    const candidatePaths = [
        path.join(process.cwd(), '.env'),
        path.join(__dirname, '.env'),
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', 'embed_chat_webapp', '.env'),
        path.join(__dirname, '..', 'embed_chat_webapp', '.env.local'),
    ];

    for (const envPath of candidatePaths) {
        if (fs.existsSync(envPath)) {
            try {
                const content = fs.readFileSync(envPath, 'utf8');
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
                    const [k, ...vParts] = trimmed.split('=');
                    const key = k.trim();
                    let val = vParts.join('=').trim().replace(/^["']|["']$/g, '');
                    if (key && !(key in process.env)) {
                        process.env[key] = val;
                    }
                }
            } catch {
                // Ignore unreadable env files
            }
        }
    }
}
loadEnvFiles();

// ── Auto-derive Instance URL from webapp .env ──────────────────────────────────
function autoDeriveInstanceUrl() {
    if (process.env.WXO_INSTANCE_URL) return process.env.WXO_INSTANCE_URL;

    const hostUrl = process.env.NEXT_PUBLIC_ORCHESTRATE_HOSTURL || '';
    const crn = process.env.NEXT_PUBLIC_ORCHESTRATE_CRN || '';

    let instanceId = '';
    if (crn) {
        const parts = crn.split(':');
        for (const p of parts) {
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)) {
                instanceId = p;
                break;
            }
        }
    }

    if (hostUrl && instanceId) {
        let cleanHost = hostUrl.trim().replace(/\/+$/, '');
        if (!cleanHost.includes('://api.')) {
            cleanHost = cleanHost.replace('://', '://api.');
        }
        return `${cleanHost}/instances/${instanceId}`;
    }

    return null;
}

const PORT = parseInt(process.env.PORT || '3002', 10);

// ── MIME Types ───────────────────────────────────────────────────────────────
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.pem':  'text/plain; charset=utf-8',
};

// ── Helper: CORS Headers ─────────────────────────────────────────────────────
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

// ── Helper: JSON Response ────────────────────────────────────────────────────
function sendJson(res, statusCode, data) {
    setCorsHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// ── Read Request Body ────────────────────────────────────────────────────────
function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error(`Invalid JSON body: ${err.message}`));
            }
        });
        req.on('error', reject);
    });
}

// ── HTTP Server Request Listener ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    // Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = urlObj.pathname;

    // 1. Health Check
    if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, {
            status: 'ok',
            service: 'wxo-security-toggle',
            port: PORT,
            timestamp: new Date().toISOString(),
        });
    }

    // 2. Config Endpoint (Pre-fills Web UI)
    if (pathname === '/api/config' && req.method === 'GET') {
        const detectedInstanceUrl = autoDeriveInstanceUrl();
        const apiKey = process.env.WXO_API_KEY || process.env.IBM_CLOUD_API_KEY || '';
        const keysDir = path.join(__dirname, 'keys');
        const webappKeysDir = path.join(__dirname, '..', 'embed_chat_webapp', 'wxo_security_keys');

        return sendJson(res, 200, {
            platform: process.env.WXO_PLATFORM || 'ibm',
            instanceUrl: detectedInstanceUrl || '',
            hasApiKey: Boolean(apiKey),
            apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '',
            keysPresent: fs.existsSync(path.join(keysDir, 'client_private_key.pem')),
            webappKeysPresent: fs.existsSync(path.join(webappKeysDir, 'client_private_key.pem')),
        });
    }

    // 3. CORS Proxy Endpoint
    if (pathname === '/api/proxy' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const { url, method = 'GET', headers = {}, textBody } = body;

            if (!url) {
                return sendJson(res, 400, { error: 'Missing required "url" parameter in request body.' });
            }

            const fetchOptions = {
                method: method.toUpperCase(),
                headers: headers || {},
            };
            if (textBody !== undefined && textBody !== null) {
                fetchOptions.body = textBody;
            }

            const fetchRes = await fetch(url, fetchOptions);
            const respText = await fetchRes.text();

            let respData;
            try {
                respData = JSON.parse(respText);
            } catch {
                respData = { raw: respText };
            }

            return sendJson(res, fetchRes.status, respData);

        } catch (error) {
            console.error('❌ Proxy error:', error.message);
            return sendJson(res, 500, { error: error.message });
        }
    }

    // 4. Serve Static Files (index.html, etc.)
    if (req.method === 'GET') {
        let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

        // Security check: prevent path traversal
        if (!filePath.startsWith(__dirname)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('403 Forbidden');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            return fs.createReadStream(filePath).pipe(res);
        }

        // Default fallback to index.html for SPA-style routing
        const indexHtmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return fs.createReadStream(indexHtmlPath).pipe(res);
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('405 Method Not Allowed');
});

server.listen(PORT, () => {
    console.log('\n' + '─'.repeat(60));
    console.log(`🚀 watsonx Orchestrate Security Toggle Server Running`);
    console.log('─'.repeat(60));
    console.log(`   🌐 Web UI:   http://localhost:${PORT}`);
    console.log(`   📡 Proxy:    http://localhost:${PORT}/api/proxy`);
    console.log(`   ⚙️  Config:   http://localhost:${PORT}/api/config`);
    console.log('─'.repeat(60) + '\n');
});
