import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import jwt from "jsonwebtoken";
import { errorResponse, successResponse } from "../utils/responses.ts";

export async function signinController(req: Request, res: Response) {
  const { username } = req.body;

  if (!username.trim()) {
    return res.status(400).json(errorResponse("username required"));
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        username,
      },
    });
    if (!user) {
      res.status(401).json(errorResponse("INVALID_CREDENTIALS"));
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET!,
    );

    res.status(200).json(
      successResponse({
        ...user,
        token,
      }),
    );
  } catch (error) {
    console.error("Error while login user ", error);
    return res.status(500).json(errorResponse("INTERNAL_SERVER_ERROR"));
  }
}
