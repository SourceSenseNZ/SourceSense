"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type AuthMode = "choice" | "login" | "signup" | "confirm";

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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordStrength = password.length < 6 ? 0 : password.length < 10 ? 50 : 100;

  async function handleLogin() {
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage("Invalid email or password.");
        return;
      }

      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
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

      setMode("confirm");
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
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
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
            </motion.div>
          )}

          {(mode === "login" || mode === "signup") && (
            <motion.div
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Input type="email" placeholder="Email" value={email} onChange={setEmail} />
              <Input
                type="password"
                placeholder="Password"
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
                </div>
              )}

              <Button onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading}>
                {loading ? <Spinner /> : mode === "login" ? "Sign In" : "Create Account"}
              </Button>

              <p style={backLink} onClick={() => setMode("choice")}>
                Back
              </p>
            </motion.div>
          )}

          {mode === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SuccessCheck />
              <h2 style={{ textAlign: "center", margin: "0 0 10px" }}>Account Created</h2>
              <p style={{ textAlign: "center", color: "#aaa", margin: "0 0 25px" }}>
                You can now sign in.
              </p>

              <Button onClick={() => setMode("login")}>Continue to Login</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {message && <p style={messageStyle}>{message}</p>}
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
        marginBottom: "15px",
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
        marginBottom: "15px",
        borderRadius: "10px",
        border: "1px solid #3a3b42",
        backgroundColor: "#2f3037",
        color: "white",
        boxSizing: "border-box",
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

function SuccessCheck() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      style={{
        width: 60,
        height: 60,
        borderRadius: "50%",
        backgroundColor: "#40ace9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
        color: "white",
        fontSize: "28px",
      }}
    >
      ✓
    </motion.div>
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
  maxWidth: "420px",
  padding: "40px",
  backgroundColor: "#202123",
  borderRadius: "16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
};

const backLink: CSSProperties = {
  textAlign: "center",
  cursor: "pointer",
  color: "#40ace9",
  marginTop: "10px",
};

const messageStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#ffb020",
  textAlign: "center",
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
