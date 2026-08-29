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

### 0. Configure `.env` with IBM Cloud Credentials

Before running any commands, update the `.env` file in the project root with your IBM Cloud credentials.

**How to get the values:**

1. **CRN** — Log in to [cloud.ibm.com](https://cloud.ibm.com) → click **Resource list** → expand the **AI / Machine Learning** category → click on your **watsonx Orchestrate** → copy the **CRN** from the details panel.

2. **INSTANCE_URL & API_KEY** — From the same instance details panel, click **Launch watsonx Orchestrate**. Once the product opens, you can copy the **Instance URL** from your browser's address bar or the instance settings. Your **API Key** can be created at [cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys).

Update `.env`:
```env
CRN=<your-crn>
INSTANCE_URL=<your-instance-url>
API_KEY=<your-ibm-cloud-api-key>
```

---

### 1. Environment Setup


Open terminal in the project root (`Lab-1220`):

```bash
python3.11 -m venv venv
source venv/bin/activate
pip3 install ibm-watsonx-orchestrate==2.15.0

orchestrate env add --name oic_dev --url <SERVICE_INSTANCE_URL>
orchestrate env activate oic_dev --api-key <IAM_API_KEY>
```

---

### 2. Configure watsonx Orchestrate Connection

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

### 3. Add MCP Toolkit

Register the MCP server tools with watsonx Orchestrate:

```bash
orchestrate toolkits add --kind mcp --name mcp_tools_server --description "MCP toolkit" --url https://mcp-server-custom-idp.2d71gsaq6w6z.ca-tor.codeengine.appdomain.cloud/mcp --transport streamable_http --tools "*" --app-id mcp_server_connection
```

---

### 4. Agent Architecture & Deployment (Bob Prompts)

Follow the prompt sequence in `bob_prompts/` using Bob:

1. **`bob_prompts/01_generate_agents_prompt.txt`**: Generates the 3 Native Agent YAML definitions (`general_agent.yaml`, `manager_agent.yaml`, `hr_main_agent.yaml`).
2. **`bob_prompts/02_import_deploy_embed_prompt.txt`**: Imports agents in dependency order, deploys `hr_main_agent`, and extracts webchat embed variables into `embed_chat_webapp/.env`.
3. **`bob_prompts/03_enable_security_prompt.txt`**: Enables RSA-4096 encryption on WXO, syncs keys into `embed_chat_webapp/wxo_security_keys/`, and installs webapp dependencies.

---

### 5. Running the Web Application

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
