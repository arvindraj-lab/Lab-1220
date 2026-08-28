import NodeRSA from "node-rsa";
import crypto from "crypto";
import { Buffer } from "buffer";
import fs from "fs";
import path from "path";

// -------------------------------------------------------------
// Load keys from wxo_security_keys/ or environment variables
// -------------------------------------------------------------
function loadKeys() {
  let clientPrivateKey = process.env.CLIENT_PRIVATE_KEY;
  let ibmPublicKey = process.env.IBM_PUBLIC_KEY;

  const keysDir = path.join(process.cwd(), "wxo_security_keys");
  const privateKeyPath = path.join(keysDir, "client_private_key.pem");
  const ibmKeyPath = path.join(keysDir, "ibm_public_key.pem");

  if (!clientPrivateKey && fs.existsSync(privateKeyPath)) {
    clientPrivateKey = fs.readFileSync(privateKeyPath, "utf8");
  }

  if (!ibmPublicKey && fs.existsSync(ibmKeyPath)) {
    ibmPublicKey = fs.readFileSync(ibmKeyPath, "utf8");
  }

  return { clientPrivateKey, ibmPublicKey };
}

export async function POST(request) {
  try {
    const { userInfo, accessToken } = await request.json();

    if (!userInfo || !accessToken) {
      return new Response(
        JSON.stringify({
          error: "Missing userInfo or accessToken",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { clientPrivateKey, ibmPublicKey } = loadKeys();

    if (!clientPrivateKey || !ibmPublicKey) {
      return new Response(
        JSON.stringify({
          error: "Security keys not found in wxo_security_keys/ directory or environment variables.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------
    // Decode access token to retrieve standard claims
    // -------------------------------------------------------------
    function decodeAccessToken(jwt) {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");

      return JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );
    }

    const decoded = decodeAccessToken(accessToken);

    // -------------------------------------------------------------
    // Build user_profile under context (including is_manager)
    // -------------------------------------------------------------
    const isManager = userInfo.is_manager === true;
    const context = {
      user_profile: {
        name: userInfo.name || (isManager ? "Manager" : "General"),
        email: userInfo.email || decoded.sub,
        is_manager: isManager,
      },
    };

    // -------------------------------------------------------------
    // Encrypt user_payload (containing sso_token) with IBM Public Key
    // -------------------------------------------------------------
    const user_payload = { sso_token: accessToken };
    const rsaKey = new NodeRSA(ibmPublicKey);
    const encryptedUserPayload = rsaKey.encrypt(
      Buffer.from(JSON.stringify(user_payload)),
      "base64"
    );

    // -------------------------------------------------------------
    // Build outer JWT payload
    // -------------------------------------------------------------
    const now = Math.floor(Date.now() / 1000);
    const jwtContent = {
      sub: decoded.sub || userInfo.email,
      iat: decoded.iat || now,
      exp: decoded.exp || now + 3600,
      user_payload: encryptedUserPayload,
      context,
    };

    // -------------------------------------------------------------
    // Sign outer JWT with Client Private Key (RS256)
    // -------------------------------------------------------------
    const header = { alg: "RS256", typ: "JWT" };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(jwtContent)).toString("base64url");
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .sign("RSA-SHA256", Buffer.from(signingInput), {
        key: clientPrivateKey,
      })
      .toString("base64url");

    const finalJWT = `${signingInput}.${signature}`;

    return new Response(JSON.stringify({ token: finalJWT, context }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error building JWT:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
