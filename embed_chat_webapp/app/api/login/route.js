import crypto from "crypto";
import { Buffer } from "buffer";

// -------------------------------------------------------------
// JWT Configuration matching TechXchange/mcp-server-custom-idp
// -------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "sample-secret-key-for-mcp-poc-auth-token-1234567890";
const JWT_ISSUER = process.env.OIDC_ISSUER || process.env.JWT_ISSUER || "mcp-sample-idp";
const JWT_AUDIENCE = process.env.OIDC_AUDIENCE || process.env.JWT_AUDIENCE || "api://default";

// -------------------------------------------------------------
// Pre-configured Mock Users
// -------------------------------------------------------------
const USERS = {
  manager: {
    username: "Manager",
    password: "manager@123",
    name: "Manager",
    email: "manager@company.com",
    is_manager: true,
    scopes: "mcp.read mcp.admin",
  },
  general: {
    username: "General",
    password: "general@123",
    name: "General Employee",
    email: "general@company.com",
    is_manager: false,
    scopes: "mcp.read",
  },
};

// -------------------------------------------------------------
// Helper: Sign HS256 JWT (Identical to generate_token.py)
// -------------------------------------------------------------
function generateSSOToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const scopeList = user.scopes.split(" ");

  const payload = {
    sub: user.email,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    nbf: now,
    exp: now + 3600, // 1 hour validity
    scope: user.scopes,
    scp: scopeList,
    client_id: user.email,
    is_manager: user.is_manager,
    user_profile: {
      name: user.name,
      email: user.email,
      is_manager: user.is_manager,
    },
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalizedKey = username.trim().toLowerCase();
    const user = USERS[normalizedKey];

    if (!user || user.password !== password) {
      return new Response(
        JSON.stringify({ error: "Invalid username or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate SSO Bearer token matching mcp-server-custom-idp format
    const ssoToken = generateSSOToken(user);

    const userInfo = {
      name: user.name,
      email: user.email,
      is_manager: user.is_manager,
    };

    return new Response(
      JSON.stringify({
        success: true,
        userInfo,
        accessToken: ssoToken,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
