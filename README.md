# TechXchange: Enterprise Agentic HR Platform (Student Edition)

An enterprise-grade, secure, multi-agent HR assistant solution built on **watsonx Orchestrate**, **FastMCP**, and **Next.js**.

---

## 📁 Repository Structure

* **`embed_chat_webapp/`**: Next.js frontend embedding the watsonx Orchestrate chat interface with custom authentication and zero-trust RSA token encryption.
* **`wxo-agents-tools/`**: watsonx Orchestrate Native Agent YAML configurations, connection definitions, and Python `rbac_plugin`.
* **`wxo-security-toggle/`**: Security proxy CLI & server utility for JWT / RSA token encryption & verification.
* **`.bob/`**: Agent configurations and metadata.

---

## 🚀 Getting Started

### 1. Embed Chat WebApp
```bash
cd embed_chat_webapp
npm install
npm run dev
```

### 2. WXO Security Toggle
```bash
cd wxo-security-toggle
npm install
npm start
```
