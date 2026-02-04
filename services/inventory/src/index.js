import express from "express";
import cors from "cors";
import { getInventory, putInventoryItem, decrementStock } from "./db.js";

const app = express();

// ===== CORS - USING PACKAGE =====
app.use(cors());
// ===== END CORS =====

app.use(express.json());

const SERVICE = process.env.SERVICE_NAME || "inventory";
const PORT = process.env.PORT || 8080;

// ---- helpers ----
async function seedHandler(req, res) {
  try {
    const { sku, stock, price } = req.body;
    if (!sku || typeof stock !== "number") {
      return res.status(400).json({ message: "sku and stock required" });
    }

    await putInventoryItem({
      sku,
      stock,
      price: typeof price === "number" ? price : undefined,
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({ ok: true, sku });
  } catch (e) {
    return res.status(500).json({ message: "Error", error: String(e) });
  }
}

async function reserveHandler(req, res) {
  try {
    const { sku, qty } = req.body;
    if (!sku || typeof qty !== "number") {
      return res.status(400).json({ message: "sku and qty required" });
    }

    const updated = await decrementStock(sku, qty);
    return res.json({ ok: true, updated });
  } catch (e) {
    if (String(e).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Insufficient stock" });
    }
    return res.status(500).json({ message: "Error", error: String(e) });
  }
}

async function getSkuHandler(req, res) {
  try {
    const item = await getInventory(req.params.sku);
    if (!item) return res.status(404).json({ message: "Not found" });
    return res.json(item);
  } catch (e) {
    return res.status(500).json({ message: "Error", error: String(e) });
  }
}

// ---- routes ----
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));
app.get("/inventory/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));

app.get("/", (req, res) => res.status(200).json({ service: SERVICE, status: "running" }));
//app.post("/inventory", seedHandler);

app.get("/inventory/:sku", getSkuHandler);
//app.get("/:sku", getSkuHandler);

app.post("/inventory/seed", seedHandler);
//app.post("/seed", seedHandler);

app.post("/inventory/reserve", reserveHandler);
//app.post("/reserve", reserveHandler);

app.post("/inventory/ping", (req, res) => {
  res.json({ ok: true, method: "POST", gotBody: req.body });
});

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));

