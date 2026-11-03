import { useEffect, useState } from "react";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Health check failed");
        }

        return response.json();
      })
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("Unavailable"));
  }, []);

  return (
    <main>
      <p>Synthetic data · Historical replay</p>
      <h1>Sentinel</h1>
      <h2>Transaction Monitoring and Investigation</h2>

      <p>Phase 1 — Foundation and data assessment</p>
      <p>Backend status: {backendStatus}</p>
      <p>Data and AI connections have not been configured yet.</p>
    </main>
  );
}

export default App;