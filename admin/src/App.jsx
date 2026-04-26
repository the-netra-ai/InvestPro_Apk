import React, { useState } from "react";
import AdminDashboard from "./pages/AdminDashboard";
import { req } from "./api";
import brandLogo from "./assets/logo.png";

function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = async () => {
    try {
      setError("");
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedPassword = String(password || "");
      const data = await req("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword })
      });
      const resolvedRole = String(data?.data?.role || data?.data?.user?.role || data?.role || data?.user?.role || "").toLowerCase().trim();
      if (resolvedRole && resolvedRole !== "admin") throw new Error("Admin account required");
      onDone();
    } catch (e) {
      setError(e.message || "Login failed");
    }
  };

  return (
    <div className="app-shell center-screen login-bg">
      <div className="login-panel">
        <div className="brand-row">
          <span className="brand-logo" aria-hidden="true">
            <img src={brandLogo} alt="" className="brand-logo-img" />
          </span>
          <div className="brand">
            <span className="brand-invest">INVEST</span>
            <span className="brand-pro">PRO</span>
          </div>
        </div>

        <label className="field-label" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="input"
          placeholder=""
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="field-label" htmlFor="admin-password">Password</label>
        <div className="password-wrap">
          <input
            id="admin-password"
            className="input input-password"
            placeholder=""
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="eye-btn"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="eye-icon">
                <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M10.7 10.9A3 3 0 0 0 13.1 13.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9.9 5.1A10.6 10.6 0 0 1 12 4.9C17.2 4.9 21 12 21 12A18.2 18.2 0 0 1 17.3 16.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M14.2 18.5A10.8 10.8 0 0 1 12 19.1C6.8 19.1 3 12 3 12A18 18 0 0 1 6.2 7.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="eye-icon">
                <path d="M2 12S5.8 5 12 5s10 7 10 7-3.8 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="btn btn-main" onClick={submit}>Start Investing</button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(false);
  const handleLogout = async () => {
    try {
      await req("/api/logout", { method: "POST" });
    } finally {
      setAuth(false);
    }
  };

  return auth ? <AdminDashboard onLogout={handleLogout} /> : <Login onDone={() => setAuth(true)} />;
}
