const { createServer } = require("http");
const { storage } = require("./storage");
const { z } = require("zod");
const { insertProductSchema } = require("./schema");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken"); 
const auth = require('./middleware/auth');
const { Payment } = require("./schema");
const{generateBarcodeValue,generateBarcodeImage} = require('./barcode');
const path = require("path");
const fs = require("fs");
const multer= require("multer")

const{Product} = require('./schema');
// Define the User model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: Number, required: true },
  name: { type: String, required: true },
  avatar: { type: String }
});

// Make sure we're not redefining the model if it already exists
const User = mongoose.models.User || mongoose.model("User", userSchema);

function registerRoutes(app) {
  // Fixed the route path to include the leading slash
  app.post('/api/user/signup', async (req, res) => {
    try {
      console.log("Signup Request Body:", req.body); // Debug log to check what's being received
      
      const { username, password, name, address, contact, avatar } = req.body;
    
      if (!username || !password || !name || !address || !contact) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
    
      // Check if user already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
    
      // Create new user
      const newUser = new User({
        username,
        password: hashedPassword,
        name,
        address,
        contact: Number(contact), // Ensure contact is stored as a number
        avatar
      });
    
      await newUser.save();
      
      return res.status(201).json({ 
        message: 'User created successfully',
        user: {
          username: newUser.username,
          name: newUser.name
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ message: 'Error creating user', error: error.message });
    }
  });
  
  app.post('/api/user/login', async (req, res) => {
    try {
      console.log("Login Request Body:", req.body);

      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find the user by username
      const user = await User.findOne({ username });
      
      // If user doesn't exist
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Compare the provided password with the stored hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create a JWT token
      const token = jwt.sign(
        { 
          id: user._id,
          username: user.username,
          name: user.name
        },
        process.env.JWT_SECRET || 'your-secret-key', // Use a proper secret from environment variables in production
        { expiresIn: '24h' }
      );

      // Return user info and token
      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          address: user.address,
          contact: user.contact,
          avatar: user.avatar
        },
        token
      });
    } catch (error) {
      console.error('Error during login:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  // Dashboard endpoints


  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  // user ka hai
  app.get("/api/user/products",auth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/top", async (req, res) => {
    try {
      const topProducts = await storage.getTopProducts();
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/categories", async (req, res) => {
    try {
      const categories = await storage.getProductCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/user/products/categories", async (req, res) => {
    try {
      const categories = await storage.getProductCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(parseInt(req.params.id, 10));
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new product
  // app.post("/api/products", async (req, res) => {
  //   try {
  //     const validatedData = insertProductSchema.parse(req.body);
  //     const product = await storage.createProduct(validatedData);
  //     res.status(201).json(product);
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ message: error.errors });
  //     }
  //     res.status(500).json({ message: error.message });
  //   }
  // });




 // Define multer storage and file filter for GLB files
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save uploaded GLB files in public/uploads folder
    const uploadDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename using a timestamp and a random number
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

// Optional file filter to allow only GLB files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "model/gltf-binary" || file.originalname.endsWith(".glb")) {
    cb(null, true);
  } else {
    cb(new Error("Only GLB files are allowed"), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter });

// PATCH endpoint to update a product's 3D model file
app.patch("/api/products/:id/upload", upload.single("model3dFile"), async (req, res) => {
  try {
    const { id } = req.params;
    // Check that a file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Construct the relative file path.
    // We assume files are stored in "public/uploads" and served statically.
    const filePath = `/uploads/${req.file.filename}`;

    // Update the product's model3dFile field using the MongoDB _id
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { model3dFile: filePath },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
  
      // Generate a unique barcode value
      const barcodeValue = generateBarcodeValue();
      
      // Create a unique file name for the barcode image
      const barcodeFileName = `${barcodeValue}.png`;
      
      // Define the directory path for barcode images
      const barcodesDir = path.join(__dirname, "public", "barcodes");
      // Ensure the directory exists; if not, create it
      if (!fs.existsSync(barcodesDir)) {
        fs.mkdirSync(barcodesDir, { recursive: true });
      }
      
      // Define the output path
      const outputPath = path.join(barcodesDir, barcodeFileName);
  
      // Generate and save the barcode image
      await generateBarcodeImage(barcodeValue, outputPath);
  
      // Append barcode fields to the validated product data
      validatedData.barcode = barcodeValue;
      validatedData.barcodeImage = `/barcodes/${barcodeFileName}`;
  
      // Create the product using your storage layer
      const product = await storage.createProduct(validatedData);
      
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  
// BARCODE SE SCAN

app.get("/api/products/barcode/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await Product.findOne({ barcode });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


  // Update an existing product
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use id as a string
      const validatedData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(id, validatedData);
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(updatedProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  

  // Delete a product
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use the id as a string
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

  // Inventory alerts endpoints
  app.get("/api/inventory/alerts", async (req, res) => {
    try {
      const alerts = await storage.getInventoryAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });



  app.post("/api/inventory/restock/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id, 10);
      const product = await storage.restockProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sales endpoints
  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(parseInt(req.params.id, 10));
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  // Create a new sale

// Create a new sale, update product stock, and save the sale (bill)
// Create a new sale and update product stocks
// In your routes.js (or wherever your sales routes are defined)
app.post("/api/sales", async (req, res) => {
  try {
    console.log("Sale Request Body:", req.body); // Debug log

    // Destructure and convert numeric fields:
    const {
      customerName,
      items,
      subtotal,
      tax,
      total,
      status,
      notes
    } = req.body;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Missing required sale data." });
    }

    // Convert string numbers to actual numbers
    const saleData = {
      customerName,
      status,
      notes,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(tax),
      total: parseFloat(total),
      // Also convert each item's price to number
      items: items.map(item => ({
        ...item,
        price: parseFloat(item.price)
      }))
    };

    // Create the sale (this function should also update the stock values)
    const sale = await storage.createSale(saleData);
    res.status(201).json(sale);
  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({ message: error.message });
  }
});

// user ka hai

app.post("/api/user/sales",auth,async (req, res) => {
  try {
    console.log("Sale Request Body:", req.body); // Debug log

    // Destructure and convert numeric fields:
    const {
      customerName,
      items,
      subtotal,
      tax,
      total,
      status,
      notes
    } = req.body;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Missing required sale data." });
    }

    // Convert string numbers to actual numbers
    const saleData = {
      customerName,
      status,
      notes,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(tax),
      total: parseFloat(total),
      // Also convert each item's price to number
      items: items.map(item => ({
        ...item,
        price: parseFloat(item.price)
      }))
    };

    // Create the sale (this function should also update the stock values)
    const sale = await storage.createSale(saleData);
    res.status(201).json(sale);
  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({ message: error.message });
  }
});







  // app.patch("/api/sales/:id/status", async (req, res) => {
  //   try {
  //     const id = parseInt(req.params.id, 10);
  //     const { status } = req.body;
  //     // Validate status using Zod; allowed statuses: "pending", "paid", "failed"
  //     const validStatus = z.enum(["pending", "paid", "failed"]).parse(status);
  //     const updatedSale = await storage.updateSaleStatus(id, validStatus);
  //     if (!updatedSale) {
  //       return res.status(404).json({ message: "Sale not found" });
  //     }
  //     res.json(updatedSale);
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ message: error.errors });
  //     }
  //     res.status(500).json({ message: error.message });
  //   }
  // });

  // Payments endpoints
  


  app.post("/api/user/payment", async (req, res) => {
    try {
      const { saleId, amount, method, status, customerName, reference } = req.body;
      if (!saleId || !amount || !method || !status || !customerName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      const payment = new Payment({ saleId, amount, method, status, customerName, reference });
      await payment.save();
      return res.status(201).json({
        message: "Payment created successfully",
        payment,
      });
    } catch (error) {
      console.error("Error creating payment:", error);
      return res.status(500).json({ message: error.message });
    }
  });
  
  // (Optional) Get payments for the user (or all payments)
  app.get("/api/user/payment", async (req, res) => {
    try {
      const payments = await Payment.find();
      return res.json(payments);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });






  app.patch("/api/sales/:id/status", async (req, res) => {
    try {
      // Use the ID as a string instead of parsing it to a number.
      const id = req.params.id;
      const { status } = req.body;
      const validStatus = z.enum(["pending", "paid", "failed"]).parse(status);
      const updatedSale = await storage.updateSaleStatus(id, validStatus);
      if (!updatedSale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(updatedSale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error in /api/sales/:id/status:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  
  
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments/stats", async (req, res) => {
    try {
      const period = req.query.period || "week";
      const stats = await storage.getPaymentStats(period);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Chart data endpoints
  // app.get("/api/sales/chart", async (req, res) => {
  //   try {
  //     const timeframe = req.query.timeframe || "monthly";
  //     const data = await storage.getSalesChartData(timeframe);
  //     res.json(data);
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // });

  // Chart data endpoint for sales chart
app.get("/api/sales/chart", async (req, res) => {
  try {
    const allowedTimeframes = ["daily", "weekly", "monthly"];
    const timeframe = req.query.timeframe || "monthly";

    // Validate timeframe
    if (!allowedTimeframes.includes(timeframe)) {
      return res.status(400).json({ message: "Invalid timeframe value" });
    }

    // Fetch sales chart data
    const data = await storage.getSalesChartData(timeframe);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/sales/chart:", error);
    res.status(500).json({ message: error.message });
  }
});


  app.get("/api/transactions/recent", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "today";
      const transactions = await storage.getRecentTransactions(timeframe);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reports endpoints
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const period = req.query.period || "month";
      const data = await storage.getSalesReport(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/category-sales", async (req, res) => {
    try {
      const period = req.query.period || "month";
      const data = await storage.getCategorySalesReport(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/product-performance", async (req, res) => {
    try {
      const period = req.query.period || "month";
      const data = await storage.getProductPerformanceReport(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

module.exports = { registerRoutes };
