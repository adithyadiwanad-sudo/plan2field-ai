import { Router } from "express";
import { z } from "zod";
import { sendToThesys } from "../services/thesysService.js";

export const chatRouter = Router();

const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

chatRouter.post("/", async (req, res, next) => {
  try {
    const { message } = chatSchema.parse(req.body);

    const response = await sendToThesys(message);

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({
        code: "THESYS_EMPTY_RESPONSE",
        message: "Thesys returned an empty response.",
      });
    }

    res.json({
      message: content,
    });
  } catch (error) {
    next(error);
  }
});