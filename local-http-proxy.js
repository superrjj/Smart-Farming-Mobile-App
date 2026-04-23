const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

const BASE = "https://arduino-bridge.commanderzale08.workers.dev";

app.get("/health", async (_req, res) => {
  try {
    const response = await fetch(`${BASE}/health`);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("Proxy health error:", error);
    res.status(500).send("Proxy health error");
  }
});

app.get("/api/irrigation-state", async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const response = await fetch(`${BASE}/api/irrigation-state?${query}`);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("Proxy irrigation GET error:", error);
    res.status(500).send("Proxy irrigation GET error");
  }
});

app.post("/api/irrigation-state", async (req, res) => {
  try {
    const response = await fetch(`${BASE}/api/irrigation-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("Proxy irrigation POST error:", error);
    res.status(500).send("Proxy irrigation POST error");
  }
});

app.post("/api/sensor-reading", async (req, res) => {
  try {
    const response = await fetch(`${BASE}/api/sensor-reading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("Proxy sensor error:", error);
    res.status(500).send("Proxy sensor error");
  }
});

app.listen(80, "0.0.0.0", () => {
  console.log("HTTP Proxy running on port 80");
});
