"use client";

import { useState, useEffect, useRef } from "react";
import { APP_CONFIG } from "../config";

function clearEmbedSession() {
  document.cookie =
    "embed_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  sessionStorage.removeItem("embed_user_id_dev");
  sessionStorage.removeItem("current_session_user_id");
  sessionStorage.removeItem("auth_user");
  sessionStorage.removeItem("auth_token");
  sessionStorage.embed_user_id_dev = Math.trunc(Math.random() * 1000000);
}

/* ------------------------------------------------------------------ */
/* Decorative primitives — deterministic so SSR and client agree       */
/* ------------------------------------------------------------------ */

const MOTES = [
  { l: "8%",  d: 17, delay: 0,   s: 2 },
  { l: "17%", d: 23, delay: 3.4, s: 1.5 },
  { l: "26%", d: 19, delay: 7.1, s: 2.5 },
  { l: "35%", d: 26, delay: 1.8, s: 1.5 },
  { l: "44%", d: 21, delay: 9.6, s: 2 },
  { l: "53%", d: 24, delay: 5.2, s: 1.5 },
  { l: "62%", d: 18, delay: 12.3, s: 2.5 },
  { l: "71%", d: 27, delay: 2.7, s: 2 },
  { l: "80%", d: 20, delay: 8.5, s: 1.5 },
  { l: "89%", d: 22, delay: 4.4, s: 2 },
  { l: "95%", d: 25, delay: 11.2, s: 1.5 },
];

const STARS = [
  { t: "12%", l: "14%", d: 3.2, delay: 0 },
  { t: "22%", l: "78%", d: 4.1, delay: 0.9 },
  { t: "34%", l: "9%",  d: 2.8, delay: 1.7 },
  { t: "41%", l: "63%", d: 3.7, delay: 0.4 },
  { t: "57%", l: "88%", d: 4.4, delay: 2.3 },
  { t: "66%", l: "23%", d: 3.1, delay: 1.2 },
  { t: "74%", l: "71%", d: 3.9, delay: 2.9 },
  { t: "83%", l: "38%", d: 2.6, delay: 0.6 },
  { t: "18%", l: "46%", d: 4.6, delay: 3.4 },
  { t: "90%", l: "56%", d: 3.4, delay: 1.9 },
];

const HEX_TICKER =
  "3f9a2c 0x4b1e77d2 a81c 0xc4f0 rsa-2048 9de3 0x77ab21 sha256 6c0f 0x1d84be oaep 5a2e 0x93fc17 rs256 e410 0x2b6d ";

/* ------------------------------------------------------------------ */
/* Inline icon set                                                     */
/* ------------------------------------------------------------------ */

const Icon = {
  user: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  lock: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  eye: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.68 3.68M6.6 6.6A17.7 17.7 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 5.4-1.6" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  ),
  crown: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 18h20l-1.5-9-5 3.5L12 5 8.5 12.5l-5-3.5L2 18Z" />
    </svg>
  ),
  badge: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 21a7 7 0 0 1 13 0" />
    </svg>
  ),
  check: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m4 12.5 5.2 5.2L20 6.8" />
    </svg>
  ),
  arrow: (p) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h13" />
      <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  ),
  shield: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-3.6 8-10V5.2L12 2 4 5.2V12c0 6.4 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  alert: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  bolt: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  ),
  logout: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  bigLock: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="10.5" width="17" height="11" rx="2.4" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
      <circle cx="12" cy="16" r="1.4" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Presentation-only motion components                                 */
/* ------------------------------------------------------------------ */

const SCRAMBLE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@/\\<>*";

/** Decrypt-style reveal. Renders the final text on the server and during
 *  reduced-motion, so it never changes what the page actually says. */
function ScrambleText({ text, className = "", duration = 950, delay = 0 }) {
  const [display, setDisplay] = useState(text);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let startedAt = 0;

    const timer = setTimeout(() => {
      setBusy(true);
      const tick = (now) => {
        if (!startedAt) startedAt = now;
        const t = Math.min(1, (now - startedAt) / duration);
        const revealed = t * text.length;
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (i < revealed || ch === " ") out += ch;
          else out += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
        }
        setDisplay(out);
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setDisplay(text);
          setBusy(false);
        }
      };
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text, duration, delay]);

  return <span className={`scramble ${busy ? "busy" : ""} ${className}`}>{display}</span>;
}

/** Eases the rendered percentage toward the real one so the meter glides
 *  between the discrete handshake stages. Isolated so the tween only
 *  re-renders the meter. */
function ProgressMeter({ progress }) {
  const [shown, setShown] = useState(progress);
  const value = useRef(progress);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const diff = progress - value.current;
      if (Math.abs(diff) < 0.4) {
        value.current = progress;
        setShown(progress);
        return;
      }
      value.current += diff * 0.14;
      setShown(value.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
        <span className="eyebrow">Handshake Progress</span>
        <span className="mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--indigo-300)" }}>
          {Math.round(shown)}%
        </span>
      </div>
      <div className="progress-track" style={{ marginBottom: "22px" }}>
        <div className="progress-bar-shimmer" style={{ width: `${shown}%` }} />
      </div>
    </>
  );
}

export default function Page() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null); // 'manager' | 'general'
  const [error, setError] = useState("");

  // Cinematic Multi-Step Loading State
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStep, setAuthStep] = useState(0);
  const [authProgress, setAuthProgress] = useState(0);

  // Presentation-only refs/state for the cursor-reactive lighting
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const submitRef = useRef(null);
  const [ripples, setRipples] = useState([]);

  const AUTH_STEPS = [
    { title: "Verifying User Credentials", subtitle: "Checking role authorization & access level..." },
    { title: "Generating Custom SSO Token (HS256)", subtitle: "Signing claims with shared symmetric secret..." },
    { title: "Encrypting Payload with IBM Public Key (RSA)", subtitle: "Encrypting SSO bearer token for WXO OBO flow..." },
    { title: "Signing WXO Assertion (RS256)", subtitle: "Creating final cryptographic identity assertion..." },
    { title: "Initializing watsonx Orchestrate Session", subtitle: "Routing to multi-agent supervisor..." },
  ];

  // -------------------------------------------------------------
  // Restore Session on Mount
  // -------------------------------------------------------------
  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem("auth_user");
      const savedToken = sessionStorage.getItem("auth_token");
      if (savedUser && savedToken) {
        const parsed = JSON.parse(savedUser);
        setUserInfo(parsed);
        setAccessToken(savedToken);
        setIsAuthenticated(true);
      }
    } catch {
      clearEmbedSession();
    }
  }, []);

  // -------------------------------------------------------------
  // Cursor-reactive spotlight + parallax tilt (purely cosmetic)
  // -------------------------------------------------------------
  useEffect(() => {
    if (isAuthenticated) return;

    const stage = stageRef.current;
    if (!stage) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    function onMove(e) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        stage.style.setProperty("--mx", `${e.clientX}px`);
        stage.style.setProperty("--my", `${e.clientY}px`);

        // Normalised -0.5..0.5 cursor offset drives the background parallax
        stage.style.setProperty("--px", ((e.clientX / window.innerWidth) - 0.5).toFixed(3));
        stage.style.setProperty("--py", ((e.clientY / window.innerHeight) - 0.5).toFixed(3));

        const btn = submitRef.current;
        if (btn && fine && !reduced) {
          const br = btn.getBoundingClientRect();
          const dx = e.clientX - (br.left + br.width / 2);
          const dy = e.clientY - (br.top + br.height / 2);
          const near = Math.abs(dx) < br.width / 2 + 90 && Math.abs(dy) < br.height / 2 + 70;
          btn.style.setProperty("--bx", near ? `${(dx * 0.09).toFixed(2)}px` : "0px");
          btn.style.setProperty("--by", near ? `${(dy * 0.16).toFixed(2)}px` : "0px");
        }

        const card = cardRef.current;
        if (!card || !fine || reduced) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
        card.style.setProperty("--ry", `${((px - 0.5) * 7).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
      });
    }

    function onLeave() {
      const card = cardRef.current;
      if (!card) return;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isAuthenticated]);

  // -------------------------------------------------------------
  // Role Preset Selection Helper
  // -------------------------------------------------------------
  function selectPreset(role) {
    setSelectedRole(role);
    setError("");
    if (role === "manager") {
      setUsername("Manager");
      setPassword("manager@123");
    } else if (role === "general") {
      setUsername("General");
      setPassword("general@123");
    }
  }

  // -------------------------------------------------------------
  // Handle Login with Multi-Stage Cinematic Progression
  // -------------------------------------------------------------
  async function handleLogin(e, customCreds = null) {
    if (e) e.preventDefault();
    setError("");

    const loginUser = customCreds ? customCreds.username : username;
    const loginPass = customCreds ? customCreds.password : password;

    if (!loginUser.trim() || !loginPass.trim()) {
      setError("Please enter both username and password");
      return;
    }

    // Start Multi-Stage Loading
    setIsAuthenticating(true);
    setAuthStep(0);
    setAuthProgress(15);

    try {
      // Step 0 -> 1
      await new Promise((r) => setTimeout(r, 250));
      setAuthStep(1);
      setAuthProgress(35);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUser,
          password: loginPass,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsAuthenticating(false);
        setError(data.error || "Invalid credentials. Try Manager or General.");
        return;
      }

      // Step 2: Encrypting
      await new Promise((r) => setTimeout(r, 300));
      setAuthStep(2);
      setAuthProgress(60);

      // Step 3: Signing
      await new Promise((r) => setTimeout(r, 300));
      setAuthStep(3);
      setAuthProgress(85);

      // Step 4: Finalizing
      await new Promise((r) => setTimeout(r, 250));
      setAuthStep(4);
      setAuthProgress(100);

      // Save session
      sessionStorage.setItem("auth_user", JSON.stringify(data.userInfo));
      sessionStorage.setItem("auth_token", data.accessToken);

      await new Promise((r) => setTimeout(r, 400));
      setUserInfo(data.userInfo);
      setAccessToken(data.accessToken);
      setIsAuthenticated(true);
      setIsAuthenticating(false);
    } catch (err) {
      setIsAuthenticating(false);
      setError("Unable to connect to authentication service. Please check network.");
    }
  }

  // -------------------------------------------------------------
  // Watsonx Orchestrate Chat Embed Initialization
  // -------------------------------------------------------------
  useEffect(() => {
    if (!userInfo || !accessToken) return;
    if (window.orchestrateInitCalled) return;

    const orchestrateInfo = APP_CONFIG.orchestrate;
    if (!orchestrateInfo?.hostURL) return;

    async function generateJWT() {
      const res = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInfo,
          accessToken,
        }),
      });

      const { token } = await res.json();
      return token;
    }

    async function getIdentityToken() {
      const token = await generateJWT();
      if (window.wxOConfiguration) {
        window.wxOConfiguration.token = token;
      }
      return token;
    }

    window.wxOConfiguration = {
      orchestrationID: orchestrateInfo.orchestrationID,
      hostURL: orchestrateInfo.hostURL,
      rootElementID: "root",
      showLauncher: true,
      deploymentPlatform: "ibmcloud",
      crn: orchestrateInfo.crn,
      identityTokenFunction: getIdentityToken,
      chatOptions: {
        agentId: orchestrateInfo.agentId,
        agentEnvironmentId: orchestrateInfo.agentEnvironmentId,
        onLoad(instance) {
          instance.on("authTokenNeeded", async (e) => {
            e.authToken = await getIdentityToken();
          });
        },
      },
      layout: {
        form: "float",
        showOrchestrateHeader: true,
      },
      // Widget theming only — the loader reads config.public.style and maps
      // theme:"dark" to Carbon's g100 token set, so the chat matches the shell.
      style: {
        theme: "dark",
        primaryColor: "#6366F1",
      },
    };

    window.orchestrateInitCalled = true;

    getIdentityToken().then(() => {
      const script = document.createElement("script");
      script.src = `${orchestrateInfo.hostURL}/wxochat/wxoLoader.js?embed=true`;
      script.onload = () => {
        if (window.wxoLoader) {
          window.wxoLoader.init();
        }
      };
      document.head.appendChild(script);
    });
  }, [userInfo, accessToken]);

  // -------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------
  function handleLogout() {
    clearEmbedSession();
    window.orchestrateInitCalled = false;
    setUserInfo(null);
    setAccessToken(null);
    setIsAuthenticated(false);
    window.location.reload();
  }

  const isManager = !!userInfo?.is_manager;

  return (
    <div ref={stageRef} style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* ============================ AMBIENT ATMOSPHERE ============================ */}

      <div className="orb-field">
        {/* Each layer drifts a different distance with the cursor for depth */}
        <div className="orb-parallax" style={{ "--depth": "46px" }}>
          <div
            className="orb animate-orb-1"
            style={{
              top: "-18%",
              left: "-12%",
              width: "58vw",
              height: "58vw",
              background:
                "radial-gradient(circle, rgba(99, 102, 241, 0.26) 0%, rgba(79, 70, 229, 0.08) 48%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="orb-parallax" style={{ "--depth": "-38px" }}>
          <div
            className="orb animate-orb-2"
            style={{
              bottom: "-22%",
              right: "-12%",
              width: "62vw",
              height: "62vw",
              background:
                "radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(34, 211, 238, 0.07) 48%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        <div className="orb-parallax" style={{ "--depth": "70px" }}>
          <div
            className="orb animate-orb-3"
            style={{
              top: "36%",
              left: "34%",
              width: "42vw",
              height: "42vw",
              background: "radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, transparent 65%)",
              filter: "blur(90px)",
            }}
          />
        </div>
      </div>

      <div className="bg-layer grid-bg" />
      <div className="scan-beam" />
      <div className="spotlight" />

      {STARS.map((s, i) => (
        <span
          key={`st-${i}`}
          className="star"
          style={{ top: s.t, left: s.l, animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }}
        />
      ))}

      {MOTES.map((m, i) => (
        <span
          key={`mo-${i}`}
          className="mote"
          style={{
            left: m.l,
            width: `${m.s}px`,
            height: `${m.s}px`,
            animationDuration: `${m.d}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}

      <div className="vignette" />
      <div className="grain" />

      {/* ================================================================= */}
      {/* 1. LOGIN SCREEN                                                  */}
      {/* ================================================================= */}
      {!isAuthenticated ? (
        <main
          style={{
            position: "relative",
            zIndex: 2,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "44px 16px",
          }}
        >
          <div className="auth-shell animate-card-enter">
            <div className="auth-aura" />
            <div className="auth-halo" />

            <div ref={cardRef} className="auth-card glass-panel">
              {/* Handshake-complete flash, right before the chat view takes over */}
              {isAuthenticating && authProgress >= 100 && (
                <div className="burst">
                  <span className="burst-flash" />
                  <span className="burst-ring" />
                  <span className="burst-ring d2" />
                  <span className="burst-ring d3" />
                </div>
              )}

              <div className="card-body">
                {/* ------------------------------------------------------------- */}
                {/* STATE A: MULTI-STAGE CINEMATIC LOADING OVERLAY               */}
                {/* ------------------------------------------------------------- */}
                {isAuthenticating ? (
                  <div className="animate-scale-in" style={{ minHeight: "494px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ textAlign: "center", marginBottom: "22px" }}>
                      {/* Tri-ring orbital spinner */}
                      <div className="orbit-core">
                        <span className="orbit-glow" />
                        <span className="orbit-ring r1" />
                        <span className="orbit-ring r2" />
                        <span className="orbit-ring r3" />
                        <span className="orbit-icon">
                          <Icon.bigLock />
                        </span>
                      </div>

                      <h3 style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.02em", marginBottom: "6px" }}>
                        <span className="gradient-text">Authenticating Identity</span>
                      </h3>
                      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
                        Generating cryptographic assertion for watsonx Orchestrate...
                      </p>
                    </div>

                    {/* Live hex telemetry ribbon */}
                    <div className="hex-stream" style={{ marginBottom: "14px" }}>
                      <div className="hex-stream-inner">
                        <span>{HEX_TICKER}</span>
                        <span>{HEX_TICKER}</span>
                      </div>
                    </div>

                    {/* Progress readout — eases between the discrete stages */}
                    <ProgressMeter progress={authProgress} />

                    {/* Multi-Step Checklist */}
                    <div className="step-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div className="rail-track">
                        <div
                          className="rail-fill"
                          style={{ height: `${(authStep / (AUTH_STEPS.length - 1)) * 100}%` }}
                        />
                      </div>

                      {AUTH_STEPS.map((step, idx) => {
                        const isComplete = authStep > idx;
                        const isCurrent = authStep === idx;
                        const state = isComplete ? "done" : isCurrent ? "current" : "pending";
                        return (
                          <div
                            key={idx}
                            className={`step-row ${state} ${isCurrent || isComplete ? "animate-step-in" : ""}`}
                          >
                            <div className={`step-dot ${state}`}>
                              {isComplete ? (
                                <span className="check-badge" style={{ display: "flex" }}>
                                  <Icon.check />
                                </span>
                              ) : isCurrent ? (
                                <span
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    background: "#fff",
                                  }}
                                />
                              ) : (
                                idx + 1
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  letterSpacing: "-0.01em",
                                  color: isComplete || isCurrent ? "var(--text-main)" : "var(--text-dim)",
                                }}
                              >
                                {step.title}
                              </div>
                              <div
                                style={{
                                  fontSize: "10.5px",
                                  marginTop: "1px",
                                  color: isCurrent ? "var(--indigo-300)" : "var(--text-dim)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {step.subtitle}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ------------------------------------------------------------- */
                  /* STATE B: STANDARD LOGIN FORM                                  */
                  /* ------------------------------------------------------------- */
                  <div className="stagger">
                    {/* Brand lockup */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px" }}>
                      <div style={{ position: "relative" }}>
                        <div className="brand-ring" />
                        <div className="brand-mark">
                          <span style={{ position: "relative", zIndex: 1, color: "#fff", display: "flex" }}>
                            <Icon.bolt />
                          </span>
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="brand-title">
                          <ScrambleText className="gradient-text" text="TechXchange HR Assistant" delay={260} />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            marginTop: "4px",
                          }}
                        >
                          <span className="status-dot" />
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 500 }}>
                            Secure session ready
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="divider-glow" style={{ marginBottom: "20px" }} />

                    {/* 1-CLICK ROLE PRESET CARDS */}
                    <div style={{ marginBottom: "18px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "9px",
                        }}
                      >
                        <span className="eyebrow">Identity Presets</span>
                        <span style={{ fontSize: "10.5px", color: "var(--text-faint)" }}>
                          one-click fill
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px" }}>
                        {/* Manager Option */}
                        <button
                          type="button"
                          onClick={() => selectPreset("manager")}
                          className={`role-card ${selectedRole === "manager" ? "active" : ""}`}
                        >
                          <span className="rail" />
                          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "9px" }}>
                            <span
                              className="role-icon"
                              style={{
                                background: "rgba(99, 102, 241, 0.18)",
                                color: "var(--indigo-400)",
                                boxShadow: selectedRole === "manager" ? "0 0 14px rgba(99,102,241,0.5)" : "none",
                              }}
                            >
                              <Icon.crown />
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                              Manager
                            </span>
                            {selectedRole === "manager" && (
                              <span
                                className="check-badge"
                                style={{ marginLeft: "auto", display: "flex", color: "var(--indigo-300)" }}
                              >
                                <Icon.check />
                              </span>
                            )}
                          </div>
                          <div className="code-pill">is_manager: true</div>
                          <div className="mono" style={{ fontSize: "9.5px", color: "var(--text-faint)", marginTop: "6px" }}>
                            manager@123
                          </div>
                        </button>

                        {/* General Option */}
                        <button
                          type="button"
                          onClick={() => selectPreset("general")}
                          className={`role-card emerald ${selectedRole === "general" ? "active" : ""}`}
                        >
                          <span className="rail" />
                          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "9px" }}>
                            <span
                              className="role-icon"
                              style={{
                                background: "rgba(16, 185, 129, 0.16)",
                                color: "var(--emerald-400)",
                                boxShadow: selectedRole === "general" ? "0 0 14px rgba(16,185,129,0.45)" : "none",
                              }}
                            >
                              <Icon.badge />
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                              General
                            </span>
                            {selectedRole === "general" && (
                              <span
                                className="check-badge"
                                style={{ marginLeft: "auto", display: "flex", color: "var(--emerald-400)" }}
                              >
                                <Icon.check />
                              </span>
                            )}
                          </div>
                          <div className="code-pill emerald">is_manager: false</div>
                          <div className="mono" style={{ fontSize: "9.5px", color: "var(--text-faint)", marginTop: "6px" }}>
                            general@123
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                      <div className="alert-error animate-shake" style={{ marginBottom: "16px" }}>
                        <span style={{ display: "flex", flexShrink: 0 }}>
                          <Icon.alert />
                        </span>
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin}>
                      {/* Username Input */}
                      <div className="field-group" style={{ marginBottom: "14px" }}>
                        <label className="field-label" htmlFor="wxo-username">
                          Username
                        </label>
                        <div className="field">
                          <input
                            id="wxo-username"
                            type="text"
                            className="glass-input"
                            placeholder="Manager or General"
                            autoComplete="username"
                            value={username}
                            onChange={(e) => {
                              setUsername(e.target.value);
                              setSelectedRole(null);
                            }}
                            required
                            style={{ padding: "12px 14px 12px 40px" }}
                          />
                          <span className="field-icon">
                            <Icon.user />
                          </span>
                          <span className="field-underline" />
                        </div>
                      </div>

                      {/* Password Input */}
                      <div className="field-group" style={{ marginBottom: "22px" }}>
                        <label className="field-label" htmlFor="wxo-password">
                          Password
                        </label>
                        <div className="field">
                          <input
                            id="wxo-password"
                            type={showPassword ? "text" : "password"}
                            className="glass-input"
                            placeholder="Enter password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setSelectedRole(null);
                            }}
                            required
                            style={{ padding: "12px 44px 12px 40px" }}
                          />
                          <span className="field-icon">
                            <Icon.lock />
                          </span>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <Icon.eyeOff /> : <Icon.eye />}
                          </button>
                          <span className="field-underline" />
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        ref={submitRef}
                        type="submit"
                        className="btn-primary"
                        onPointerDown={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          const id = Date.now() + Math.random();
                          setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
                          setTimeout(() => setRipples((rs) => rs.filter((v) => v.id !== id)), 800);
                        }}
                        onPointerLeave={(e) => {
                          e.currentTarget.style.setProperty("--bx", "0px");
                          e.currentTarget.style.setProperty("--by", "0px");
                        }}
                        style={{
                          width: "100%",
                          padding: "14px 20px",
                          borderRadius: "12px",
                          fontSize: "14.5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "9px",
                        }}
                      >
                        {ripples.map((r) => (
                          <span key={r.id} className="btn-ripple" style={{ left: r.x, top: r.y }} />
                        ))}
                        <span style={{ position: "relative", zIndex: 1 }}>Sign In to Assistant</span>
                        <span className="btn-arrow" style={{ display: "flex", position: "relative", zIndex: 1 }}>
                          <Icon.arrow />
                        </span>
                      </button>
                    </form>

                    {/* Security Footer */}
                    <div
                      style={{
                        marginTop: "20px",
                        paddingTop: "15px",
                        borderTop: "1px solid var(--border-glass)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        color: "var(--text-dim)",
                      }}
                    >
                      <span style={{ display: "flex", color: "var(--emerald-400)" }}>
                        <Icon.shield />
                      </span>
                      <span style={{ fontSize: "10.5px", letterSpacing: "0.2px", fontWeight: 500 }}>
                        FastMCP Token Protected · Encrypted RSA Payload
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* ================================================================= */
        /* 2. AUTHENTICATED ORCHESTRATE CHAT VIEW                            */
        /* ================================================================= */
        <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Top Navbar */}
          <header className="app-header">
            {/* Left: Brand + Agent Status */}
            <div className="header-brand">
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  className="brand-mark"
                  style={{ width: "38px", height: "38px", borderRadius: "11px" }}
                >
                  <span style={{ position: "relative", zIndex: 1, color: "#fff", display: "flex" }}>
                    <Icon.bolt width="17" height="17" />
                  </span>
                </div>
              </div>

              <div className="header-brand-text">
                <div className="brand-title-sm">
                  <span className="gradient-text">TechXchange HR Assistant</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <span className="status-dot" />
                  <span style={{ fontSize: "10.5px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    watsonx Orchestrate Connected
                  </span>
                </div>
              </div>
            </div>

            {/* Right: User Profile Chip & Logout */}
            <div className="header-actions">
              {/* User Chip */}
              <div className="user-chip">
                {/* Avatar Initial */}
                <div
                  className="avatar"
                  style={{
                    background: isManager
                      ? "linear-gradient(140deg, #6366F1, #A855F7)"
                      : "linear-gradient(140deg, #10B981, #22D3EE)",
                    color: isManager ? "#A5B4FC" : "#6EE7B7",
                    boxShadow: isManager
                      ? "0 4px 14px -3px rgba(99, 102, 241, 0.65)"
                      : "0 4px 14px -3px rgba(16, 185, 129, 0.6)",
                  }}
                >
                  <span style={{ color: "#fff" }}>
                    {userInfo?.name ? userInfo.name.charAt(0) : "U"}
                  </span>
                </div>

                <span
                  className="user-name"
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userInfo?.name}
                </span>

                {/* Role Pill */}
                <span
                  className="chip"
                  style={{
                    background: isManager ? "rgba(99, 102, 241, 0.2)" : "rgba(16, 185, 129, 0.16)",
                    border: isManager
                      ? "1px solid rgba(129, 140, 248, 0.45)"
                      : "1px solid rgba(52, 211, 153, 0.38)",
                    color: isManager ? "#C7D2FE" : "#A7F3D0",
                  }}
                >
                  <span style={{ display: "flex" }}>
                    {isManager ? <Icon.crown width="12" height="12" /> : <Icon.badge width="12" height="12" />}
                  </span>
                  <span className="mono">
                    {isManager ? "is_manager: true" : "is_manager: false"}
                  </span>
                </span>
              </div>

              {/* Sign Out Button */}
              <button onClick={handleLogout} className="btn-ghost" aria-label="Sign out" title="Sign out">
                <Icon.logout />
                <span className="btn-label">Sign out</span>
              </button>
            </div>
          </header>

          {/* Quiet session context — the chat panel is the focus here */}
          <div className="workspace">
            <div className="workspace-inner">
              <h1 className="ws-greeting">
                Welcome back, <span className="gradient-text">{userInfo?.name}</span>
              </h1>
              <p className="ws-meta">
                <span>{userInfo?.email}</span>
                <span className="ws-dot" />
                <span className="mono">is_manager: {isManager ? "true" : "false"}</span>
              </p>
            </div>
          </div>

          {/* Watsonx Orchestrate Chat Root Viewport */}
          <div
            style={{
              flex: 1,
              width: "100%",
              height: "calc(100vh - 64px)",
              position: "relative",
            }}
          >
            <div id="root" style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      )}
    </div>
  );
}
