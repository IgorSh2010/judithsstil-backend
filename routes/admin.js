import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getOrders } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, requireRole("admin"), getOrders); 
//router.patch("/:id", verifyToken, verifyAdmin, updateOrderStatus); requireRole

export default router;
