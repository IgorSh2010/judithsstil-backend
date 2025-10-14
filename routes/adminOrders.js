import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getAllOrders, updateOrderStatus } from "../controllers/adminOrdersController.js";

const router = express.Router();

router.get("/", verifyToken, verifyAdmin, getAllOrders);
router.patch("/:id", verifyToken, verifyAdmin, updateOrderStatus);

export default router;
