import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { getInventoryItem, placeOrderTxn, listOrdersByUser } from "./db.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://cr-client-chi.vercel.app"],
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","x-user-sub"],
  maxAge: 86400
}));

app.options("*", (req, res) => res.sendStatus(204));
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SERVICE = process.env.SERVICE_NAME || "orders";

// health
app.get("/health", (req, res) => res.json({ ok: true, service: SERVICE }));
app.get("/", (req, res) => res.json({ ok: true, service: SERVICE }));

// Helper: get userId (sub) passed from API Gateway, fallback to token decode
function getUserId(req) {
  const h = req.headers["x-user-sub"];
  if (h && typeof h === "string") return h;
  
  // fallback: decode JWT payload without verifying signature (API GW already verified)
  const auth = req.headers.authorization || "";
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    const token = parts[1];
    const payloadB64 = token.split(".")[1];
    if (payloadB64) {
      const json = Buffer.from(payloadB64, "base64").toString("utf8");
      const payload = JSON.parse(json);
      return payload.sub;
    }
  }
  return null;
}

// GET /orders/list - Get all orders for the user
app.get("/orders/list", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Missing user identity" });
    
    const items = await listOrdersByUser(userId, 50);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

// POST /orders/create - Place a new order
app.post("/orders/create", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Missing user identity" });
    
    const { sku, qty, shippingAddress, phone } = req.body;
    
    if (!sku || typeof qty !== "number" || qty <= 0) {
      return res.status(400).json({ message: "sku and qty required" });
    }
    
    const inv = await getInventoryItem(sku);
    if (!inv) return res.status(404).json({ message: "SKU not found" });
    
    const priceAtPurchase = inv.price ?? null;
    const orderId = uuidv4();
    const createdAt = new Date().toISOString();
    
    await placeOrderTxn({
      userId,
      sku,
      qty,
      priceAtPurchase,
      orderId,
      createdAt,
      pii: { shippingAddress, phone }
    });
    
    res.status(201).json({ ok: true, orderId, sku, qty });
  } catch (e) {
    // DynamoDB condition failed => insufficient stock or missing SKU
    if (String(e).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Insufficient stock" });
    }
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

app.listen(PORT, () => console.log`${SERVICE} listening on ${PORT}`));