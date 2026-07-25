import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Z]/, "Must include uppercase")
  .regex(/[a-z]/, "Must include lowercase")
  .regex(/[0-9]/, "Must include a number");

/** Person display name: letters only (spaces / hyphen / apostrophe ok). No digits. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 letters")
  .max(120)
  .regex(
    /^[\p{L}][\p{L}\s'.-]*$/u,
    "Name must use letters only (numbers like 123 are not allowed)",
  );

/** Admin creates an active user with a password (legacy / optional). */
export const registerUserSchema = z.object({
  name: displayNameSchema,
  email: z.string().email().max(255),
  password: passwordSchema,
  role: z.enum(["assistant", "admin"]).default("assistant"),
});

/** Public self-signup — waits for admin approval. */
export const selfRegisterSchema = z.object({
  name: displayNameSchema,
  email: z.string().email().max(255),
  password: passwordSchema,
});

/** Admin invite by email (no password — user sets it or uses Google). */
export const inviteUserSchema = z.object({
  name: displayNameSchema,
  email: z.string().email().max(255),
  role: z.enum(["assistant", "admin"]).default("assistant"),
});

/** Accept invite: set password and activate. */
export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(128),
  name: displayNameSchema.optional(),
  password: passwordSchema,
});

/** Signed-in user updates own name / password (email is immutable). */
export const updateProfileSchema = z
  .object({
    name: displayNameSchema.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.newPassword !== undefined, {
    message: "Provide a name and/or a new password",
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
