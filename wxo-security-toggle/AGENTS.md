# AI Agent Instructions for wxo-security-toggle

When an LLM or autonomous AI assistant is asked to interact with or enable/disable security for a watsonx Orchestrate instance in this repository, follow these instructions:

## Agent Execution Rules

1. **Zero-Dependency Direct Execution**:
   - `cli.js` runs directly on Node.js without requiring `npm install` or a running proxy server.
   - It automatically auto-discovers `WXO_INSTANCE_URL` from `embed_chat_webapp/.env`.

2. **Always Use `--json` Mode**:
   - Always append `--json` flag when invoking `node cli.js` programmatically.
   - Example to Enable Security:
     ```bash
     node cli.js enable --json -k "<API_KEY>"
     ```
   - Example to Check Status:
     ```bash
     node cli.js status --json -k "<API_KEY>"
     ```
   - Example to Disable Security:
     ```bash
     node cli.js disable --json -k "<API_KEY>"
     ```

3. **Key Syncing**:
   - When enabling security, `cli.js` automatically writes RSA-4096 keys to both `wxo-security-toggle/keys/` and `embed_chat_webapp/wxo_security_keys/`.

4. **Output Interpretation**:
   - Parse the JSON response from stdout.
   - If `success` is `true`, report success and list generated key paths if `action` was `enable`.
   - If `success` is `false`, inspect `error` message and verify API key validity or IAM permissions.
