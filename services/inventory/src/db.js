import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE;

if (!INVENTORY_TABLE) throw new Error("INVENTORY_TABLE env var missing");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export async function getInventory(sku) {
  const out = await ddb.send(
    new GetCommand({
      TableName: INVENTORY_TABLE,
      Key: { sku },
    })
  );
  return out.Item || null;
}

export async function putInventoryItem(item) {
  await ddb.send(
    new PutCommand({
      TableName: INVENTORY_TABLE,
      Item: item,
    })
  );
}

export async function listAvailableInventory(limit = 50) {
  const out = await ddb.send(new ScanCommand({
    TableName: INVENTORY_TABLE,
    FilterExpression: "#s > :z",
    ExpressionAttributeNames: { "#s": "stock" },
    ExpressionAttributeValues: { ":z": 0 },
    Limit: limit
  }));
  return out.Items || [];
}


export async function decrementStock(sku, qty) {
  const out = await ddb.send(
    new UpdateCommand({
      TableName: INVENTORY_TABLE,
      Key: { sku },
      UpdateExpression: "SET stock = stock - :q",
      ConditionExpression: "stock >= :q",
      ExpressionAttributeValues: { ":q": qty },
      ReturnValues: "ALL_NEW",
    })
  );
  return out.Attributes;
}
