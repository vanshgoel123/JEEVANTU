const { User, Product, Sale, Payment, InventoryAlert } = require("./schema");

class MongoStorage {
  // ----------------------------
  // User methods
  // ----------------------------
  async getUser(id) {
    return await User.findById(id);
  }

  async getUserByUsername(username) {
    return await User.findOne({ username });
  }

  async createUser(insertUser) {
    const user = new User(insertUser);
    return await user.save();
  }

  // ----------------------------
  // Product methods
  // ----------------------------
  async getAllProducts() {
    return await Product.find({});
  }

  async getProduct(id) {
    return await Product.findById(id);
  }

  async createProduct(productData) {
    const product = new Product(productData);
    const newProduct = await product.save();
    // Check if an inventory alert is needed
    if (newProduct.stock < newProduct.minStock) {
      await this.createInventoryAlert({
        productId: newProduct._id,
        product: newProduct.name,
        currentStock: newProduct.stock,
        minRequiredStock: newProduct.minStock,
        status: newProduct.stock <= newProduct.minStock / 2 ? "critical" : "warning",
      });
    }
    return newProduct;
  }

  async updateProduct(id, updateData) {
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });
    if (updatedProduct && (updateData.stock !== undefined || updateData.minStock !== undefined)) {
      // Remove existing alerts for this product
      await InventoryAlert.deleteMany({ productId: id });
      // Create a new alert if needed
      if (updatedProduct.stock < updatedProduct.minStock) {
        await this.createInventoryAlert({
          productId: updatedProduct._id,
          product: updatedProduct.name,
          currentStock: updatedProduct.stock,
          minRequiredStock: updatedProduct.minStock,
          status: updatedProduct.stock <= updatedProduct.minStock / 2 ? "critical" : "warning",
        });
      }
    }
    return updatedProduct;
  }

  async deleteProduct(id) {
    const result = await Product.findByIdAndDelete(id);
    return result !== null;
  }

  async getProductCategories() {
    return await Product.distinct("category");
  }

  async getTopProducts(limit = 4) {
    // Here, we assume that "top" products are those with the highest sales.
    // You might store a "salesCount" field or compute it from Sales data.
    // For demonstration, we sort products by stock in ascending order (lowest stock might imply popularity).
    const products = await Product.find({}).sort({ stock: 1 }).limit(limit);
    return products.map(p => ({
      id: p._id,
      name: p.name,
      image: p.imageUrl || "",
      // Replace with real calculation if available
      percentage: Math.floor(Math.random() * 50) + 50,
      price: p.price
    }));
  }

  // ----------------------------
  // Sales methods
  // ----------------------------
  async getAllSales() {
    return await Sale.find({});
  }

  async getSale(id) {
    return await Sale.findById(id);
  }

  // async createSale(saleData) {
  //   const sale = new Sale(saleData);
  //   const newSale = await sale.save();
  //   // Update product stocks for each sale item
  //   if (saleData.items && Array.isArray(saleData.items)) {
  //     for (const item of saleData.items) {
  //       await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
  //     }
  //   }
  //   return newSale;
  // }
  async createSale(saleData) {
    // Ensure numeric fields are numbers (in case they weren't converted in the route)
    saleData.subtotal = parseFloat(saleData.subtotal);
    saleData.tax = parseFloat(saleData.tax);
    saleData.total = parseFloat(saleData.total);
    if (saleData.items && Array.isArray(saleData.items)) {
      saleData.items = saleData.items.map(item => ({
        ...item,
        price: parseFloat(item.price)
      }));
    }
  
    // Create the sale document
    const sale = new Sale(saleData);
    const newSale = await sale.save();
  
    // Update product stocks for each sale item
    if (saleData.items && Array.isArray(saleData.items)) {
      for (const item of saleData.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }
    }
    return newSale;
  }
  

  async updateSaleStatus(id, status) {
    const updatedSale = await Sale.findByIdAndUpdate(id, { status }, { new: true });
    if (updatedSale) {
      // Also update payment status for payments associated with this sale
      await Payment.updateMany({ saleId: id }, { status });
    }
    return updatedSale;
  }

  // ----------------------------
  // Payment methods
  // ----------------------------
  async getAllPayments() {
    return await Payment.find({});
  }

  async getPayment(id) {
    return await Payment.findById(id);
  }

  async createPayment(paymentData) {
    const payment = new Payment(paymentData);
    const newPayment = await payment.save();
    if (paymentData.saleId) {
      await this.updateSaleStatus(paymentData.saleId, paymentData.status);
    }
    return newPayment;
  }

  async getPaymentStats(period) {
    // Use aggregation to sum amounts based on payment status for the given period.
    const startDate = this._getStartDateForPeriod(period);
    const stats = await Payment.aggregate([
      { $match: { status: "paid", date: { $gte: startDate } } },
      { $group: { _id: "$status", total: { $sum: "$amount" } } }
    ]);
    // Similarly for "failed" and "pending" statuses
    const failedStats = await Payment.aggregate([
      { $match: { status: "failed", date: { $gte: startDate } } },
      { $group: { _id: "$status", total: { $sum: "$amount" } } }
    ]);
    const pendingStats = await Payment.aggregate([
      { $match: { status: "pending", date: { $gte: startDate } } },
      { $group: { _id: "$status", total: { $sum: "$amount" } } }
    ]);
    const successful = stats[0] ? stats[0].total : 0;
    const failed = failedStats[0] ? failedStats[0].total : 0;
    const pending = pendingStats[0] ? pendingStats[0].total : 0;
    const total = successful + failed + pending;
    return { total, successful, failed, pending };
  }

  // ----------------------------
  // Inventory alerts methods
  // ----------------------------
  async getInventoryAlerts() {
    return await InventoryAlert.find({});
  }

  async createInventoryAlert(alertData) {
    const alert = new InventoryAlert(alertData);
    return await alert.save();
  }

  async restockProduct(productId) {
    const product = await Product.findById(productId);
    if (!product) return undefined;
    const restockAmount = product.minStock * 2;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: restockAmount } },
      { new: true }
    );
    // Remove existing alerts for this product
    await InventoryAlert.deleteMany({ productId });
    return updatedProduct;
  }

  // ----------------------------
  // Dashboard methods
  // ----------------------------
  async getDashboardStats() {
    const totalProducts = await Product.countDocuments({});
    const lowStockItems = await Product.countDocuments({ $expr: { $lt: ["$stock", "$minStock"] } });
    // Sum of payments with status "paid" for the current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyRevenueResult = await Payment.aggregate([
      { $match: { status: "paid", date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const monthlyRevenue = monthlyRevenueResult[0] ? monthlyRevenueResult[0].total : 0;
    // Count sales for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaySales = await Sale.countDocuments({ date: { $gte: startOfDay } });
    
    // Calculate trends by comparing current month to previous month
    const startOfPreviousMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    const previousMonthRevenueResult = await Payment.aggregate([
      { $match: { status: "paid", date: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const previousMonthRevenue = previousMonthRevenueResult[0] ? previousMonthRevenueResult[0].total : 0;
    let revenueTrend = 0;
    if (previousMonthRevenue > 0) {
      revenueTrend = ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
    }
    const currentMonthSales = await Sale.countDocuments({ date: { $gte: startOfMonth } });
    const previousMonthSales = await Sale.countDocuments({ date: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth } });
    let salesTrend = 0;
    if (previousMonthSales > 0) {
      salesTrend = ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100;
    }
    // For productsTrend, you could compare the number of products created in each month.
    const currentMonthProductCount = await Product.countDocuments({ createdAt: { $gte: startOfMonth } });
    const previousMonthProductCount = await Product.countDocuments({ createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth } });
    let productsTrend = 0;
    if (previousMonthProductCount > 0) {
      productsTrend = ((currentMonthProductCount - previousMonthProductCount) / previousMonthProductCount) * 100;
    }
    
    return {
      totalProducts,
      monthlyRevenue,
      todaySales,
      lowStockItems,
      productsTrend: productsTrend.toFixed(2) + "%",
      revenueTrend: revenueTrend.toFixed(2) + "%",
      salesTrend: salesTrend.toFixed(2) + "%"
    };
  }

  async getSalesChartData(timeframe) {
    // Depending on the timeframe, group sales accordingly using MongoDB aggregation.
    if (timeframe === "monthly") {
      // Group sales by month for the current year.
      const data = await Sale.aggregate([
        { $match: { date: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
        { $group: {
            _id: { month: { $month: "$date" } },
            sales: { $sum: 1 },
            revenue: { $sum: "$total" }
        }},
        { $sort: { "_id.month": 1 } }
      ]);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return data.map(d => ({
        name: monthNames[d._id.month - 1],
        sales: d.sales,
        revenue: d.revenue
      }));
    } else if (timeframe === "weekly") {
      // Group sales by day for the current week.
      const now = new Date();
      // Assume week starts on Monday.
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      const data = await Sale.aggregate([
        { $match: { date: { $gte: startOfWeek, $lt: endOfWeek } } },
        { $group: {
            _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } },
            sales: { $sum: 1 },
            revenue: { $sum: "$total" }
        }},
        { $sort: { "_id.day": 1 } }
      ]);
      return data.map(d => ({
        name: d._id.day,
        sales: d.sales,
        revenue: d.revenue
      }));
    } else {
      // For a daily timeframe, group by hour for the current day.
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      const data = await Sale.aggregate([
        { $match: { date: { $gte: startOfDay, $lt: endOfDay } } },
        { $group: {
            _id: { hour: { $hour: "$date" } },
            sales: { $sum: 1 },
            revenue: { $sum: "$total" }
        }},
        { $sort: { "_id.hour": 1 } }
      ]);
      // Convert hour to a readable format (e.g., "1 AM", "2 PM", etc.)
      return data.map(d => {
        let hour = d._id.hour;
        const suffix = hour >= 12 ? "PM" : "AM";
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return {
          name: `${hour} ${suffix}`,
          sales: d.sales,
          revenue: d.revenue
        };
      });
    }
  }

  async getRecentTransactions(timeframe) {
    // Return the 10 most recent sales transactions.
    return await Sale.find({}).sort({ date: -1 }).limit(10);
  }

  // ----------------------------
  // Reports methods
  // ----------------------------
  async getSalesReport(period) {
    // Use aggregation to group sales by day for the given period.
    let startDate;
    const now = new Date();
    switch (period) {
      case "week":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "quarter":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }
    const data = await Sale.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $group: {
          _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } },
          sales: { $sum: 1 },
          totalSales: { $sum: "$total" }
      }},
      { $sort: { "_id.day": 1 } }
    ]);
    return data.map(d => ({
      name: d._id.day,
      sales: d.sales,
      total: d.totalSales
    }));
  }

  async getCategorySalesReport(period) {
    // Unwind sale items from Sales, lookup product category, and group by category.
    let startDate = this._getStartDateForPeriod(period);
    const data = await Sale.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      { $group: {
          _id: "$product.category",
          totalSales: { $sum: "$items.quantity" }
      }},
      { $project: { _id: 0, name: "$_id", value: "$totalSales" } },
      { $sort: { value: -1 } }
    ]);
    return data;
  }

  async getProductPerformanceReport(period) {
    // Aggregate sale items to compute product performance.
    let startDate = this._getStartDateForPeriod(period);
    const data = await Sale.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $unwind: "$items" },
      { $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          totalQuantity: { $sum: "$items.quantity" }
      }},
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);
    // Optionally, compute trend by comparing with a previous period.
    return data.map(d => ({
      name: d.productName,
      sales: d.totalQuantity,
      // For real trend analysis, you might run another aggregation against a previous period.
      trend: "up",
      percentage: ((d.totalQuantity / 100) * 100).toFixed(0) + "%" // Placeholder calculation
    }));
  }

  // ----------------------------
  // Helper methods
  // ----------------------------
  _getStartDateForPeriod(period) {
    const now = new Date();
    const startDate = new Date(now);
    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    return startDate;
  }
}

module.exports = {
  storage: new MongoStorage()
};