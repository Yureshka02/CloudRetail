import express from "express";
import { getInventory, putInventoryItem, decrementStock } from "./db.js";

const app = express();
app.use(express.json());

const SERVICE = process.env.SERVICE_NAME || "inventory";
const PORT = process.env.PORT || 8080;

// health
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));

// ✅ Step G route 1: GET /inventory/:sku
app.get("/inventory/:sku", async (req, res) => {
  try {
    const item = await getInventory(req.params.sku);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

// ✅ Step G route 2: POST /inventory/seed
// body: { sku: "ABC", stock: 10, price: 100 }
app.post("/inventory/seed", async (req, res) => {
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

    res.status(201).json({ ok: true, sku });
  } catch (e) {
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

// Optional (useful later for saga): POST /inventory/reserve
// body: { sku:"ABC", qty:2 }
app.post("/inventory/reserve", async (req, res) => {
  try {
    const { sku, qty } = req.body;
    if (!sku || typeof qty !== "number") {
      return res.status(400).json({ message: "sku and qty required" });
    }
    const updated = await decrementStock(sku, qty);
    res.json({ ok: true, updated });
  } catch (e) {
    // conditional failure means insufficient stock
    if (String(e).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Insufficient stock" });
    }
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));
