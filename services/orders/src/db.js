import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const ORDERS_TABLE = process.env.ORDERS_TABLE;

if (!INVENTORY_TABLE) throw new Error("INVENTORY_TABLE env var missing");
if (!ORDERS_TABLE) throw new Error("ORDERS_TABLE env var missing");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export async function getInventoryItem(sku) {
  const out = await ddb.send(new GetCommand({
    TableName: INVENTORY_TABLE,
    Key: { sku }
  }));
  return out.Item || null;
}

export async function placeOrderTxn({ userId, sku, qty, priceAtPurchase, orderId, createdAt, pii }) {
  // Atomic:
  // 1) decrement stock only if stock >= qty
  // 2) create order record
  const createdAtOrderId = `${createdAt}#${orderId}`;

  await ddb.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: INVENTORY_TABLE,
          Key: { sku },
          UpdateExpression: "SET #s = #s - :q, updatedAt = :t",
          ConditionExpression: "attribute_exists(sku) AND #s >= :q",
          ExpressionAttributeNames: { "#s": "stock" },
          ExpressionAttributeValues: {
            ":q": qty,
            ":t": createdAt
          }
        }
      },
      {
        Put: {
          TableName: ORDERS_TABLE,
          Item: {
            userId,
            createdAtOrderId,
            orderId,
            sku,
            qty,
            status: "PLACED",
            priceAtPurchase,
            createdAt,
            // store pii as-is for now (fastest). We'll encrypt in the next step.
            shippingAddress: pii?.shippingAddress,
            phone: pii?.phone
          }
        }
      }
    ]
  }));

  return { orderId, createdAtOrderId };
}

export async function listOrdersByUser(userId, limit = 20) {
  const out = await ddb.send(new QueryCommand({
    TableName: ORDERS_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    ScanIndexForward: false,
    Limit: limit
  }));
  return out.Items || [];
}
