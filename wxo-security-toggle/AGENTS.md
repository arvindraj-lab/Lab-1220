# AI Agent Instructions for wxo-security-toggle

When an LLM or autonomous AI assistant is asked to interact with or enable/disable security for a watsonx Orchestrate instance in this repository, follow these instructions:

## Agent Execution Rules

1. **Backend Verification**:
   - Ensure the proxy backend (`server.js`) is running on `http://localhost:3002`.
   - Test connectivity: `curl -s http://localhost:3002/api/proxy || npm start &`

2. **Always Use `--json` Mode**:
   - Always append `--json` flag to `node cli.js` commands when invoked programmatically.
   - Example to Enable Security:
     ```bash
     node cli.js enable --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>" -o ./keys
     ```
   - Example to Check Status:
     ```bash
     node cli.js status --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>"
     ```
   - Example to Disable Security:
     ```bash
     node cli.js disable --json -p <ibm|aws> -k "<API_KEY>" -i "<INSTANCE_URL>"
     ```

3. **Output Interpretation**:
   - Parse the JSON response from stdout.
   - If `success` is `true`, report success and list generated key paths if `action` was `enable`.
   - If `success` is `false`, inspect `error` message and troubleshoot authentication or instance URL formatting.

4. **Environment Variables**:
   - The CLI supports `WXO_PLATFORM`, `WXO_API_KEY`, `WXO_INSTANCE_URL`, `WXO_JSON=true`, `WXO_NON_INTERACTIVE=true`.
