"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AuthMode = "choice" | "login" | "signup" | "confirm";

type AuthFormProps = {
  email: string;
  password: string;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
};

type BackButtonProps = {
  setMode: (mode: AuthMode) => void;
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleLogin() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Invalid email or password.");
    } else {
      router.push("/");
    }
  }

  async function handleSignup() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://source-sense.vercel.app",
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMode("confirm");
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#343541",
        color: "white",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          width: "420px",
          padding: "40px",
          backgroundColor: "#202123",
          borderRadius: "14px",
          boxShadow: "0 0 40px rgba(0,0,0,0.3)",
        }}
      >
        <h1 style={{ marginBottom: "30px", textAlign: "center" }}>SourceSense</h1>

        {mode === "choice" && (
          <>
            <button onClick={() => setMode("login")} style={primaryButton}>
              Sign In
            </button>

            <button onClick={() => setMode("signup")} style={secondaryButton}>
              Create Account
            </button>
          </>
        )}

        {mode === "login" && (
          <>
            <AuthForm
              email={email}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
            />

            <button onClick={handleLogin} style={primaryButton}>
              Sign In
            </button>

            <BackButton setMode={setMode} />
          </>
        )}

        {mode === "signup" && (
          <>
            <AuthForm
              email={email}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
            />

            <button onClick={handleSignup} style={primaryButton}>
              Create Account
            </button>

            <BackButton setMode={setMode} />
          </>
        )}

        {mode === "confirm" && (
          <div style={{ textAlign: "center" }}>
            <h2>Check your email</h2>
            <p style={{ marginTop: "15px", color: "#ccc" }}>
              We&apos;ve sent a confirmation link to:
            </p>
            <p style={{ marginTop: "5px", fontWeight: "bold" }}>{email}</p>

            <p style={{ marginTop: "20px", color: "#aaa", fontSize: "14px" }}>
              If you don&apos;t see it, check your spam or junk folder.
            </p>

            <button
              onClick={() => setMode("choice")}
              style={{ ...secondaryButton, marginTop: "25px" }}
            >
              Back to login
            </button>
          </div>
        )}

        {message && (
          <p
            style={{
              marginTop: "20px",
              color: "#ffb020",
              textAlign: "center",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function AuthForm({ email, password, setEmail, setPassword }: AuthFormProps) {
  return (
    <>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />
    </>
  );
}

function BackButton({ setMode }: BackButtonProps) {
  return (
    <p
      onClick={() => setMode("choice")}
      style={{
        marginTop: "20px",
        textAlign: "center",
        cursor: "pointer",
        color: "#19c37d",
      }}
    >
      Back
    </p>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#40414f",
  color: "white",
};

const primaryButton = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#19c37d",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  marginBottom: "15px",
};

const secondaryButton = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#2a2b32",
  border: "1px solid #444",
  borderRadius: "8px",
  cursor: "pointer",
  marginBottom: "15px",
  color: "white",
};
