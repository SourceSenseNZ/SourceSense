export default function Spinner() {
  return (
    <div
      style={{
        border: "3px solid #2f3037",
        borderTop: "3px solid #40ace9",
        borderRadius: "50%",
        width: "20px",
        height: "20px",
        animation: "spin 0.8s linear infinite",
        margin: "0 auto",
      }}
    >
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
