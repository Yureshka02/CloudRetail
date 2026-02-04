import express from "express";
import cors from "cors";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const app = express();

// --- Configuration ---
const SERVICE = process.env.SERVICE_NAME || "notifications";
const PORT = process.env.PORT || 8080;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// Define allowed origins (Matches your Inventory service)
const ALLOWED_ORIGINS = [
  "https://cr-client-chi.vercel.app",
  "http://localhost:3000",
  "http://192.168.1.6:3000"
];

// --- Clients ---
const ddbClient = new DynamoDBClient({ region: "us-east-1" });
const snsClient = new SNSClient({ region: "us-east-1" });

// --- Middleware ---
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Allow curl/postman
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked: " + origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  maxAge: 86400,
}));

// ✅ Replicating your fix: Short-circuit preflight OPTIONS requests
app.options("*", (req, res) => res.sendStatus(204));

app.use(express.json());

// --- Handlers ---

async function checkStockHandler(req, res) {
  const THRESHOLD = 5;

  try {
    // 1. Scan InventoryTable for items below threshold
    const data = await ddbClient.send(new ScanCommand({
      TableName: "InventoryTable",
      FilterExpression: "stock < :t",
      ExpressionAttributeValues: {
        ":t": { N: THRESHOLD.toString() }
      }
    }));

    if (data.Items && data.Items.length > 0) {
      const lowStockList = data.Items.map(i => 
        `- SKU: ${i.sku.S} (Stock: ${i.stock.N})`
      ).join("\n");

      // 2. Notify via SNS
      await snsClient.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: "🚨 Low Stock Alert",
        Message: `The following items are running low:\n\n${lowStockList}`
      }));

      return res.status(200).json({ ok: true, alertedCount: data.Items.length });
    }

    return res.status(200).json({ ok: true, message: "Stock levels healthy" });
  } catch (e) {
    console.error("Notification Error:", e);
    return res.status(500).json({ message: "Error", error: String(e) });
  }
}

// --- Routes ---

// Health Checks
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));
app.get("/notifications/health", (req, res) => res.status(200).json({ ok: true, service: SERVICE }));

// Root
app.get("/", (req, res) => res.status(200).json({ service: SERVICE, status: "running" }));

// Stock Check Endpoint
app.post("/notifications/check-stock", checkStockHandler);

// Ping test (matches your Inventory pattern)
app.post("/notifications/ping", (req, res) => {
  res.json({ ok: true, method: "POST", service: SERVICE, gotBody: req.body });
});

app.listen(PORT, () => console.log(`${SERVICE} listening on ${PORT}`));