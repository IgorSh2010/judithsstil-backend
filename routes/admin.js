import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getOrders, getOrderStatuses, getPaymentMethods } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, getOrders); //requireRole
router.get("/order-statuses", tenantResolver, authenticateToken, getOrderStatuses); 
router.get("/payment-methods", tenantResolver, authenticateToken, getPaymentMethods);

router.put("/update-order-status/:id", tenantResolver, authenticateToken, requireRole("admin"), updateOrderStatus);
router.put("/update-order-payment/:id", tenantResolver, authenticateToken, requireRole("admin"), updateOrderPayment);

export default router;
