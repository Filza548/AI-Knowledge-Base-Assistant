import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const registerUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Z]/, "Must include uppercase")
    .regex(/[a-z]/, "Must include lowercase")
    .regex(/[0-9]/, "Must include a number"),
  role: z.enum(["viewer", "admin"]).default("viewer"),
});

export const chatSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  documentId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  documentId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
});

export const summarizeSchema = z.object({
  documentId: z.string().uuid(),
});

export const collectionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().uuid()).max(200).optional(),
});

export const collectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  documentIds: z.array(z.string().uuid()).max(200).optional(),
});

export const conversationCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  documentId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
});

export const conversationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
