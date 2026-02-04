import express from "express";
import { getInventory, putInventoryItem, decrementStock } from "./db.js";

const app = express();

// ===== CORS MIDDLEWARE - ADD THIS BEFORE express.json() =====
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});
// ===== END CORS MIDDLEWARE =====

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

// ---- routes (both non-prefixed and /inventory-prefixed) ----

// Health (for direct ALB checks)
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));
// Health behind API Gateway route prefix
app.get("/inventory/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));

// Root (optional, helps you verify service behind /inventory)
app.get("/", (req, res) => res.status(200).json({ service: SERVICE, status: "running" }));
app.post("/inventory", seedHandler);

// GET sku
app.get("/inventory/:sku", getSkuHandler);
// optional: also allow without prefix (only if you ever call service directly)
app.get("/:sku", getSkuHandler);

// Seed
app.post("/inventory/seed", seedHandler);
// optional direct
app.post("/seed", seedHandler);

// Reserve
app.post("/inventory/reserve", reserveHandler);
// optional direct
app.post("/reserve", reserveHandler);

app.post("/inventory/ping", (req, res) => {
  res.json({ ok: true, method: "POST", gotBody: req.body });
});

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));