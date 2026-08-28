#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { Command } from 'commander';

const DEFAULT_PROXY_URL = process.env.WXO_PROXY_URL || 'http://localhost:3002/api/proxy';

// ── Helper: Logging (Suppressed when --json is passed) ──
function log(isJson, ...args) {
    if (!isJson) {
        console.log(...args);
    }
}

// ── Helper: Readline for Interactive Prompts ──
function promptQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

// ── Helper: URL Parsing ──
function parseInstanceUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    const match = url.match(/^(https?:\/\/[^\/]+).*?\/instances\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        throw new Error("Invalid WXO Instance URL format.\nExample: https://api.us-south.orchestrate.ai.ibm.com/instances/YOUR_INSTANCE_ID");
    }
    return { apiUrl: match[1], instanceId: match[2] };
}

// ── Helper: HTTP Proxy Request ──
async function requestProxy(proxyUrl, targetUrl, method = 'GET', headers = {}, body = null) {
    let res;
    try {
        res = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, method, headers, textBody: body })
        });
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
            throw new Error(`Unable to connect to proxy server at ${proxyUrl}.\nEnsure server.js is running (e.g. 'npm start').`);
        }
        throw err;
    }

    if (!res.ok) {
        let errText = `Server returned status ${res.status}`;
        try {
            const errJson = await res.json();
            errText = errJson.error || errJson.raw || errText;
        } catch (e) {}
        throw new Error(errText);
    }
    return await res.json();
}

// ── Helper: IAM Token Authentication ──
async function getIAMToken(proxyUrl, apiKey, platform, isJson = false) {
    const plat = (platform || '').toLowerCase().trim();
    if (plat === 'aws') {
        const endpoints = [
            { url: 'https://iam.platform.saas.ibm.com', name: 'Production' },
            { url: 'https://iam.platform.test.saas.ibm.com', name: 'Test' },
            { url: 'https://iam.platform.dev.saas.ibm.com', name: 'Development' }
        ];
        for (const env of endpoints) {
            try {
                log(isJson, `ℹ️  Authenticating against AWS ${env.name} IAM...`);
                const data = await requestProxy(
                    proxyUrl,
                    `${env.url}/siusermgr/api/1.0/apikeys/token`,
                    'POST',
                    { 'Content-Type': 'application/json' },
                    JSON.stringify({ apikey: apiKey })
                );
                if (data.token) return data.token;
            } catch (e) {
                // Try next endpoint
            }
        }
        throw new Error("AWS IAM Authentication failed across all environments. Please check your API Key.");
    } else if (plat === 'ibm' || plat === 'saas') {
        log(isJson, "ℹ️  Authenticating against IBM Cloud IAM...");
        const data = await requestProxy(
            proxyUrl,
            'https://iam.cloud.ibm.com/identity/token',
            'POST',
            { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`
        );
        if (data.access_token) return data.access_token;
        throw new Error("IBM Cloud IAM Authentication failed.");
    } else {
        throw new Error(`Invalid platform '${platform}'. Allowed values: 'ibm' (or 'saas') or 'aws'.`);
    }
}

// ── Helper: RSA Key Pair Generator ──
function generateClientKeyPair(isJson = false) {
    log(isJson, "🔑 Generating RSA-4096 Client Key Pair...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    return { publicKey, privateKey };
}

// ── Operations ──
async function checkSecurityStatus({ proxyUrl, instanceUrl, apiKey, platform, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);
    const token = await getIAMToken(proxyUrl, apiKey, platform, json);

    log(json, "🔍 Checking WXO security status...");
    const config = await requestProxy(
        proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'GET',
        { 'Authorization': `Bearer ${token}` }
    );

    log(json, "\n========================================");
    if (config.is_security_enabled) {
        log(json, "🟢 CURRENT STATUS: SECURITY IS ENABLED");
    } else {
        log(json, "🔴 CURRENT STATUS: SECURITY IS DISABLED");
    }
    log(json, "========================================\n");

    return {
        success: true,
        action: "status",
        platform,
        instance_id: instanceId,
        is_security_enabled: Boolean(config.is_security_enabled),
        status: config.is_security_enabled ? "enabled" : "disabled"
    };
}

async function enableSecurity({ proxyUrl, instanceUrl, apiKey, platform, outDir, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);
    const token = await getIAMToken(proxyUrl, apiKey, platform, json);

    log(json, "📥 Requesting IBM Key Pair from WXO...");
    const ibmResp = await requestProxy(
        proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/generate-key-pair`,
        'POST',
        { 'Authorization': `Bearer ${token}` }
    );

    if (!ibmResp.public_key) {
        throw new Error("Failed to retrieve IBM Public Key from WXO server.");
    }
    const ibmPublicKey = ibmResp.public_key.replace(/\\n/g, '\n').trim();

    const clientKeys = generateClientKeyPair(json);

    log(json, "⚙️  Enabling security and uploading public keys to WXO...");
    await requestProxy(
        proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'POST',
        { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        JSON.stringify({
            is_security_enabled: true,
            public_key: ibmPublicKey,
            client_public_key: clientKeys.publicKey
        })
    );

    log(json, "\n========================================");
    log(json, "🎉 SUCCESS: SECURITY HAS BEEN ENABLED!");
    log(json, "========================================\n");

    // Save key files
    const targetDir = path.resolve(process.cwd(), outDir || './keys');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const ibmPubPath = path.join(targetDir, 'ibm_public_key.pem');
    const clientPubPath = path.join(targetDir, 'client_public_key.pem');
    const clientPrivPath = path.join(targetDir, 'client_private_key.pem');

    fs.writeFileSync(ibmPubPath, ibmPublicKey, 'utf8');
    fs.writeFileSync(clientPubPath, clientKeys.publicKey, 'utf8');
    fs.writeFileSync(clientPrivPath, clientKeys.privateKey, 'utf8');

    log(json, `📁 RSA Keys successfully written to: ${targetDir}`);
    log(json, `   - 📄 IBM Public Key:     ${ibmPubPath}`);
    log(json, `   - 📄 Client Public Key:  ${clientPubPath}`);
    log(json, `   - 🔐 Client Private Key: ${clientPrivPath}\n`);

    return {
        success: true,
        action: "enable",
        platform,
        instance_id: instanceId,
        is_security_enabled: true,
        status: "enabled",
        keys: {
            output_dir: targetDir,
            ibm_public_key: ibmPubPath,
            client_public_key: clientPubPath,
            client_private_key: clientPrivPath
        }
    };
}

async function disableSecurity({ proxyUrl, instanceUrl, apiKey, platform, json }) {
    const { apiUrl, instanceId } = parseInstanceUrl(instanceUrl);
    const token = await getIAMToken(proxyUrl, apiKey, platform, json);

    log(json, "⚠️  Disabling security on WXO instance...");
    await requestProxy(
        proxyUrl,
        `${apiUrl}/instances/${instanceId}/v1/embed/secure/config`,
        'POST',
        { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        JSON.stringify({
            is_security_enabled: false,
            public_key: "",
            client_public_key: ""
        })
    );

    log(json, "\n========================================");
    log(json, "🔓 SECURITY HAS BEEN DISABLED SUCCESSFULLY.");
    log(json, "========================================\n");

    return {
        success: true,
        action: "disable",
        platform,
        instance_id: instanceId,
        is_security_enabled: false,
        status: "disabled"
    };
}

// ── Interactive & Environment Fallback ──
async function resolveParameters(options, defaultAction = null) {
    const isJson = Boolean(options.json || process.env.WXO_JSON === 'true');
    const isNonInteractive = Boolean(
        options.nonInteractive ||
        process.env.WXO_NON_INTERACTIVE === 'true' ||
        isJson ||
        !process.stdin.isTTY
    );

    let platform = options.platform || process.env.WXO_PLATFORM;
    if (!platform) {
        if (isNonInteractive) {
            platform = 'ibm'; // Default to IBM Cloud in non-interactive mode if not specified
        } else {
            const input = await promptQuestion("Select Platform [ibm/aws] (default: ibm): ");
            platform = input ? input.toLowerCase() : 'ibm';
        }
    }
    if (platform === 'saas') platform = 'ibm';

    let apiKey = options.apiKey || process.env.WXO_API_KEY;
    if (!apiKey) {
        if (isNonInteractive) {
            throw new Error("Missing required parameter: API Key (-k, --api-key or WXO_API_KEY environment variable).");
        } else {
            const label = platform === 'aws' ? 'watsonx Orchestrate API Key' : 'IBM Cloud API Key';
            apiKey = await promptQuestion(`Enter ${label}: `);
            if (!apiKey) {
                throw new Error("API Key is required.");
            }
        }
    }

    let instanceUrl = options.instanceUrl || process.env.WXO_INSTANCE_URL;
    if (!instanceUrl) {
        if (isNonInteractive) {
            throw new Error("Missing required parameter: Instance URL (-i, --instance-url or WXO_INSTANCE_URL environment variable).");
        } else {
            instanceUrl = await promptQuestion("Enter WXO Service Instance URL: ");
            if (!instanceUrl) {
                throw new Error("WXO Instance URL is required.");
            }
        }
    }

    let action = options.action || defaultAction;
    if (!action) {
        if (isNonInteractive) {
            action = 'status';
        } else {
            const actInput = await promptQuestion("Select Action [status/enable/disable] (default: status): ");
            action = actInput ? actInput.toLowerCase() : 'status';
        }
    }

    const outDir = options.outDir || process.env.WXO_OUT_DIR || './keys';
    const proxyUrl = options.proxyUrl || DEFAULT_PROXY_URL;
    const json = isJson;

    return { proxyUrl, instanceUrl, apiKey, platform, action, outDir, json, nonInteractive: isNonInteractive };
}

// ── Main CLI Runner ──
async function runCLI(cmdOptions, actionOverride = null) {
    let isJson = Boolean(cmdOptions.json || process.env.WXO_JSON === 'true');
    try {
        const params = await resolveParameters(cmdOptions, actionOverride);
        isJson = params.json;

        let result;
        switch (params.action.toLowerCase()) {
            case 'status':
            case 'check':
                result = await checkSecurityStatus(params);
                break;
            case 'enable':
                result = await enableSecurity(params);
                break;
            case 'disable':
                result = await disableSecurity(params);
                break;
            default:
                throw new Error(`Unknown action '${params.action}'. Use 'status', 'enable', or 'disable'.`);
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

// ── Commander Setup ──
const program = new Command();

program
    .name('wxo-security')
    .description('CLI tool to toggle security for watsonx Orchestrate instances via server.js proxy')
    .version('1.0.0')
    .option('-i, --instance-url <url>', 'WXO Service Instance URL (e.g. https://api.us-south.orchestrate.ai.ibm.com/instances/...)')
    .option('-k, --api-key <key>', 'IBM Cloud or watsonx Orchestrate API Key')
    .option('-p, --platform <platform>', 'Deployment platform: "ibm" (or "saas") or "aws"')
    .option('-a, --action <action>', 'Action to perform: "status", "enable", or "disable"')
    .option('-o, --out-dir <dir>', 'Output directory for RSA keys when enabling security', './keys')
    .option('--proxy-url <url>', 'URL of server.js CORS proxy', DEFAULT_PROXY_URL)
    .option('--json', 'Output results strictly as JSON (ideal for LLM tools & scripts)')
    .option('--non-interactive', 'Disable interactive prompts and fail fast on missing arguments')
    .action(async (options) => {
        await runCLI(options);
    });

program
    .command('status')
    .description('Check the current security status of a watsonx Orchestrate instance')
    .option('-i, --instance-url <url>', 'WXO Service Instance URL')
    .option('-k, --api-key <key>', 'API Key')
    .option('-p, --platform <platform>', 'Platform: "ibm" or "aws"')
    .option('--proxy-url <url>', 'Proxy URL', DEFAULT_PROXY_URL)
    .option('--json', 'Output results strictly as JSON')
    .option('--non-interactive', 'Disable interactive prompts')
    .action(async (options) => {
        const mergedOpts = { ...program.opts(), ...options };
        await runCLI(mergedOpts, 'status');
    });

program
    .command('enable')
    .description('Enable security enforcement, generate RSA key pair, and register keys with WXO')
    .option('-i, --instance-url <url>', 'WXO Service Instance URL')
    .option('-k, --api-key <key>', 'API Key')
    .option('-p, --platform <platform>', 'Platform: "ibm" or "aws"')
    .option('-o, --out-dir <dir>', 'Directory to save RSA PEM keys', './keys')
    .option('--proxy-url <url>', 'Proxy URL', DEFAULT_PROXY_URL)
    .option('--json', 'Output results strictly as JSON')
    .option('--non-interactive', 'Disable interactive prompts')
    .action(async (options) => {
        const mergedOpts = { ...program.opts(), ...options };
        await runCLI(mergedOpts, 'enable');
    });

program
    .command('disable')
    .description('Disable security enforcement on a watsonx Orchestrate instance')
    .option('-i, --instance-url <url>', 'WXO Service Instance URL')
    .option('-k, --api-key <key>', 'API Key')
    .option('-p, --platform <platform>', 'Platform: "ibm" or "aws"')
    .option('--proxy-url <url>', 'Proxy URL', DEFAULT_PROXY_URL)
    .option('--json', 'Output results strictly as JSON')
    .option('--non-interactive', 'Disable interactive prompts')
    .action(async (options) => {
        const mergedOpts = { ...program.opts(), ...options };
        await runCLI(mergedOpts, 'disable');
    });

program.parse(process.argv);
