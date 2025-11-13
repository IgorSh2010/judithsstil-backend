import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getOrders, getOrderStatuses } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, requireRole, getOrders); 
router.get("/order-statuses", tenantResolver, authenticateToken, requireRole, getOrderStatuses); 

export default router;
