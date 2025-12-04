import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getOrders, getOrderStatuses, getPaymentMethods, updateOrderStatus, updateOrderPayment, getPDFInvoice } from "../controllers/adminOrdersController.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/order/:id", tenantResolver, authenticateToken, requireRole, getOrders); //requireRole
router.get("/order-statuses", tenantResolver, authenticateToken, requireRole, getOrderStatuses); 
router.get("/payment-methods", tenantResolver, authenticateToken, requireRole, getPaymentMethods);
router.get("/orders/:orderId/invoice", tenantResolver, authenticateToken, requireRole, getPDFInvoice);

router.put("/update-order-status/:id", tenantResolver, authenticateToken, requireRole, updateOrderStatus);
router.put("/update-order-payment/:id", tenantResolver, authenticateToken, requireRole, updateOrderPayment);

export default router;
