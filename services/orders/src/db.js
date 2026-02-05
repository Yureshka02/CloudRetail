import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const REGION = process.env.AWS_REGION;
const ORDERS_TABLE = process.env.ORDERS_TABLE;

if (!ORDERS_TABLE) throw new Error("ORDERS_TABLE env var missing");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export function newOrderId() {
  return crypto.randomUUID();
}

export async function createOrder({ userId, sku, qty }) {
  const orderId = newOrderId();
  const item = {
    orderId,
    userId: userId || "demo-user",
    sku,
    qty,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: ORDERS_TABLE,
      Item: item,
    })
  );

  return item;
}
