#!/usr/bin/env python3
"""
Token Generator Utility for watsonx Orchestrate & FastMCP Server.

Generates signed JWT bearer tokens accepted by FastMCP server, watsonx Orchestrate,
and the RBAC plugin without requiring an external IdP.

Default output is the pure JWT token on stdout, making it ready for CLI subshells:
    orchestrate connections set-credentials -a mcp_connections --env draft --token "$(python3 generate_token.py)"
"""

import os
import sys
import json
import time
import hmac
import base64
import hashlib
import argparse
from typing import Any, Dict, List, Optional, Union

# ---------------------------------------------------------------------------
# Auto-load .env files if present (Zero-dependency fallback)
# ---------------------------------------------------------------------------
def _load_env_files() -> None:
    candidate_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "embed_chat_webapp", ".env.local"),
        os.path.join(os.path.dirname(__file__), "embed_chat_webapp", ".env"),
        os.path.join(os.path.dirname(__file__), "wxo-security-toggle", ".env"),
    ]
    for env_path in candidate_paths:
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

_load_env_files()

# ---------------------------------------------------------------------------
# Default configurations matching server.py & embed_chat_webapp
# ---------------------------------------------------------------------------
DEFAULT_SECRET = os.getenv("JWT_SECRET", "sample-secret-key-for-mcp-poc-auth-token-1234567890")
DEFAULT_ISSUER = os.getenv("OIDC_ISSUER", os.getenv("JWT_ISSUER", "mcp-sample-idp"))
DEFAULT_AUDIENCE = os.getenv("OIDC_AUDIENCE", os.getenv("JWT_AUDIENCE", "api://default"))
DEFAULT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
DEFAULT_EXPIRATION = 86400  # 24 hours validity

# Pre-configured Mock Roles matching TechXchange RBAC & WebApp
ROLES: Dict[str, Dict[str, Any]] = {
    "manager": {
        "email": "manager@company.com",
        "name": "Manager",
        "is_manager": True,
        "scopes": "mcp.read mcp.admin",
    },
    "general": {
        "email": "general@company.com",
        "name": "General Employee",
        "is_manager": False,
        "scopes": "mcp.read",
    },
}

# ---------------------------------------------------------------------------
# Zero-dependency HS256 JWT Signing
# ---------------------------------------------------------------------------
def _base64url_encode(data: bytes) -> str:
    """Encode bytes to base64url string without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def sign_hs256(payload: Dict[str, Any], secret: str) -> str:
    """Generate a standard HS256 signed JWT using Python standard library."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_json = json.dumps(header, separators=(",", ":"), ensure_ascii=False)
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

    encoded_header = _base64url_encode(header_json.encode("utf-8"))
    encoded_payload = _base64url_encode(payload_json.encode("utf-8"))

    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def generate_token(
    subject: Optional[str] = None,
    scopes: Optional[Union[List[str], str]] = None,
    expires_in_seconds: int = DEFAULT_EXPIRATION,
    secret: str = DEFAULT_SECRET,
    issuer: str = DEFAULT_ISSUER,
    audience: str = DEFAULT_AUDIENCE,
    algorithm: str = DEFAULT_ALGORITHM,
    role: str = "manager",
    is_manager: Optional[bool] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
) -> str:
    """
    Generate a signed JWT bearer token compatible with FastMCP & watsonx Orchestrate.
    
    Args:
        subject: Subject identifier (user id / email). Defaults to role email.
        scopes: Scope string or list of scopes (e.g. 'mcp.read mcp.admin').
        expires_in_seconds: Token validity in seconds (default: 86400 / 24h).
        secret: HMAC shared secret key.
        issuer: Token issuer claim (iss).
        audience: Token audience claim (aud).
        algorithm: Signing algorithm ('HS256').
        role: Role preset ('manager' or 'general').
        is_manager: Explicitly set is_manager flag (overrides role preset).
        name: User display name for user_profile claim.
        email: User email for user_profile claim.
    
    Returns:
        Signed JWT string.
    """
    role_config = ROLES.get(role, ROLES["manager"])
    
    # Resolve values with role fallback
    user_email = email or subject or role_config["email"]
    user_sub = subject or user_email
    user_name = name or role_config["name"]
    mgr_flag = role_config["is_manager"] if is_manager is None else is_manager
    
    if scopes is None:
        scope_str = role_config["scopes"]
        scp_list = scope_str.split()
    elif isinstance(scopes, list):
        scope_str = " ".join(scopes)
        scp_list = scopes
    else:
        scope_str = scopes
        scp_list = scopes.split()

    now = int(time.time())
    
    payload: Dict[str, Any] = {
        "sub": user_sub,
        "iss": issuer,
        "aud": audience,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in_seconds,
        "scope": scope_str,
        "scp": scp_list,
        "client_id": user_sub,
        "is_manager": mgr_flag,
        "user_profile": {
            "name": user_name,
            "email": user_email,
            "is_manager": mgr_flag,
        },
    }

    if algorithm == "HS256":
        return sign_hs256(payload, secret)
    else:
        # Fallback to PyJWT if another algorithm like RS256 is requested
        try:
            import jwt
            return jwt.encode(payload, secret, algorithm=algorithm)
        except ImportError:
            raise RuntimeError(f"Algorithm '{algorithm}' requires 'pyjwt'. Install with: pip install pyjwt")


def copy_to_clipboard(text: str) -> bool:
    """Copy text to OS clipboard using native tools."""
    import subprocess
    try:
        if sys.platform == "darwin":
            p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
            p.communicate(text.encode("utf-8"))
            return p.returncode == 0
        elif sys.platform.startswith("linux"):
            for cmd in [["xclip", "-selection", "clipboard"], ["wl-copy"]]:
                try:
                    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
                    p.communicate(text.encode("utf-8"))
                    if p.returncode == 0:
                        return True
                except FileNotFoundError:
                    continue
        elif sys.platform == "win32":
            p = subprocess.Popen(["clip"], stdin=subprocess.PIPE)
            p.communicate(text.encode("utf-8"))
            return p.returncode == 0
    except Exception:
        pass
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate JWT Bearer token for FastMCP & watsonx Orchestrate",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Output token directly (default):
  python3 generate_token.py

  # Set Orchestrate connection credentials in one command:
  orchestrate connections set-credentials -a mcp_connections --env draft --token "$(python3 generate_token.py)"

  # Generate token for general employee:
  python3 generate_token.py --role general

  # Show token metadata & sample curl command:
  python3 generate_token.py -v
        """
    )
    parser.add_argument("--role", choices=["manager", "general"], default="manager",
                        help="Role preset matching TechXchange RBAC (default: 'manager')")
    parser.add_argument("--sub", default=None, help="Subject identifier / email")
    parser.add_argument("--name", default=None, help="User display name")
    parser.add_argument("--email", default=None, help="User email")
    parser.add_argument("--scope", default=None, help="OAuth scopes (default: 'mcp.read mcp.admin' for manager)")
    parser.add_argument("--expires", type=int, default=DEFAULT_EXPIRATION,
                        help=f"Token expiration in seconds (default: {DEFAULT_EXPIRATION}s / 24h)")
    parser.add_argument("--hours", type=float, default=None,
                        help="Token expiration in hours (overrides --expires)")
    parser.add_argument("--secret", default=DEFAULT_SECRET, help="Signing secret key")
    parser.add_argument("--issuer", default=DEFAULT_ISSUER, help="Issuer claim (iss)")
    parser.add_argument("--audience", default=DEFAULT_AUDIENCE, help="Audience claim (aud)")
    parser.add_argument("--manager", dest="is_manager", action="store_true", default=None,
                        help="Force is_manager = True in token payload")
    parser.add_argument("--no-manager", dest="is_manager", action="store_false", default=None,
                        help="Force is_manager = False in token payload")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print token claims and curl helper details to stderr")
    parser.add_argument("--copy", "-c", action="store_true",
                        help="Copy generated token to clipboard")
    parser.add_argument("--raw", action="store_true", default=True,
                        help="(Default) Output raw token string only")

    args = parser.parse_args()

    # Calculate expiration
    expires_seconds = int(args.hours * 3600) if args.hours is not None else args.expires

    token = generate_token(
        subject=args.sub,
        scopes=args.scope,
        expires_in_seconds=expires_seconds,
        secret=args.secret,
        issuer=args.issuer,
        audience=args.audience,
        role=args.role,
        is_manager=args.is_manager,
        name=args.name,
        email=args.email,
    )

    if args.copy:
        copied = copy_to_clipboard(token)
        if copied:
            sys.stderr.write("✓ Token copied to clipboard!\n")
        else:
            sys.stderr.write("! Warning: Clipboard utility not available.\n")

    if args.verbose:
        sys.stderr.write("=" * 60 + "\n")
        sys.stderr.write("Generated MCP JWT Bearer Token\n")
        sys.stderr.write("=" * 60 + "\n")
        sys.stderr.write(f"Role:       {args.role}\n")
        sys.stderr.write(f"Expires in: {expires_seconds} seconds ({expires_seconds / 3600:.1f} hours)\n")
        sys.stderr.write(f"Issuer:     {args.issuer}\n")
        sys.stderr.write(f"Audience:   {args.audience}\n")
        sys.stderr.write("-" * 60 + "\n")
        sys.stderr.write("Sample Curl Command:\n")
        sys.stderr.write(f'  curl -X POST http://localhost:8080/mcp \\\n')
        sys.stderr.write(f'    -H "Authorization: Bearer {token}" \\\n')
        sys.stderr.write(f'    -H "Accept: application/json, text/event-stream" \\\n')
        sys.stderr.write(f'    -H "Content-Type: application/json" \\\n')
        sys.stderr.write(f'    -d \'{{"jsonrpc":"2.0","id":1,"method":"initialize","params":{{"protocolVersion":"2024-11-05","capabilities":{{}},"clientInfo":{{"name":"test-client","version":"1.0"}}}}}}\'\n')
        sys.stderr.write("=" * 60 + "\n\n")

    # Output ONLY the raw token string to stdout for seamless piping / CLI integration
    print(token)


if __name__ == "__main__":
    main()
