import express from "express";

const router = express.Router();

router.get("/logo", getLogo);

export default router;