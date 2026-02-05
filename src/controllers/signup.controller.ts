import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { errorResponse, successResponse } from "../utils/responses.ts";

export async function signupController(req: Request, res: Response) {
  console.log(req.body);

  const { username } = req.body;

  if (!username.trim()) {
    return res.status(400).json(errorResponse("username required"));
  }

  try {
    // check if user already exists or not
    const usernameExist = await prisma.user.findFirst({
      where: {
        username,
      },
    });
    if (usernameExist) {
      res.status(400).json(errorResponse("username already exists"));
      return;
    }

    const user = await prisma.user.create({
      data: {
        username,
      },
    });

    res.status(201).json(successResponse(user));
  } catch (error) {
    console.error("Error while user signup", error);
    return res.status(500).json(errorResponse("INTERNAL SERVER ERROR"));
  }
}
