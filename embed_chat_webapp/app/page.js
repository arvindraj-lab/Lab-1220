"use client";

import { useState, useEffect } from "react";
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

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Ambient Moving Light Orbs */}
      <div
        className="animate-orb-1"
        style={{
          position: "fixed",
          top: "-15%",
          left: "-10%",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.06) 50%, transparent 70%)",
          filter: "blur(75px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        className="animate-orb-2"
        style={{
          position: "fixed",
          bottom: "-20%",
          right: "-10%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.16) 0%, rgba(34, 211, 238, 0.05) 50%, transparent 70%)",
          filter: "blur(95px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        className="animate-orb-3"
        style={{
          position: "fixed",
          top: "40%",
          left: "35%",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34, 211, 238, 0.09) 0%, transparent 65%)",
          filter: "blur(85px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* High-Tech Grid Pattern */}
      <div
        className="grid-bg"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          opacity: 0.65,
          zIndex: 0,
        }}
      />

      {/* ================================================================= */}
      {/* 1. LOGIN SCREEN                                                  */}
      {/* ================================================================= */}
      {!isAuthenticated ? (
        <main
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
          }}
        >
          <div
            className="animate-fade-in-up"
            style={{
              width: "100%",
              maxWidth: "1060px",
              display: "grid",
              gridTemplateColumns: "1.15fr 1fr",
              gap: "52px",
              alignItems: "center",
            }}
          >
            {/* LEFT COLUMN: HERO PLATFORM MATRIX */}
            <div style={{ paddingRight: "12px" }}>
              {/* Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 16px",
                  borderRadius: "30px",
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.28)",
                  marginBottom: "26px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#22D3EE",
                    boxShadow: "0 0 12px #22D3EE",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#A5B4FC",
                    letterSpacing: "0.4px",
                  }}
                >
                  watsonx Orchestrate × FastMCP 2.0
                </span>
              </div>

              {/* Headline */}
              <h1
                style={{
                  fontSize: "46px",
                  fontWeight: "800",
                  lineHeight: "1.14",
                  letterSpacing: "-0.025em",
                  marginBottom: "18px",
                  background: "linear-gradient(135deg, #FFFFFF 30%, #E2E8F0 70%, #94A3B8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Enterprise AI <br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #818CF8 0%, #C084FC 50%, #38BDF8 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  HR Agentic Platform
                </span>
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: "16px",
                  lineHeight: "1.65",
                  color: "#94A3B8",
                  marginBottom: "34px",
                  maxWidth: "480px",
                }}
              >
                Zero-trust workforce intelligence engine. Executes multi-agent delegation with
                automatic on-behalf-of identity assertions and secure FastMCP tool authorization.
              </p>

              {/* Architecture Feature Highlights */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.025)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(99, 102, 241, 0.16)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#818CF8",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    👑
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#F1F5F9" }}>
                      Role-Based Supervisor Routing
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px", lineHeight: "1.4" }}>
                      <code style={{ color: "#818CF8", background: "rgba(99, 102, 241, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>is_manager: true</code> routes to Manager Agent for employee salary and team analytics.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.025)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(34, 211, 238, 0.16)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#22D3EE",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    🛡️
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#F1F5F9" }}>
                      Asymmetric RSA-2048 & FastMCP Guard
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px", lineHeight: "1.4" }}>
                      Payload encrypted with IBM Public Key, signed via RS256, and validated across 5 secured MCP tools.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LOGIN CARD OR CINEMATIC AUTH PROGRESS */}
            <div
              className="glass-panel"
              style={{
                borderRadius: "26px",
                padding: "38px 34px",
                position: "relative",
                minHeight: "510px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* ------------------------------------------------------------- */}
              {/* STATE A: MULTI-STAGE CINEMATIC LOADING OVERLAY               */}
              {/* ------------------------------------------------------------- */}
              {isAuthenticating ? (
                <div className="animate-scale-in" style={{ padding: "10px 6px" }}>
                  <div style={{ textAlign: "center", marginBottom: "26px" }}>
                    {/* Glowing Progress Spinner */}
                    <div
                      style={{
                        width: "68px",
                        height: "68px",
                        margin: "0 auto 18px auto",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          border: "3px solid rgba(99, 102, 241, 0.2)",
                          borderTopColor: "#6366F1",
                          borderRightColor: "#22D3EE",
                          animation: "ringRotate 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite",
                        }}
                      />
                      <span style={{ fontSize: "24px" }}>🔐</span>
                    </div>

                    <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#FFFFFF", marginBottom: "6px" }}>
                      Authenticating Identity
                    </h3>
                    <p style={{ fontSize: "13px", color: "#94A3B8" }}>
                      Generating cryptographic assertion for watsonx Orchestrate...
                    </p>
                  </div>

                  {/* Progress Bar with Shimmer */}
                  <div
                    style={{
                      height: "6px",
                      width: "100%",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.08)",
                      overflow: "hidden",
                      marginBottom: "28px",
                    }}
                  >
                    <div
                      className="progress-bar-shimmer"
                      style={{
                        height: "100%",
                        width: `${authProgress}%`,
                        transition: "width 0.35s ease-in-out",
                        borderRadius: "6px",
                      }}
                    />
                  </div>

                  {/* Multi-Step Checklist */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {AUTH_STEPS.map((step, idx) => {
                      const isComplete = authStep > idx;
                      const isCurrent = authStep === idx;
                      return (
                        <div
                          key={idx}
                          className={isCurrent || isComplete ? "animate-step-in" : ""}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            background: isCurrent
                              ? "rgba(99, 102, 241, 0.12)"
                              : isComplete
                              ? "rgba(16, 185, 129, 0.08)"
                              : "transparent",
                            border: isCurrent
                              ? "1px solid rgba(99, 102, 241, 0.35)"
                              : isComplete
                              ? "1px solid rgba(16, 185, 129, 0.25)"
                              : "1px solid transparent",
                            transition: "all 0.25s ease",
                          }}
                        >
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: isComplete
                                ? "#10B981"
                                : isCurrent
                                ? "#6366F1"
                                : "rgba(255, 255, 255, 0.1)",
                              color: "#FFFFFF",
                              boxShadow: isComplete
                                ? "0 0 10px rgba(16, 185, 129, 0.4)"
                                : isCurrent
                                ? "0 0 10px rgba(99, 102, 241, 0.4)"
                                : "none",
                              flexShrink: 0,
                            }}
                          >
                            {isComplete ? "✓" : isCurrent ? "●" : idx + 1}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "600",
                                color: isComplete || isCurrent ? "#F8FAFC" : "#64748B",
                              }}
                            >
                              {step.title}
                            </div>
                            <div style={{ fontSize: "11px", color: isCurrent ? "#A5B4FC" : "#64748B" }}>
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
                <div>
                  {/* Card Header */}
                  <div style={{ marginBottom: "24px" }}>
                    <h2
                      style={{
                        fontSize: "23px",
                        fontWeight: "700",
                        color: "#FFFFFF",
                        letterSpacing: "-0.015em",
                      }}
                    >
                      Sign In to Assistant
                    </h2>
                    <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
                      Select a role preset below or enter credentials manually
                    </p>
                  </div>

                  {/* 1-CLICK ROLE PRESET CARDS */}
                  <div style={{ marginBottom: "22px" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        color: "#64748B",
                        marginBottom: "10px",
                      }}
                    >
                      Identity Presets
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Manager Option */}
                      <div
                        onClick={() => selectPreset("manager")}
                        className={`role-card ${selectedRole === "manager" ? "active" : ""}`}
                        style={{ padding: "14px 14px", position: "relative" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#F8FAFC" }}>
                            👑 Manager
                          </span>
                          {selectedRole === "manager" && (
                            <span style={{ fontSize: "12px", color: "#818CF8", fontWeight: "700" }}>✓</span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#818CF8", fontWeight: "600", marginTop: "4px" }}>
                          is_manager: true
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                          Pass: manager@123
                        </div>
                      </div>

                      {/* General Option */}
                      <div
                        onClick={() => selectPreset("general")}
                        className={`role-card ${selectedRole === "general" ? "active" : ""}`}
                        style={{ padding: "14px 14px", position: "relative" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#F8FAFC" }}>
                            👤 General
                          </span>
                          {selectedRole === "general" && (
                            <span style={{ fontSize: "12px", color: "#34D399", fontWeight: "700" }}>✓</span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#34D399", fontWeight: "600", marginTop: "4px" }}>
                          is_manager: false
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                          Pass: general@123
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "11px 14px",
                        borderRadius: "10px",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#FCA5A5",
                        fontSize: "13px",
                        marginBottom: "18px",
                      }}
                    >
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleLogin}>
                    {/* Username Input */}
                    <div style={{ marginBottom: "16px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#CBD5E1",
                          marginBottom: "6px",
                          letterSpacing: "0.2px",
                        }}
                      >
                        Username
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          className="glass-input"
                          placeholder="Manager or General"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setSelectedRole(null);
                          }}
                          required
                          style={{
                            width: "100%",
                            padding: "12px 14px 12px 38px",
                            borderRadius: "10px",
                            fontSize: "14px",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#64748B",
                            fontSize: "15px",
                          }}
                        >
                          👤
                        </span>
                      </div>
                    </div>

                    {/* Password Input */}
                    <div style={{ marginBottom: "24px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#CBD5E1",
                          marginBottom: "6px",
                          letterSpacing: "0.2px",
                        }}
                      >
                        Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          className="glass-input"
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setSelectedRole(null);
                          }}
                          required
                          style={{
                            width: "100%",
                            padding: "12px 42px 12px 38px",
                            borderRadius: "10px",
                            fontSize: "14px",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#64748B",
                            fontSize: "15px",
                          }}
                        >
                          🔒
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            color: "#94A3B8",
                            cursor: "pointer",
                            fontSize: "14px",
                            padding: 0,
                          }}
                        >
                          {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{
                        width: "100%",
                        padding: "14px 20px",
                        borderRadius: "12px",
                        fontSize: "15px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <span>Sign In to Assistant</span>
                      <span style={{ fontSize: "16px" }}>&rarr;</span>
                    </button>
                  </form>

                  {/* Security Footer */}
                  <div
                    style={{
                      marginTop: "24px",
                      paddingTop: "16px",
                      borderTop: "1px solid var(--border-glass)",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      🔐 FastMCP Token Protected • Encrypted RSA Payload
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* ================================================================= */
        /* 2. AUTHENTICATED ORCHESTRATE CHAT VIEW                            */
        /* ================================================================= */
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Top Navbar */}
          <header
            style={{
              height: "64px",
              padding: "0 28px",
              background: "rgba(13, 18, 30, 0.88)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              position: "sticky",
              top: 0,
              zIndex: 9999,
            }}
          >
            {/* Left: Brand + Agent Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "800",
                  fontSize: "16px",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.45)",
                }}
              >
                TX
              </div>

              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                  TechXchange HR Assistant
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "1px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#34D399",
                      boxShadow: "0 0 8px #34D399",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                    watsonx Orchestrate Connected
                  </span>
                </div>
              </div>
            </div>

            {/* Right: User Profile Chip & Logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {/* User Chip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 14px",
                  borderRadius: "30px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {/* Avatar Initial */}
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: userInfo?.is_manager
                      ? "linear-gradient(135deg, #6366F1, #818CF8)"
                      : "linear-gradient(135deg, #10B981, #34D399)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  {userInfo?.name ? userInfo.name.charAt(0) : "U"}
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#F1F5F9" }}>
                    {userInfo?.name}
                  </span>
                </div>

                {/* Role Pill */}
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "700",
                    background: userInfo?.is_manager
                      ? "rgba(99, 102, 241, 0.22)"
                      : "rgba(16, 185, 129, 0.18)",
                    border: userInfo?.is_manager
                      ? "1px solid rgba(99, 102, 241, 0.45)"
                      : "1px solid rgba(16, 185, 129, 0.35)",
                    color: userInfo?.is_manager ? "#C7D2FE" : "#A7F3D0",
                  }}
                >
                  {userInfo?.is_manager ? "👑 Manager (is_manager: true)" : "👤 General (is_manager: false)"}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#E2E8F0",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                  e.currentTarget.style.color = "#FCA5A5";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                  e.currentTarget.style.color = "#E2E8F0";
                }}
              >
                Sign out
              </button>
            </div>
          </header>

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
