import NodeRSA from "node-rsa";
import jwt from "jsonwebtoken";
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
    // Decode access token to retrieve subject
    // -------------------------------------------------------------
    function decodeAccessToken(jwtStr) {
      const parts = jwtStr.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");

      return JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );
    }

    let decoded = {};
    try {
      decoded = decodeAccessToken(accessToken);
    } catch {
      // Fallback if not standard JWT format
    }

    // -------------------------------------------------------------
    // Build context object
    // -------------------------------------------------------------
    const isManager = userInfo.is_manager === true;
    const context = {
      user_profile: {
        name: userInfo.name || (isManager ? "Manager" : "General"),
        email: userInfo.email || decoded.sub || "user@company.com",
        is_manager: isManager,
      },
    };

    // -------------------------------------------------------------
    // Construct jwtContent matching jwt_server.js
    // Order: sub -> exp -> user_payload -> context -> iat
    // -------------------------------------------------------------
    const subject = decoded.sub || userInfo.email || "user@company.com";
    const jwtContent = {
      sub: subject,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour (3600 seconds)
    };

    const userPayload = { sso_token: accessToken };
    jwtContent.user_payload = userPayload;
    jwtContent.context = context;

    // -------------------------------------------------------------
    // Encrypt user_payload with IBM Public Key (RSA-OAEP / pkcs1_oaep)
    // Identical to jwt_server.js
    // -------------------------------------------------------------
    const ibmKeyBuffer = Buffer.from(ibmPublicKey, "utf-8");
    const plaintext = JSON.stringify(jwtContent.user_payload);
    const rsaKey = new NodeRSA(ibmKeyBuffer);
    rsaKey.setOptions({ encryptionScheme: "pkcs1_oaep" });
    jwtContent.user_payload = rsaKey.encrypt(
      Buffer.from(plaintext, "utf-8"),
      "base64"
    );

    // -------------------------------------------------------------
    // Sign outer JWT with Client Private Key (RS256) via jsonwebtoken
    // Identical to jwt_server.js
    // -------------------------------------------------------------
    const privateKeyBuffer = Buffer.from(clientPrivateKey, "utf-8");
    const finalJWT = jwt.sign(jwtContent, privateKeyBuffer, {
      algorithm: "RS256",
      allowInsecureKeySizes: true,
    });

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
