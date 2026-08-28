# 💬 Embed Chat WebApp (Custom Mock IdP)

A **Next.js** web application that embeds the **watsonx Orchestrate** chat widget with **Custom SSO / Token Authentication** (No external Okta IdP required).

Users log in via the custom login page as either **Manager** or **General Employee**, and the app securely generates a signed JWT (RS256) to authenticate against the Orchestrate embedded chat API using the **On-Behalf-Of (OBO)** flow.

---

## 👥 Pre-configured Users

| Username | Password | Role | `is_manager` Claim | Scopes |
|---|---|---|---|---|
| **`Manager`** | `manager@123` | Manager | `true` | `mcp.read mcp.admin` |
| **`General`** | `general@123` | General Employee | `false` | `mcp.read` |

---

## 📁 Project Structure

```
embed_chat_webapp/
├── app/
│   ├── api/
│   │   ├── login/
│   │   │   └── route.js        # Validates credentials & issues HS256 SSO token
│   │   └── encrypt/
│   │       └── route.js        # Encrypts sso_token with IBM Public Key & signs WXO JWT (RS256)
│   ├── layout.js               # Root layout
│   └── page.js                 # Login form + Watsonx Orchestrate chat embed UI
├── config.js                   # Orchestrate integration settings
├── public/
│   └── hr-banner.png           # Background image
├── wxo_security_keys/          # RSA PEM key files
│   ├── client_private_key.pem  # Signs WXO JWTs (RS256)
│   ├── client_public_key.pem   # Registered with WXO
│   └── ibm_public_key.pem      # IBM's public key for payload encryption
├── .env                        # Environment variables
├── Dockerfile                  # Multi-stage Docker build
├── package.json
└── README.md
```

---

## ⚙️ How It Works

1. **User Login (`/api/login`)**:
   - The user enters credentials (`Manager` or `General`).
   - The server validates credentials and creates an **SSO Bearer Token** (`HS256`) matching the format from `mcp-server-custom-idp/generate_token.py`.
   - `is_manager: true` is included for Manager and `is_manager: false` for General.

2. **WXO Identity Token Generation (`/api/encrypt`)**:
   - Encrypts `user_payload: { sso_token: <accessToken> }` using **IBM's Public Key** (RSA).
   - Sets the Watsonx Orchestrate context:
     ```json
     {
       "user_profile": {
         "name": "Manager",
         "email": "manager@company.com",
         "is_manager": true
       }
     }
     ```
   - Signs the outer JWT with **Client Private Key** (`RS256`).

3. **Orchestrate Chat Embed**:
   - The signed JWT is passed to Watsonx Orchestrate's chat loader script (`wxoLoader.js`), embedding the chat widget into the web app.

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start development server
```bash
npm run dev
```

### 3. Open in browser
```
http://localhost:3000
```
Use the quick login buttons or enter `Manager` / `manager@123` or `General` / `general@123`.
