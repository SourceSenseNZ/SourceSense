"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import Spinner from "@/components/Spinner";
import SuccessCheck from "@/components/SuccessCheck";
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
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const passwordStrength =
    password.length < 6 ? "Weak" : password.length < 10 ? "Medium" : "Strong";

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
      } else {
        router.push("/");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://source-sense.vercel.app",
      },
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMode("confirm");
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#2f3037",
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
          transition: "all 0.3s ease",
          animation: "fadeIn 0.4s ease",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <Logo variant="full" />
        </div>

        {mode === "choice" && (
          <>
            <button onClick={() => setMode("login")} style={primaryButton} disabled={loading}>
              Sign In
            </button>

            <button onClick={() => setMode("signup")} style={secondaryButton} disabled={loading}>
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

            <button onClick={handleLogin} style={primaryButton} disabled={loading}>
              {loading ? <Spinner /> : "Sign In"}
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

            {password && (
              <p
                style={{
                  fontSize: "12px",
                  marginTop: "-10px",
                  marginBottom: "15px",
                  color:
                    passwordStrength === "Weak"
                      ? "#ff5c5c"
                      : passwordStrength === "Medium"
                        ? "#facc15"
                        : "#40ace9",
                }}
              >
                Strength: {passwordStrength}
              </p>
            )}

            <button onClick={handleSignup} style={primaryButton} disabled={loading}>
              {loading ? <Spinner /> : "Create Account"}
            </button>

            <BackButton setMode={setMode} />
          </>
        )}

        {mode === "confirm" && (
          <div style={{ textAlign: "center" }}>
            <SuccessCheck />
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
              disabled={loading}
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

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
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
        color: "#40ace9",
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
  borderRadius: "10px",
  border: "1px solid #3a3b42",
  backgroundColor: "#343541",
  color: "white",
};

const primaryButton = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#40ace9",
  border: "none",
  borderRadius: "10px",
  fontWeight: "600",
  cursor: "pointer",
  marginBottom: "15px",
  transition: "all 0.2s ease",
};

const secondaryButton = {
  width: "100%",
  padding: "12px",
  backgroundColor: "transparent",
  border: "1px solid #40ace9",
  borderRadius: "10px",
  cursor: "pointer",
  marginBottom: "15px",
  color: "#40ace9",
  fontWeight: "500",
};
