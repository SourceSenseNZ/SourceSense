"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type AuthMode = "choice" | "login" | "signup" | "verify" | "forgot" | "forgot-sent" | "update";

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

function AuthContent() {
  const [mode, setMode] = useState<AuthMode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const passwordStrength = password.length < 6 ? 0 : password.length < 10 ? 50 : 100;

  useEffect(() => {
    const hasRecoveryParam = searchParams.get("type") === "recovery" || (typeof window !== "undefined" && window.location.hash.includes("type=recovery"));
    if (hasRecoveryParam) {
      setMode("update");
      setInfoMessage("You are in password recovery mode. Set a new password below.");
    }
    if (searchParams.get("mode") === "reset") {
      setMode("update");
    }
  }, [searchParams]);

  async function handleLogin() {
    setMessage(""); setInfoMessage(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("confirmation") || msg.includes("verified")) {
          setMessage(`Please verify your email first. Check inbox for link we sent to ${email}`);
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
    } finally { setLoading(false); }
  }

  async function handleSignup() {
    setMessage(""); setInfoMessage(""); setLoading(true);
    try {
      if (!email || !password) { setMessage("Please enter email and password"); return; }
      if (password.length < 6) { setMessage("Password must be at least 6 characters"); return; }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: "https://source-sense.vercel.app" },
      });
      if (error) { setMessage(error.message); return; }
      setMode("verify");
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setMessage(""); setInfoMessage(""); setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email,
        options: { emailRedirectTo: "https://source-sense.vercel.app" },
      });
      if (error) { setMessage(error.message); return; }
      setInfoMessage(`Verification email resent to ${email}. Check inbox and spam.`);
    } finally { setLoading(false); }
  }

  async function handleForgot() {
    setMessage(""); setInfoMessage(""); setLoading(true);
    try {
      if (!email) { setMessage("Enter your email first"); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://source-sense.vercel.app/login?mode=reset",
      });
      if (error) { setMessage(error.message); return; }
      setMode("forgot-sent");
    } finally { setLoading(false); }
  }

  async function handleUpdatePassword() {
    setMessage(""); setInfoMessage(""); setLoading(true);
    try {
      if (!newPassword || newPassword.length < 6) { setMessage("New password must be at least 6 chars"); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setMessage(error.message); return; }
      setInfoMessage("Password updated! You can now sign in with new password.");
      setMode("login");
      setNewPassword("");
      setPassword("");
    } finally { setLoading(false); }
  }

  return (
    <div style={pageStyle}>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
          <Logo variant="full" tone="dark" />
        </div>

        <AnimatePresence mode="wait">
          {mode === "choice" && (
            <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button onClick={() => setMode("login")} disabled={loading}>Sign In</Button>
              <Button variant="secondary" onClick={() => setMode("signup")} disabled={loading}>Create Account</Button>
              <p style={smallCenter}>Secure auth via Supabase • Verification required</p>
            </motion.div>
          )}

          {(mode === "login" || mode === "signup") && (
            <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={h2Style}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <Input type="email" placeholder="Email" value={email} onChange={setEmail} />
              <Input type="password" placeholder={mode === "login" ? "Password" : "Password (min 6 chars)"} value={password} onChange={setPassword} />

              {mode === "signup" && password && (
                <div style={{ marginBottom: "15px" }}>
                  <div style={strengthBarContainer}>
                    <motion.div animate={{ width: `${passwordStrength}%` }}
                      style={{ ...strengthBar, backgroundColor: passwordStrength < 50 ? "#ff5c5c" : passwordStrength < 100 ? "#facc15" : "#40ace9" }} />
                  </div>
                  <p style={{fontSize: "11px", color: "#888", marginTop: "6px"}}>
                    {passwordStrength < 50 ? "Weak" : passwordStrength < 100 ? "Medium" : "Strong"} — 10+ chars recommended
                  </p>
                </div>
              )}

              <Button onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading}>
                {loading ? <Spinner /> : mode === "login" ? "Sign In" : "Create Account"}
              </Button>

              {mode === "login" && (
                <p style={linkSmall} onClick={() => setMode("forgot")}>Forgot password?</p>
              )}

              <p style={backLink} onClick={() => setMode("choice")}>Back</p>
            </motion.div>
          )}

          {mode === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{textAlign: "center", marginBottom: "10px"}}>
                <div style={iconCircle}>✉️</div>
                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>Check your email</h2>
                <p style={subText}>We've sent a verification link to:</p>
                <p style={emailBadge}>{email}</p>
              </div>
              <div style={infoBox}>
                <p style={infoBoxTitle}>Next steps:</p>
                <ol style={olStyle}>
                  <li>Open inbox (check spam)</li>
                  <li>Click verification link</li>
                  <li>Come back and sign in</li>
                </ol>
                <p style={tinyNote}>Link expires in 1 hour. Didn't get it? Resend below.</p>
              </div>
              <Button onClick={() => setMode("login")} disabled={loading}>Continue to Log In</Button>
              <Button variant="secondary" onClick={handleResend} disabled={loading}>
                {loading ? <Spinner /> : "Resend verification email"}
              </Button>
              <div style={dualLinks}>
                <span style={backLink} onClick={() => setMode("signup")}>Use different email</span>
                <span style={{color: "#444"}}>•</span>
                <span style={backLink} onClick={() => setMode("choice")}>Back home</span>
              </div>
            </motion.div>
          )}

          {mode === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={h2Style}>Reset password</h2>
              <p style={{color: "#aaa", fontSize: "13px", marginBottom: "16px", lineHeight: "1.5"}}>
                Enter your email and we'll send you a reset link.
              </p>
              <Input type="email" placeholder="Your email" value={email} onChange={setEmail} />
              <Button onClick={handleForgot} disabled={loading}>
                {loading ? <Spinner /> : "Send reset link"}
              </Button>
              <p style={backLink} onClick={() => setMode("login")}>Back to login</p>
            </motion.div>
          )}

          {mode === "forgot-sent" && (
            <motion.div key="forgot-sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{textAlign: "center"}}>
                <div style={iconCircle}>🔑</div>
                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>Check your email</h2>
                <p style={subText}>Password reset link sent to:</p>
                <p style={emailBadge}>{email}</p>
              </div>
              <div style={infoBox}>
                <p style={{margin: 0, color: "#aaa", fontSize: "13px", lineHeight: "1.6"}}>
                  Click the link in your email to set a new password. Link expires in 1 hour. Check spam folder.
                </p>
              </div>
              <Button onClick={() => setMode("login")}>Back to login</Button>
              <Button variant="secondary" onClick={() => setMode("forgot")}>Use different email</Button>
            </motion.div>
          )}

          {mode === "update" && (
            <motion.div key="update" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={h2Style}>Set new password</h2>
              <p style={{color: "#aaa", fontSize: "13px", marginBottom: "16px"}}>
                You clicked a reset link. Enter new password.
              </p>
              <Input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={setNewPassword} />
              <Button onClick={handleUpdatePassword} disabled={loading}>
                {loading ? <Spinner /> : "Update password"}
              </Button>
              <p style={backLink} onClick={() => setMode("login")}>Back to login</p>
            </motion.div>
          )}
        </AnimatePresence>

        {message && <p style={messageStyle}>{message}</p>}
        {infoMessage && <p style={infoStyle}>{infoMessage}</p>}
      </motion.div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={pageStyle}><p style={{color: "#888"}}>Loading...</p></div>}>
      <AuthContent />
    </Suspense>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false }: ButtonProps) {
  return (
    <motion.button whileHover={disabled ? undefined : { scale: 1.02, y: -1 }} whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick} disabled={disabled}
      style={{
        width: "100%", minHeight: "45px", padding: "12px", borderRadius: "10px",
        border: variant === "secondary" ? "1px solid #40ace9" : "none",
        backgroundColor: variant === "secondary" ? "transparent" : "#40ace9",
        color: variant === "secondary" ? "#40ace9" : "white",
        marginBottom: "12px", cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600, opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}
function Input({ value, onChange, ...props }: InputProps) {
  return (
    <input {...props} value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "10px",
        border: "1px solid #3a3b42", backgroundColor: "#2f3037", color: "white",
        boxSizing: "border-box", outline: "none",
      }} />
  );
}
function Spinner() {
  return (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,0.3)", borderTop: "3px solid white", borderRadius: "50%", margin: "0 auto" }} />
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center",
  backgroundColor: "#2f3037", color: "white", fontFamily: "Arial, sans-serif", padding: "24px",
};
const cardStyle: CSSProperties = {
  width: "100%", maxWidth: "440px", padding: "32px", backgroundColor: "#202123",
  borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", border: "1px solid #2f3037",
};
const backLink: CSSProperties = { textAlign: "center", cursor: "pointer", color: "#40ace9", fontSize: "13px", marginTop: "4px" };
const linkSmall: CSSProperties = { textAlign: "center", cursor: "pointer", color: "#888", fontSize: "12px", marginTop: "2px", textDecoration: "underline" } as CSSProperties;
const messageStyle: CSSProperties = {
  margin: "12px 0 0", color: "#ffb020", textAlign: "center", background: "rgba(255,176,32,0.1)",
  border: "1px solid rgba(255,176,32,0.2)", borderRadius: "8px", padding: "10px", fontSize: "13px", lineHeight: "1.4",
};
const infoStyle: CSSProperties = {
  margin: "12px 0 0", color: "#40ace9", textAlign: "center", background: "rgba(64,172,233,0.1)",
  border: "1px solid rgba(64,172,233,0.2)", borderRadius: "8px", padding: "10px", fontSize: "13px", lineHeight: "1.4",
};
const strengthBarContainer: CSSProperties = { height: "6px", backgroundColor: "#3a3b42", borderRadius: "6px", overflow: "hidden" };
const strengthBar: CSSProperties = { height: "100%" };
const h2Style: CSSProperties = { margin: "0 0 20px", fontSize: "18px", fontWeight: 600 };
const smallCenter: CSSProperties = { textAlign: "center", color: "#777", fontSize: "12px", marginTop: "10px" };
const iconCircle: CSSProperties = {
  width: "72px", height: "72px", borderRadius: "50%", background: "rgba(64,172,233,0.15)",
  border: "1px solid rgba(64,172,233,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
  margin: "0 auto 16px", fontSize: "32px",
};
const subText: CSSProperties = { margin: "0 auto 16px", color: "#bbb", fontSize: "14px", lineHeight: "1.5", maxWidth: "300px", textAlign: "center" };
const emailBadge: CSSProperties = {
  margin: "0 auto 20px", background: "#2f3037", border: "1px solid #3a3b42", borderRadius: "8px",
  padding: "8px 12px", color: "#40ace9", fontSize: "14px", fontWeight: 600, wordBreak: "break-all", display: "inline-block", maxWidth: "100%",
};
const infoBox: CSSProperties = { background: "#2a2b32", border: "1px solid #3a3b42", borderRadius: "12px", padding: "14px", marginBottom: "20px" };
const infoBoxTitle: CSSProperties = { margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#ddd" };
const olStyle: CSSProperties = { margin: 0, paddingLeft: "18px", color: "#aaa", fontSize: "13px", lineHeight: "1.6" } as any;
const tinyNote: CSSProperties = { margin: "10px 0 0", fontSize: "11px", color: "#777" };
const dualLinks: CSSProperties = { display: "flex", justifyContent: "center", gap: "12px", marginTop: "6px" };
