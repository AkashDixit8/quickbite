
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pool from "./config/db.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "quickbite-backend",
    message: "QuickBite backend is running",
  });
});


app.get("/api/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.code || "UNKNOWN_ERROR");

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

app.get("/api/menu", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, category, price,
              image_url, is_available
       FROM menu_items
       WHERE is_available = TRUE
       ORDER BY id ASC`
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Failed to fetch menu:", error.code || "UNKNOWN_ERROR");

    res.status(500).json({
      success: false,
      message: "Unable to fetch menu items",
    });
  }
});


app.post("/api/orders", async (req, res) => {
  const items = req.body?.items;

  // Validate the incoming cart
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide between 1 and 50 order items.",
    });
  }

  const quantities = new Map();

  for (const item of items) {
    const id = Number(item?.menuItemId);
    const quantity = item?.quantity;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Each item needs a valid menuItemId and quantity.",
      });
    }

    quantities.set(
      id,
      (quantities.get(id) || 0) + quantity
    );
  }

  if ([...quantities.values()].some((q) => q > 100)) {
    return res.status(400).json({
      success: false,
      message: "Maximum quantity per dish is 100.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(", ");

    const [menuRows] = await connection.query(
      `SELECT id, name, price
       FROM menu_items
       WHERE is_available = TRUE
         AND id IN (${placeholders})
       FOR UPDATE`,
      ids
    );

    if (menuRows.length !== ids.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "One or more dishes are unavailable or invalid.",
      });
    }

    let totalPaise = 0;

    const orderItems = menuRows.map((food) => {
      const quantity = quantities.get(food.id);
      const pricePaise = Math.round(Number(food.price) * 100);

      totalPaise += pricePaise * quantity;

      return {
        id: food.id,
        name: food.name,
        quantity,
        pricePaise,
      };
    });

    if (
      !Number.isSafeInteger(totalPaise) ||
      totalPaise > 9999999999
    ) {
      throw new Error("Order total exceeds the supported limit.");
    }

    const totalAmount = (totalPaise / 100).toFixed(2);

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (status, total_amount)
       VALUES (?, ?)`,
      ["PLACED", totalAmount]
    );

    for (const item of orderItems) {
      await connection.execute(
        `INSERT INTO order_items
           (order_id, menu_item_id, item_name, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.id,
          item.name,
          item.quantity,
          (item.pricePaise / 100).toFixed(2),
        ]
      );
    }

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      data: {
        orderId: orderResult.insertId,
        status: "PLACED",
        totalAmount,
        items: orderItems.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: (item.pricePaise / 100).toFixed(2),
          lineTotal: (
            (item.pricePaise * item.quantity) / 100
          ).toFixed(2),
        })),
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Order rollback failed:", rollbackError.code);
      }
    }

    console.error("Order creation failed:", error.code || "UNKNOWN_ERROR");

    return res.status(500).json({
      success: false,
      message: "Unable to place the order.",
    });
  } finally {
    connection?.release();
  }
});


export default app;
