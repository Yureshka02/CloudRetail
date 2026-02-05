import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const REGION = process.env.AWS_REGION || "us-east-1";
const INVENTORY_TABLE = process.env.INVENTORY_TABLE || "InventoryTable";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const STOCK_THRESHOLD = parseInt(process.env.STOCK_THRESHOLD || "10");

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const sns = new SNSClient({ region: REGION });

export const handler = async (event) => {
  console.log("Starting stock level check...");
  console.log("Threshold:", STOCK_THRESHOLD);

  try {
    // Scan inventory table for low stock items
    const result = await ddb.send(new ScanCommand({
      TableName: INVENTORY_TABLE,
      FilterExpression: "#stock <= :threshold AND #stock > :zero",
      ExpressionAttributeNames: {
        "#stock": "stock"
      },
      ExpressionAttributeValues: {
        ":threshold": STOCK_THRESHOLD,
        ":zero": 0
      }
    }));

    const lowStockItems = result.Items || [];
    console.log(`Found ${lowStockItems.length} items with low stock`);

    if (lowStockItems.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "All items have sufficient stock",
          threshold: STOCK_THRESHOLD
        })
      };
    }

    // Build notification message
    const message = buildNotificationMessage(lowStockItems);

    // Send SNS notification
    if (SNS_TOPIC_ARN) {
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `⚠️ Low Stock Alert - ${lowStockItems.length} items need restocking`,
        Message: message
      }));
      console.log("Notification sent successfully");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Low stock alert sent",
        itemsCount: lowStockItems.length,
        items: lowStockItems.map(i => ({ sku: i.sku, stock: i.stock }))
      })
    };

  } catch (error) {
    console.error("Error checking stock levels:", error);
    throw error;
  }
};

function buildNotificationMessage(items) {
  let message = `LOW STOCK ALERT\n`;
  message += `===================\n\n`;
  message += `The following items are running low on stock:\n\n`;

  items.forEach(item => {
    message += `📦 SKU: ${item.sku}\n`;
    message += `   Stock: ${item.stock} units\n`;
    if (item.price) {
      message += `   Price: $${item.price}\n`;
    }
    if (item.updatedAt) {
      message += `   Last Updated: ${new Date(item.updatedAt).toLocaleString()}\n`;
    }
    message += `\n`;
  });

  message += `\nThreshold: ${STOCK_THRESHOLD} units\n`;
  message += `Time: ${new Date().toLocaleString()}\n`;
  message += `\nPlease restock these items soon!\n`;

  return message;
}