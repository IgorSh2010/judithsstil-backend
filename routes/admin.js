import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getAllOrders } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, requireRole, getAllOrders);
//router.patch("/:id", verifyToken, verifyAdmin, updateOrderStatus);

export default router;
