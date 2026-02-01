import express from "express";

const app = express();
app.use(express.json());

const SERVICE = process.env.SERVICE_NAME || "service";
const PORT = process.env.PORT || 8080;

app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));
app.get("/", (req, res) => res.status(200).json({ service: SERVICE, status: "running" }));

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));
