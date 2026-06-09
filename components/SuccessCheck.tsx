export default function SuccessCheck() {
  return (
    <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <div
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #c54a16 0%, #ff6a1a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
          animation: "pop 0.3s ease",
        }}
      >
        <span style={{ color: "white", fontSize: "30px" }}>✓</span>
      </div>

      <style jsx>{`
        @keyframes pop {
          from {
            transform: scale(0.7);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
