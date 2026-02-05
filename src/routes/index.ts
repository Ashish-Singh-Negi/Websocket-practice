import express from "express";
import { signupController } from "../controllers/signup.controller.ts";
import { signinController } from "../controllers/signin.controller.ts";

const router = express.Router();

router.post("/signup", signupController);
router.post("/signin", signinController);

export default router;
