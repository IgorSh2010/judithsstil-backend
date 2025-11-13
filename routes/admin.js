import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getOrders, getOrderStatuses } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, getOrders); //requireRole
router.get("/order-statuses", tenantResolver, authenticateToken, getOrderStatuses); 

export default router;
