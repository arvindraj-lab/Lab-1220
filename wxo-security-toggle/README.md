# watsonx Orchestrate Security Toggle

A lightweight, zero-dependency dual-interface utility (**Interactive Web UI** + **Autonomous CLI**) to check, enable, and disable Security Enforcement for **watsonx Orchestrate (WXO) Embedded Chat** instances.

---

## ⚡ Key Highlights & Optimizations

- **Zero External Dependencies**: Built with 100% native Node.js built-ins (`http`, `crypto`, `fs`, `readline`, `fetch`). No `npm install` required!
- **Auto-Discovery**: Automatically reads API keys and auto-derives Instance URLs from `embed_chat_webapp/.env`.
- **Auto-Sync to WebApp**: Automatically generates and saves RSA-4096 PEM keys to both `wxo-security-toggle/keys/` and `embed_chat_webapp/wxo_security_keys/`.
- **Dual Mode**: Clean, colorized terminal UI for humans; machine-readable `--json` output for AI agents and scripts.

---

## 🎯 Usage Modes

### 1. 🚀 Quick CLI (Zero Setup Required)

From the `wxo-security-toggle` directory:

```bash
# 1. Enable Security & Generate RSA-4096 Keys
node cli.js enable -k "<YOUR_IBM_CLOUD_API_KEY>"

# 2. Check Security Status
node cli.js status -k "<YOUR_IBM_CLOUD_API_KEY>"

# 3. Disable Security
node cli.js disable -k "<YOUR_IBM_CLOUD_API_KEY>"
```

*Note: If you have configured `embed_chat_webapp/.env`, the Instance URL is detected automatically!*

---

### 2. 🌐 Interactive Web UI (Browser)

#### Step 1: Start the Backend Server
```bash
cd wxo-security-toggle
npm start
# (or: node server.js)
```
*The server starts on `http://localhost:3002`.*

#### Step 2: Open the Web UI
Navigate to **[http://localhost:3002](http://localhost:3002)** in your browser.

#### Step 3: Toggle Security
1. Enter your **IBM Cloud API Key** (Instance URL is auto-filled from workspace).
2. Click:
   - **Check Status**: View current security status on your WXO instance.
   - **Enable Security**: Generates RSA-4096 keys, registers public keys with WXO, activates encryption, and downloads key ZIP.
   - **Disable Security**: Deactivates security enforcement on your instance.

---

### 3. 🤖 AI Agent & LLM Workflow (`--json` mode)

Autonomous agents should run the CLI with `--json` for machine-parsable outputs:

```bash
# Enable Security
node cli.js enable --json -k "<API_KEY>" -i "<INSTANCE_URL>"

# Check Status
node cli.js status --json -k "<API_KEY>" -i "<INSTANCE_URL>"

# Disable Security
node cli.js disable --json -k "<API_KEY>" -i "<INSTANCE_URL>"
```

**Sample JSON Output (`stdout`):**
```json
{
  "success": true,
  "action": "enable",
  "platform": "ibm",
  "instance_id": "9621f6ac-c42a-4096-9f31-47b4343699f3",
  "is_security_enabled": true,
  "status": "enabled",
  "keys": {
    "output_dir": ".../wxo-security-toggle/keys",
    "ibm_public_key": ".../wxo-security-toggle/keys/ibm_public_key.pem",
    "client_public_key": ".../wxo-security-toggle/keys/client_public_key.pem",
    "client_private_key": ".../wxo-security-toggle/keys/client_private_key.pem",
    "synced_to_webapp": ".../embed_chat_webapp/wxo_security_keys"
  }
}
```

---

## 🔑 Key Artifacts Generated

| File | Purpose |
|------|---------|
| `ibm_public_key.pem` | IBM's public key (used by frontend/server to encrypt user identity claims) |
| `client_public_key.pem` | Client public key (registered in watsonx Orchestrate instance) |
| `client_private_key.pem` | Client private key (kept secret, used by webapp backend to sign JWTs) |

---

## 📁 Repository Structure

```text
wxo-security-toggle/
├── index.html        # Interactive Web UI
├── server.js         # Zero-dependency HTTP server & CORS proxy (port 3002)
├── cli.js            # Zero-dependency CLI for terminal users & AI agents
├── security.txt      # Quick reference cheat sheet
├── README.md         # Comprehensive documentation
├── AGENTS.md         # Instructions for AI coding agents
├── package.json      # Package configuration
└── keys/             # Output directory for generated RSA-4096 PEM keys
```
