const mongoose = require("mongoose");
const { z } = require("zod");

// -----------------------------
// User Schema & Model
// -----------------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: Number, required: true },
  name: { type: String, required: true },
  avatar: { type: String }
});
const User = mongoose.model("User", userSchema);

// -----------------------------
// Product Schema & Model
// -----------------------------
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    cost: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 5 },
    imageUrl: { type: String },
    barcode: { type: String },
    // Field to store the GLB file path
    model3dFile: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

const Product = mongoose.model("Product", productSchema);


// -----------------------------
// Sale & SaleItem Schemas & Model
// -----------------------------
const saleItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  customerName: { type: String, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { type: String, required: true },
  notes: { type: String },
  items: [saleItemSchema]
});
const Sale = mongoose.model("Sale", saleSchema);

// -----------------------------
// Payment Schema & Model
// -----------------------------
const paymentSchema = new mongoose.Schema({
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true }, // e.g., "credit_card", "cash", "mobile_payment"
  status: { type: String, required: true }, // e.g., "pending", "paid", "failed"
  date: { type: Date, default: Date.now },
  customerName: { type: String, required: true },
  reference: { type: String }
});
const Payment = mongoose.model("Payment", paymentSchema);

// -----------------------------
// Inventory Alerts Schema & Model
// -----------------------------
const inventoryAlertSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  product: { type: String, required: true },
  currentStock: { type: Number, required: true },
  minRequiredStock: { type: Number, required: true },
  status: { type: String, required: true }, // "critical" or "warning"
  createdAt: { type: Date, default: Date.now }
});
const InventoryAlert = mongoose.model("InventoryAlert", inventoryAlertSchema);

// -----------------------------
// Zod Schema for Product Validation
// -----------------------------
const insertProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Please select a category"),
  price: z.number().positive("Price must be a positive number"),
  cost: z.number().positive("Cost must be a positive number"),
  stock: z.number().nonnegative("Stock can't be negative").optional(),
  minStock: z.number().nonnegative("Min stock can't be negative").optional(),
  imageUrl: z.string().url("Please enter a valid URL").optional()
});

// -----------------------------
// Exports
// -----------------------------
module.exports = {
  User,
  Product,
  Sale,
  Payment,
  InventoryAlert,
  insertProductSchema
};
