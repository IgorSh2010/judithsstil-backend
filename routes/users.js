import express from "express";
import multer from "multer";
import { userUpdate, getMe, getStats } from "../controllers/userController.js";
import { uploadImage, getImage } from "../controllers/settingsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getClientOrder, getClientCart, addToCart, clearCart, removeCartItem, createOrder } from "../controllers/ordersController.js";
import { fetchMessages, sendMessageToConversation, pollConversationUpdates, getConversations, markConversationRead } from "../controllers/conversationsController.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка
  
router.get("/get-image", tenantResolver, authenticateToken, getImage);
router.get("/cart", tenantResolver, authenticateToken, getClientCart);
router.get("/client-order/:id", tenantResolver, authenticateToken, getClientOrder);
router.get("/conversations", tenantResolver, authenticateToken, getConversations);
router.get("/messages/:id", tenantResolver, authenticateToken, fetchMessages);
router.get("/messages/:id/poll", tenantResolver, authenticateToken, pollConversationUpdates);
router.get("/stats", tenantResolver, authenticateToken, getStats);

router.post("/update", authenticateToken, userUpdate); // 
router.post("/upload-image", tenantResolver, authenticateToken, upload.single("image"), uploadImage);
router.post("/cart", tenantResolver, authenticateToken, addToCart);
router.post("/create-order", tenantResolver, authenticateToken, createOrder);
router.post("/send-message/:id", tenantResolver, authenticateToken, sendMessageToConversation);
router.post("/conversations/:id/mark-read", tenantResolver, authenticateToken, markConversationRead);

router.delete("/clearCart", tenantResolver, authenticateToken, clearCart);
router.delete("/remove-from-cart/:productID", tenantResolver, authenticateToken, removeCartItem);

// 🧑‍💻 Отримати поточного користувача
router.get("/me", authenticateToken, getMe);

export default router;
