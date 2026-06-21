import "./App.css";

function App() {
  return (
    <div style={{ background: "#0a0a2e", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif", color: "white", textAlign: "center" }}>
      <div style={{ background: "linear-gradient(145deg, #1a1a3e, #0d0d2b)", padding: "40px", borderRadius: "24px", border: "2px solid gold", maxWidth: "500px" }}>
        <h1 style={{ color: "gold", fontSize: "36px" }}>🚗 pbp</h1>
        <p style={{ fontSize: "20px", color: "#ccc" }}>गाडीची काळजी तुमची,<br />सुरक्षिततेची जबाबदारी आमची.</p>
        <h2 style={{ color: "#ffd700", fontSize: "26px" }}>मोटार विमा</h2>
        <p style={{ fontSize: "18px" }}>अपघातांपासून तुमचं संरक्षण.</p>
        <div style={{ marginTop: "20px", borderTop: "1px solid #333", paddingTop: "15px", color: "#ffd700" }}>
          Prashant Chandratre<br />+91 7709446589
        </div>
      </div>
    </div>
  );
}

export default App;
