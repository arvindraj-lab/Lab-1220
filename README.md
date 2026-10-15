# TechXchange: Enterprise Agentic HR Platform (Student Edition)

An enterprise-grade, secure, multi-agent HR assistant solution built on **watsonx Orchestrate**, **FastMCP**, and **Next.js**.

---

## 📁 Repository Structure

* **`bob_prompts/`**: Step-by-step prompt templates for generating agents, importing & deploying to watsonx Orchestrate, and enabling security.
* **`wxo-agents-tools/`**: watsonx Orchestrate Native Agent YAML configurations, connection definitions, and Python `rbac_plugin`.
* **`embed_chat_webapp/`**: Next.js frontend embedding the watsonx Orchestrate chat interface with custom authentication and zero-trust RSA token encryption.
* **`wxo-security-toggle/`**: Standalone security CLI & Web UI utility for RSA-4096 token encryption & verification.
* **`generate_token.py`**: Zero-dependency utility for generating signed JWT bearer tokens for MCP connection testing.

---

## 🚀 Getting Started

Open Bob with (`Lab-1220`) and click on the Bob terminal:

### 0. Prerequisites — Node.js

The `wxo-security-toggle` CLI and the `embed_chat_webapp` (Next.js) both require **Node.js ≥ 18**.

Before installing Node.js, check whether it is already installed on your system:

```bash
node --version
```

If Node.js is installed and the version is **18 or higher**, no installation is required.

If Node.js is **not installed** or the installed version is **below 18**, install the latest LTS version using the appropriate command below.

#### macOS

```bash
brew install node
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

#### Linux (Ubuntu / Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
echo 'export PATH="/usr/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

After installation, verify the Node.js version:

```bash
node --version
```

It should return **v18.x.x or higher**.

---

### 1. Configure `.env` with IBM Cloud Credentials

Before running any commands, update the `.env` file in the project root with your IBM Cloud credentials.

**How to get the values:**

1. **CRN** — Log in to [cloud.ibm.com](https://cloud.ibm.com) → click **Resource list** → expand the **AI / Machine Learning** category → click on your **watsonx Orchestrate** → copy the **CRN** from the details panel.
<img width="1728" height="870" alt="Screenshot 2026-08-29 at 2 11 10 PM" src="https://github.ibm.com/user-attachments/assets/daa96330-ef6f-475c-bfa7-14745ab3a202" />

<img width="1728" height="864" alt="Screenshot 2026-08-29 at 2 12 10 PM" src="https://github.ibm.com/user-attachments/assets/2a1b0957-de38-4f4c-8c81-8c1aec2699d2" />

<img width="1371" height="731" alt="Screenshot 2026-08-29 at 2 15 36 PM" src="https://github.ibm.com/user-attachments/assets/49626b02-1210-4dda-b3fe-a6526c3a8a0e" />

2. **INSTANCE_URL & API_KEY** — From the same instance details panel, click **Launch watsonx Orchestrate**. Once the product opens, on the top right click your **profile icon** → **Settings** → **API details** to copy the **Instance URL** and **API key**.

Update `.env`:
```env
CRN=<your-crn>
INSTANCE_URL=<your-instance-url>
API_KEY=<your-ibm-cloud-api-key>
```

---

### 2. Environment Setup

Open terminal in the project root (`Lab-1220`):

```bash
python3 -m venv venv
source venv/bin/activate
pip3 install ibm-watsonx-orchestrate==2.15.0

orchestrate env add --name oic_dev --url <SERVICE_INSTANCE_URL>
orchestrate env activate oic_dev --api-key <IAM_API_KEY>
```

---

### 3. Configure watsonx Orchestrate Connection

Create and configure the connection for the MCP server:

```bash
# 1. Add connection
orchestrate connections add -a mcp_server_connection

# 2. Configure draft environment
orchestrate connections configure -a mcp_server_connection --env draft --type team --kind bearer

# 3. Set draft credentials using generated token
orchestrate connections set-credentials -a mcp_server_connection --env draft --token "$(python3 generate_token.py)"

# 4. Configure live environment for SSO direct access flow
orchestrate connections configure --app-id mcp_server_connection --env live --type member --kind oauth_auth_direct_access_flow --sso
```

---

### 4. Add MCP Toolkit

Register the MCP server tools with watsonx Orchestrate:

```bash
orchestrate toolkits add --kind mcp --name mcp_tools_server --description "MCP toolkit" --url https://mcp-server-custom-idp.2d71gsaq6w6z.ca-tor.codeengine.appdomain.cloud/mcp --transport streamable_http --tools "*" --app-id mcp_server_connection
```

---

### 5. Agent Architecture & Deployment (Bob Prompts)

Follow the prompt sequence in `bob_prompts/` using Bob:

1. **`bob_prompts/01_generate_agents_prompt.txt`**: Generates the 3 Native Agent YAML definitions (`general_agent.yaml`, `manager_agent.yaml`, `hr_main_agent.yaml`).
2. **`bob_prompts/02_import_deploy_embed_prompt.txt`**: Imports agents in dependency order, deploys `hr_main_agent`, and extracts webchat embed variables into `embed_chat_webapp/.env`.
3. **`bob_prompts/03_enable_security_prompt.txt`**: Enables RSA-4096 encryption on WXO, syncs keys into `embed_chat_webapp/wxo_security_keys/`, and installs webapp dependencies.

---

### 6. Running the Web Application

#### Embed Chat WebApp
```bash
cd embed_chat_webapp
npm install
npm run dev
```
*Access the chat portal at `http://localhost:3000` (Login: `manager@123` or `general@123`).*

#### (Optional) WXO Security Toggle UI
```bash
cd wxo-security-toggle
npm start
```
*Access the security management dashboard at `http://localhost:3002`.*

