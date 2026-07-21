"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type AuthMode = "choice" | "login" | "signup" | "verify";

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordStrength = password.length < 6 ? 0 : password.length < 10 ? 50 : 100;

  async function handleLogin() {
    setMessage("");
    setInfoMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Better error for unverified email
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("confirmation") || msg.includes("verified")) {
          setMessage("Please verify your email first. Check your inbox for the verification link we sent to " + email);
          return;
        }
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          setMessage("Invalid email or password. If you just signed up, please verify your email first.");
          return;
        }
        setMessage(error.message);
        return;
      }

      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setMessage("");
    setInfoMessage("");
    setLoading(true);

    try {
      if (!email || !password) {
        setMessage("Please enter email and password");
        return;
      }
      if (password.length < 6) {
        setMessage("Password must be at least 6 characters");
        return;
      }

      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://source-sense.vercel.app",
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      // Even if user already exists, Supabase may return success but no session
      // So always go to verification page
      setMode("verify");
      setInfoMessage("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setMessage("");
    setInfoMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: "https://source-sense.vercel.app",
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setInfoMessage(`Verification email resent to ${email}. Please check your inbox and spam folder.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={cardStyle}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
          <Logo variant="full" tone="dark" />
        </div>

        <AnimatePresence mode="wait">
          {mode === "choice" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button onClick={() => setMode("login")} disabled={loading}>
                Sign In
              </Button>
              <Button variant="secondary" onClick={() => setMode("signup")} disabled={loading}>
                Create Account
              </Button>
              <p style={{textAlign: "center", color: "#777", fontSize: "12px", marginTop: "10px"}}>
                Secure auth via Supabase
              </p>
            </motion.div>
          )}

          {(mode === "login" || mode === "signup") && (
            <motion.div
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 style={{margin: "0 0 20px", fontSize: "18px", fontWeight: 600}}>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <Input type="email" placeholder="Email" value={email} onChange={setEmail} />
              <Input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={setPassword}
              />

              {mode === "signup" && password && (
                <div style={{ marginBottom: "15px" }}>
                  <div style={strengthBarContainer}>
                    <motion.div
                      animate={{ width: `${passwordStrength}%` }}
                      style={{
                        ...strengthBar,
                        backgroundColor:
                          passwordStrength < 50
                            ? "#ff5c5c"
                            : passwordStrength < 100
                              ? "#facc15"
                              : "#40ace9",
                      }}
                    />
                  </div>
                  <p style={{fontSize: "11px", color: "#888", marginTop: "6px"}}>
                    {passwordStrength < 50 ? "Weak password" : passwordStrength < 100 ? "Medium" : "Strong"} - Use 10+ chars for best security
                  </p>
                </div>
              )}

              <Button onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading}>
                {loading ? <Spinner /> : mode === "login" ? "Sign In" : "Create Account"}
              </Button>

              <p style={backLink} onClick={() => setMode("choice")}>
                Back
              </p>
              {mode === "login" && (
                <p style={{textAlign: "center", color: "#666", fontSize: "11px", marginTop: "12px"}}>
                  Forgot password? Contact support. Email verification required before first login.
                </p>
              )}
            </motion.div>
          )}

          {mode === "verify" && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div style={{textAlign: "center", marginBottom: "10px"}}>
                <div style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "rgba(64,172,233,0.15)",
                  border: "1px solid rgba(64,172,233,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  fontSize: "32px"
                }}>
                  ✉️
                </div>
                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>Check your email</h2>
                <p style={{ margin: "0 auto 16px", color: "#bbb", fontSize: "14px", lineHeight: "1.5", maxWidth: "300px" }}>
                  We've sent a verification link to:
                </p>
                <p style={{
                  margin: "0 auto 20px",
                  background: "#2f3037",
                  border: "1px solid #3a3b42",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#40ace9",
                  fontSize: "14px",
                  fontWeight: 600,
                  wordBreak: "break-all",
                  display: "inline-block",
                  maxWidth: "100%"
                }}>
                  {email}
                </p>
              </div>

              <div style={{
                background: "#2a2b32",
                border: "1px solid #3a3b42",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "20px"
              }}>
                <p style={{margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#ddd"}}>Next steps:</p>
                <ol style={{margin: 0, paddingLeft: "18px", color: "#aaa", fontSize: "13px", lineHeight: "1.6"}}>
                  <li>Open your inbox (and check spam folder)</li>
                  <li>Click the verification link from SourceSense</li>
                  <li>Come back here and sign in</li>
                </ol>
                <p style={{margin: "10px 0 0", fontSize: "11px", color: "#777"}}>
                  Link expires in 1 hour. If you don't see it, click Resend below.
                </p>
              </div>

              <Button onClick={() => setMode("login")} disabled={loading}>
                Continue to Log In
              </Button>

              <Button variant="secondary" onClick={handleResend} disabled={loading}>
                {loading ? <Spinner /> : "Resend verification email"}
              </Button>

              <div style={{display: "flex", justifyContent: "center", gap: "12px", marginTop: "6px"}}>
                <span style={{...backLink, marginTop: 0}} onClick={() => setMode("signup")}>
                  Use different email
                </span>
                <span style={{color: "#444"}}>•</span>
                <span style={{...backLink, marginTop: 0}} onClick={() => setMode("choice")}>
                  Back home
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {message && <p style={messageStyle}>{message}</p>}
        {infoMessage && <p style={infoStyle}>{infoMessage}</p>}
      </motion.div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false }: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: "45px",
        padding: "12px",
        borderRadius: "10px",
        border: variant === "secondary" ? "1px solid #40ace9" : "none",
        backgroundColor: variant === "secondary" ? "transparent" : "#40ace9",
        color: variant === "secondary" ? "#40ace9" : "white",
        marginBottom: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}

function Input({ value, onChange, ...props }: InputProps) {
  return (
    <input
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width: "100%",
        padding: "12px",
        marginBottom: "12px",
        borderRadius: "10px",
        border: "1px solid #3a3b42",
        backgroundColor: "#2f3037",
        color: "white",
        boxSizing: "border-box",
        outline: "none",
      }}
    />
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      style={{
        width: 20,
        height: 20,
        border: "3px solid rgba(255,255,255,0.3)",
        borderTop: "3px solid white",
        borderRadius: "50%",
        margin: "0 auto",
      }}
    />
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#2f3037",
  color: "white",
  fontFamily: "Arial, sans-serif",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  padding: "32px",
  backgroundColor: "#202123",
  borderRadius: "16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
  border: "1px solid #2f3037",
};

const backLink: CSSProperties = {
  textAlign: "center",
  cursor: "pointer",
  color: "#40ace9",
  fontSize: "13px",
  marginTop: "4px",
};

const messageStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#ffb020",
  textAlign: "center",
  background: "rgba(255,176,32,0.1)",
  border: "1px solid rgba(255,176,32,0.2)",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px",
  lineHeight: "1.4",
};

const infoStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#40ace9",
  textAlign: "center",
  background: "rgba(64,172,233,0.1)",
  border: "1px solid rgba(64,172,233,0.2)",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px",
  lineHeight: "1.4",
};

const strengthBarContainer: CSSProperties = {
  height: "6px",
  backgroundColor: "#3a3b42",
  borderRadius: "6px",
  overflow: "hidden",
};

const strengthBar: CSSProperties = {
  height: "100%",
};
