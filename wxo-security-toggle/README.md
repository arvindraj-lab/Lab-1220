# watsonx Orchestrate Security Toggle

A lightweight, dual-interface application (Web UI + AI Agent CLI) to quickly check, enable, or disable security enforcement for **watsonx Orchestrate (WXO) Embedded Chat** instances.

---

## 🎯 Usage Modes

This tool provides **two seamless ways** to enable or toggle security:

1. **For Humans (Web UI)**: Interactive browser interface at `index.html` or `http://localhost:3002`.
2. **For AI Agents & LLMs**: Command-line tool with `--json` output (`cli.js`) designed for autonomous agents.

---

## 👤 Human Usage: Web UI (`index.html`)

### Step 1: Start the Server
Run the local backend server (handles IAM authentication and CORS proxying):
```bash
cd wxo-security-toggle
npm start
```
*The server starts at `http://localhost:3002`.*

### Step 2: Open the Web UI
Open **[index.html](index.html)** in your browser or navigate to `http://localhost:3002`.

### Step 3: Toggle Security
1. Select your platform (**IBM Cloud SaaS** or **AWS**).
2. Enter your **API Key** and **WXO Service Instance URL**.
3. Click:
   - **Check Status**: View current security status.
   - **Enable Security**: Generates RSA-4096 keys, registers public keys with WXO, enables security, and downloads a `.zip` containing all key PEM files.
   - **Disable Security**: Deactivates security enforcement on your instance.

---

## 🤖 LLM & AI Agent Usage: Autonomous CLI (`cli.js`)

If a user asks an LLM / AI Agent to enable security, the LLM should follow this workflow:

### Step 1: Verify Proxy Backend is Running
Check if `server.js` is active on port 3002, or start it in the background:
```bash
cd wxo-security-toggle
curl -s http://localhost:3002/api/proxy || npm start &
```

### Step 2: Enable Security (Non-Interactive JSON Mode)
Execute `node cli.js enable` passing `--json`, platform, API key, and instance URL:
```bash
node cli.js enable --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>" -o ./keys
```

**Response Output (JSON on `stdout`):**
```json
{
  "success": true,
  "action": "enable",
  "platform": "ibm",
  "instance_id": "<YOUR_INSTANCE_ID>",
  "is_security_enabled": true,
  "status": "enabled",
  "keys": {
    "output_dir": "./keys",
    "ibm_public_key": "./keys/ibm_public_key.pem",
    "client_public_key": "./keys/client_public_key.pem",
    "client_private_key": "./keys/client_private_key.pem"
  }
}
```

### Step 3: Check Status (LLM Command)
```bash
node cli.js status --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>"
```

### Step 4: Disable Security (LLM Command)
```bash
node cli.js disable --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>"
```

---

## ⚙️ Environment Variables (Optional)

Alternatively, agents or scripts can export environment variables before running commands:
```bash
export WXO_PLATFORM="ibm"
export WXO_API_KEY="<YOUR_API_KEY>"
export WXO_INSTANCE_URL="https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<YOUR_INSTANCE_ID>"

node cli.js enable --json
```

---

## 📁 Repository Structure

```text
wxo-security-toggle/
├── index.html        # Web UI for human users
├── server.js         # Express backend server & CORS proxy (port 3002)
├── cli.js            # CLI tool for LLMs & terminal users
├── README.md         # Documentation & LLM workflow guide
├── AGENTS.md         # Instructions for AI coding agents
├── package.json      # Dependencies (express, cors, commander)
└── keys/             # Output directory for generated RSA PEM key pairs
```
