#!/usr/bin/env node

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * watsonx Orchestrate (WXO) Security Toggle CLI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Enables, disables, or checks security enforcement for WXO Embedded Chat.
 *
 * Features:
 *   - Zero external dependencies: Uses 100% native Node.js built-in modules.
 *   - Direct execution: Calls IBM Cloud / AWS IAM & WXO APIs directly.
 *   - Auto-discovery: Automatically detects API keys & instance URLs from .env files.
 *   - Auto-sync: Saves keys to ./keys and ../embed_chat_webapp/wxo_security_keys.
 *   - Dual mode: Human-friendly formatted console output OR machine-readable --json.
 *
 * Usage:
 *   node cli.js status                  # Check current security status
 *   node cli.js enable                  # Enable security & generate RSA keys
 *   node cli.js disable                 # Disable security
 *
 * Agent / Programmatic Usage:
 *   node cli.js enable --json -k "<API_KEY>" -i "<INSTANCE_URL>"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
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

// ── Auto-derive Instance URL from Next.js webapp .env if present ───────────────
function autoDeriveInstanceUrl() {
    if (process.env.WXO_INSTANCE_URL) return process.env.WXO_INSTANCE_URL;

    const hostUrl = process.env.NEXT_PUBLIC_ORCHESTRATE_HOSTURL || '';
    const crn = process.env.NEXT_PUBLIC_ORCHESTRATE_CRN || '';

    // Extract instance ID from CRN
    // Format: crn:v1:bluemix:public:watsonx-orchestrate:<region>:a/<acc>:<instance_id>::
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
        // Convert https://au-syd.watson-orchestrate... to https://api.au-syd.watson-orchestrate...
        if (!cleanHost.includes('://api.')) {
            cleanHost = cleanHost.replace('://', '://api.');
        }
        return `${cleanHost}/instances/${instanceId}`;
    }

    return null;
}

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_PROXY_URL = process.env.WXO_PROXY_URL || 'http://localhost:3002/api/proxy';
const DEFAULT_OUT_DIR = process.env.WXO_OUT_DIR || path.join(__dirname, 'keys');
const WEBAPP_KEYS_DIR = path.join(__dirname, '..', 'embed_chat_webapp', 'wxo_security_keys');

const IBM_IAM_URL = 'https://iam.cloud.ibm.com/identity/token';
const AWS_IAM_ENDPOINTS = [
    'https://iam.platform.saas.ibm.com',
    'https://iam.platform.test.saas.ibm.com',
    'https://iam.platform.dev.saas.ibm.com',
];

// ── Tiny Logger ──────────────────────────────────────────────────────────────
function log(isJson, ...args) {
    if (!isJson) console.log(...args);
}

// ── Interactive Prompt Helper ────────────────────────────────────────────────
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

// ── URL Parser & Validator ───────────────────────────────────────────────────
function parseInstanceUrl(raw) {
    let url = (raw || '').trim();
    if (!url) {
        throw new Error('Instance URL cannot be empty.');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const match = url.match(/^(https?:\/\/[^/]+).*?\/instances\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        throw new Error(
            'Invalid WXO Instance URL format.\n' +
            'Expected: https://api.<region>.watson-orchestrate.cloud.ibm.com/instances/<INSTANCE_ID>\n' +
            'Example:  https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/9621f6ac-c42a-4096-9f31-47b4343699f3'
        );
    }
    return { apiUrl: match[1], instanceId: match[2], fullUrl: url };
}

// ── HTTP Request Handler (Direct vs Proxy) ───────────────────────────────────
async function directFetch(url, method = 'GET', headers = {}, body = null) {
    const opts = { method, headers };
    if (body !== null) opts.body = body;

    let res;
    try {
        res = await fetch(url, opts);
    } catch (err) {
        throw new Error(`Network error reaching ${url}: ${err.message}`);
    }

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        const msg = data?.error || data?.errorMessage || data?.message || data?.raw || `HTTP ${res.status}`;
        throw new Error(`${msg} (status ${res.status})`);
    }
    return data;
}

async function proxyFetch(proxyUrl, url, method = 'GET', headers = {}, body = null) {
    let res;
    try {
        res = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, method, headers, textBody: body }),
        });
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
            throw new Error(
                `Cannot reach proxy server at ${proxyUrl}.\n` +
                `Start it first:  cd wxo-security-toggle && node server.js`
            );
        }
        throw err;
    }

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        const msg = data?.error || data?.errorMessage || data?.raw || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

async function request(useProxy, proxyUrl, url, method = 'GET', headers = {}, body = null) {
    return useProxy
        ? proxyFetch(proxyUrl, url, method, headers, body)
        : directFetch(url, method, headers, body);
}

// ── IAM Authentication ───────────────────────────────────────────────────────
async function getIAMToken(useProxy, proxyUrl, apiKey, platform, isJson) {
    const plat = (platform || 'ibm').toLowerCase().trim();

    if (plat === 'aws') {
        for (const base of AWS_IAM_ENDPOINTS) {
            try {
                log(isJson, `  ↳ Authenticating via AWS IAM endpoint: ${base}...`);
                const data = await request(
                    useProxy, proxyUrl,
                    `${base}/siusermgr/api/1.0/apikeys/token`,
                    'POST',
                    { 'Content-Type': 'application/json' },
                    JSON.stringify({ apikey: apiKey })
                );
                if (data.token) return data.token;
            } catch {
                // Try next endpoint
            }
        }
        throw new Error('AWS IAM authentication failed on all endpoints. Please verify your API Key.');
    }

    // IBM Cloud IAM
    log(isJson, '  ↳ Authenticating with IBM Cloud IAM...');
    const data = await request(
        useProxy, proxyUrl,
        IBM_IAM_URL,
        'POST',
        { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`
    );
    if (data.access_token) return data.access_token;
    throw new Error('IBM Cloud IAM authentication failed. Please verify your API Key.');
}

// ── RSA Key Pair Generation ──────────────────────────────────────────────────
function generateRSAKeyPair(isJson) {
    log(isJson, '  ↳ Generating RSA-4096 client key pair (modulusLength: 4096)...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}

// ── Operations ───────────────────────────────────────────────────────────────

/** 1. Check Security Status */
async function opStatus({ useProxy, proxyUrl, instanceUrl, apiKey, platform, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);

    log(json, '\n🔍 [1/2] Authenticating with IAM...');
    const token = await getIAMToken(useProxy, proxyUrl, apiKey, platform, json);

    log(json, '🔍 [2/2] Fetching security configuration from WXO...');
    const config = await request(
        useProxy, proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'GET',
        { Authorization: `Bearer ${token}` }
    );

    const enabled = Boolean(config.is_security_enabled);
    if (!json) {
        console.log('\n' + '─'.repeat(60));
        if (enabled) {
            console.log('✅  SECURITY STATUS: ENABLED');
            console.log('    Your WXO instance requires RSA signed & encrypted tokens.');
        } else {
            console.log('🔴  SECURITY STATUS: DISABLED');
            console.log('    Your WXO instance does not enforce token encryption.');
        }
        console.log(`    Instance ID: ${instanceId}`);
        console.log('─'.repeat(60) + '\n');
    }

    return {
        success: true,
        action: 'status',
        platform,
        instance_id: instanceId,
        is_security_enabled: enabled,
        status: enabled ? 'enabled' : 'disabled',
    };
}

/** 2. Enable Security */
async function opEnable({ useProxy, proxyUrl, instanceUrl, apiKey, platform, outDir, syncWebapp, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);

    log(json, '\n🔒 [1/4] Authenticating with IAM...');
    const token = await getIAMToken(useProxy, proxyUrl, apiKey, platform, json);

    log(json, '🔑 [2/4] Requesting IBM Public Key from WXO...');
    const ibmResp = await request(
        useProxy, proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/generate-key-pair`,
        'POST',
        { Authorization: `Bearer ${token}` }
    );
    if (!ibmResp.public_key) {
        throw new Error('WXO did not return a public key. Check your Instance URL and permissions.');
    }
    const ibmPublicKey = ibmResp.public_key.replace(/\\n/g, '\n').trim();

    log(json, '🔐 [3/4] Generating client RSA-4096 key pair...');
    const clientKeys = generateRSAKeyPair(json);

    log(json, '🚀 [4/4] Registering keys and activating security on WXO...');
    await request(
        useProxy, proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'POST',
        { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        JSON.stringify({
            is_security_enabled: true,
            public_key: ibmPublicKey,
            client_public_key: clientKeys.publicKey,
        })
    );

    // Save keys to primary output directory
    const targetDir = path.resolve(process.cwd(), outDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const keyFiles = {
        ibm_public_key: path.join(targetDir, 'ibm_public_key.pem'),
        client_public_key: path.join(targetDir, 'client_public_key.pem'),
        client_private_key: path.join(targetDir, 'client_private_key.pem'),
    };

    fs.writeFileSync(keyFiles.ibm_public_key, ibmPublicKey, 'utf8');
    fs.writeFileSync(keyFiles.client_public_key, clientKeys.publicKey, 'utf8');
    fs.writeFileSync(keyFiles.client_private_key, clientKeys.privateKey, 'utf8');

    // Auto-sync with Next.js webapp if directory exists or sync is enabled
    const syncedPaths = [];
    if (syncWebapp !== false) {
        const webappDir = path.resolve(__dirname, '..', 'embed_chat_webapp');
        if (fs.existsSync(webappDir)) {
            const webappKeysDir = path.join(webappDir, 'wxo_security_keys');
            fs.mkdirSync(webappKeysDir, { recursive: true });

            fs.writeFileSync(path.join(webappKeysDir, 'ibm_public_key.pem'), ibmPublicKey, 'utf8');
            fs.writeFileSync(path.join(webappKeysDir, 'client_public_key.pem'), clientKeys.publicKey, 'utf8');
            fs.writeFileSync(path.join(webappKeysDir, 'client_private_key.pem'), clientKeys.privateKey, 'utf8');
            syncedPaths.push(webappKeysDir);
        }
    }

    if (!json) {
        console.log('\n' + '─'.repeat(60));
        console.log('🎉  SECURITY ENABLED SUCCESSFULLY!');
        console.log('─'.repeat(60));
        console.log(`📁  Primary Key Directory: ${targetDir}`);
        console.log(`    ├── ibm_public_key.pem     (IBM Public Key)`);
        console.log(`    ├── client_public_key.pem  (Client Public Key registered with WXO)`);
        console.log(`    └── client_private_key.pem (Client Private Key for signing JWTs)`);
        if (syncedPaths.length > 0) {
            console.log(`\n🔄  Auto-Synced to WebApp:`);
            for (const sp of syncedPaths) {
                console.log(`    └── ${sp}`);
            }
        }
        console.log('─'.repeat(60) + '\n');
    }

    return {
        success: true,
        action: 'enable',
        platform,
        instance_id: instanceId,
        is_security_enabled: true,
        status: 'enabled',
        keys: {
            output_dir: targetDir,
            ibm_public_key: keyFiles.ibm_public_key,
            client_public_key: keyFiles.client_public_key,
            client_private_key: keyFiles.client_private_key,
            synced_to_webapp: syncedPaths.length > 0 ? syncedPaths[0] : null,
        },
    };
}

/** 3. Disable Security */
async function opDisable({ useProxy, proxyUrl, instanceUrl, apiKey, platform, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);

    log(json, '\n🔓 [1/2] Authenticating with IAM...');
    const token = await getIAMToken(useProxy, proxyUrl, apiKey, platform, json);

    log(json, '🔓 [2/2] Deactivating security on WXO instance...');
    await request(
        useProxy, proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'POST',
        { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        JSON.stringify({ is_security_enabled: false, public_key: '', client_public_key: '' })
    );

    if (!json) {
        console.log('\n' + '─'.repeat(60));
        console.log('🔓  SECURITY DISABLED SUCCESSFULLY.');
        console.log(`    Instance ID: ${instanceId}`);
        console.log('─'.repeat(60) + '\n');
    }

    return {
        success: true,
        action: 'disable',
        platform,
        instance_id: instanceId,
        is_security_enabled: false,
        status: 'disabled',
    };
}

// ── Native Zero-Dependency Argument Parser ───────────────────────────────────
function parseCommandLineArgs(argv) {
    const args = argv.slice(2);
    const options = {
        action: null,
        apiKey: process.env.WXO_API_KEY || process.env.IBM_CLOUD_API_KEY || process.env.API_KEY || null,
        instanceUrl: autoDeriveInstanceUrl() || null,
        platform: process.env.WXO_PLATFORM || 'ibm',
        outDir: DEFAULT_OUT_DIR,
        syncWebapp: true,
        proxy: false,
        proxyUrl: DEFAULT_PROXY_URL,
        json: false,
        nonInteractive: false,
        help: false,
        version: false,
    };

    const positional = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '-v' || arg === '--version') {
            options.version = true;
        } else if (arg === '--json') {
            options.json = true;
        } else if (arg === '--non-interactive') {
            options.nonInteractive = true;
        } else if (arg === '--proxy') {
            options.proxy = true;
        } else if (arg === '--no-sync-webapp') {
            options.syncWebapp = false;
        } else if (arg === '--sync-webapp') {
            options.syncWebapp = true;
        } else if (arg === '-k' || arg === '--api-key') {
            options.apiKey = args[++i];
        } else if (arg === '-i' || arg === '--instance-url') {
            options.instanceUrl = args[++i];
        } else if (arg === '-p' || arg === '--platform') {
            options.platform = args[++i];
        } else if (arg === '-o' || arg === '--out-dir') {
            options.outDir = args[++i];
        } else if (arg === '--proxy-url') {
            options.proxyUrl = args[++i];
        } else if (arg === '-a' || arg === '--action') {
            options.action = args[++i];
        } else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }

    if (positional.length > 0 && !options.action) {
        options.action = positional[0];
    }

    return options;
}

// ── Print Help Banner ────────────────────────────────────────────────────────
function printHelp() {
    console.log(`
watsonx Orchestrate (WXO) Security Toggle CLI (v2.0.0)

Usage:
  node cli.js <action> [options]

Actions:
  status, check     Check current security status on WXO instance
  enable            Generate RSA-4096 keys, register with WXO & enable security
  disable           Disable security enforcement on WXO instance

Options:
  -k, --api-key <key>        IBM Cloud API Key or AWS API Key (or WXO_API_KEY env)
  -i, --instance-url <url>   WXO Service Instance URL (auto-detected from .env if present)
  -p, --platform <ibm|aws>   Platform type: 'ibm' (default) or 'aws'
  -o, --out-dir <path>       Output directory for generated RSA keys (default: ./keys)
  --json                     Output result in machine-readable JSON format
  --proxy                    Route requests through local server.js proxy on port 3002
  --no-sync-webapp           Do not auto-copy keys to ../embed_chat_webapp/wxo_security_keys
  --non-interactive          Fail immediately with error if parameters are missing
  -h, --help                 Show this help message

Examples:
  # Check security status (auto-detects instance URL from .env):
  node cli.js status -k "<YOUR_API_KEY>"

  # Enable security & auto-sync keys:
  node cli.js enable -k "<YOUR_API_KEY>"

  # Programmatic JSON execution for AI agents:
  node cli.js enable --json -k "<API_KEY>" -i "<INSTANCE_URL>"
`);
}

// ── Main Entry Point ─────────────────────────────────────────────────────────
async function main() {
    const opts = parseCommandLineArgs(process.argv);

    if (opts.version) {
        console.log('2.0.0');
        process.exit(0);
    }

    if (opts.help) {
        printHelp();
        process.exit(0);
    }

    const isJson = opts.json || process.env.WXO_JSON === 'true';
    const isNonInteractive = opts.nonInteractive || !process.stdin.isTTY || isJson;

    try {
        // Resolve Action
        let action = (opts.action || '').toLowerCase().trim();
        if (!action) {
            if (isNonInteractive) {
                action = 'status';
            } else {
                console.log('\n🔒 watsonx Orchestrate Security Toggle');
                console.log('───────────────────────────────────────');
                action = (await ask('Action [status/enable/disable] (default: status): ')) || 'status';
            }
        }

        // Resolve Platform
        let platform = (opts.platform || 'ibm').toLowerCase();
        if (platform === 'saas') platform = 'ibm';

        // Resolve API Key
        let apiKey = opts.apiKey;
        if (!apiKey) {
            if (isNonInteractive) {
                throw new Error('Missing API Key. Pass -k "<KEY>" or set WXO_API_KEY / IBM_CLOUD_API_KEY.');
            }
            const label = platform === 'aws' ? 'watsonx Orchestrate API Key' : 'IBM Cloud API Key';
            apiKey = await ask(`${label}: `);
            if (!apiKey) throw new Error('API Key is required.');
        }

        // Resolve Instance URL
        let instanceUrl = opts.instanceUrl;
        if (!instanceUrl) {
            if (isNonInteractive) {
                throw new Error(
                    'Missing Instance URL. Pass -i "<URL>" or configure NEXT_PUBLIC_ORCHESTRATE_CRN in embed_chat_webapp/.env.'
                );
            }
            instanceUrl = await ask('WXO Service Instance URL: ');
            if (!instanceUrl) throw new Error('Instance URL is required.');
        }

        const params = {
            useProxy: opts.proxy,
            proxyUrl: opts.proxyUrl,
            instanceUrl,
            apiKey,
            platform,
            outDir: opts.outDir,
            syncWebapp: opts.syncWebapp,
            json: isJson,
        };

        let result;
        switch (action) {
            case 'status':
            case 'check':
                result = await opStatus(params);
                break;
            case 'enable':
                result = await opEnable(params);
                break;
            case 'disable':
                result = await opDisable(params);
                break;
            default:
                throw new Error(`Unknown action "${action}". Valid actions: status | enable | disable`);
        }

        if (isJson) {
            console.log(JSON.stringify(result, null, 2));
        }

    } catch (err) {
        if (isJson) {
            console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\n❌ Error: ${err.message}\n`);
        }
        process.exit(1);
    }
}

main();
