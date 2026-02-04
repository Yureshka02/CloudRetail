import express from "express";
import { createOrder } from "./db.js";

const app = express();
app.use(express.json());

const SERVICE = process.env.SERVICE_NAME || "orders";
const PORT = process.env.PORT || 8080;

app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));

// ✅ Step G route: POST /orders
// body: { userId:"u1", sku:"ABC", qty:2 }
app.post("/orders", async (req, res) => {
  try {
    const { userId, sku, qty } = req.body;
    if (!sku || typeof qty !== "number") {
      return res.status(400).json({ message: "sku and qty required" });
    }

    const order = await createOrder({ userId, sku, qty });
    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));
