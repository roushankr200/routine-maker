import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Router, type Request, type Response, type RequestHandler } from "express";
import mongoose, { Schema, Types } from "mongoose";
import { z } from "zod";
import { ClassSection, Teacher } from "./models.js";
import { getActiveDepartment } from "./departments.js";
import { scheduleWrite } from "./scheduleWrite.js";

const roles = ["admin", "teacher", "student"] as const;
type Role = typeof roles[number];
export interface AccountRecord {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  memberId?: Types.ObjectId;
}

const Account = mongoose.model<AccountRecord>("Account", new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: roles, required: true },
  passwordHash: { type: String, required: true },
  memberId: Schema.Types.ObjectId,
}));

const Session = mongoose.model("Session", new Schema({
  tokenHash: { type: String, required: true, unique: true },
  accountId: { type: Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}));

const sessionCookie = "routine_session";
const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest();
const key = promisify(scrypt);
const credentials = z.object({ email: z.string().trim().email().max(254).toLowerCase(), password: z.string().min(8).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(100), role: z.enum(roles), adminCode: z.string().max(200).optional() });

let adminCode: string | undefined;

export async function prepareAccounts() {
  await Promise.all([Account.init(), Session.init()]);
  adminCode = process.env.ADMIN_SIGNUP_CODE?.trim();
  if (adminCode || process.env.NODE_ENV === "production") return;
  const directory = new URL("../../.local/", import.meta.url);
  const codeFile = new URL("admin-signup-code", directory);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(codeFile, randomBytes(18).toString("base64url") + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  adminCode = (await readFile(codeFile, "utf8")).trim();
}

async function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${(await key(password, salt, 64) as Buffer).toString("hex")}`;
}

function tokenFrom(req: Request) {
  const value = (req.headers.cookie ?? "").split(";").map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  return value && /^[\da-f]{64}$/.test(value) ? digest(value).toString("hex") : undefined;
}

function publicAccount(account: AccountRecord) {
  return { id: account._id.toString(), name: account.name, email: account.email, role: account.role, memberId: account.memberId?.toString() ?? null };
}

async function signIn(res: Response, account: AccountRecord, status: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionDuration);
  await Session.create({ tokenHash: digest(token).toString("hex"), accountId: account._id, expiresAt });
  res.cookie(sessionCookie, token, { ...cookieOptions, expires: expiresAt }).status(status).json(publicAccount(account));
}

export function accountFor(res: Response): AccountRecord {
  return res.locals.account as AccountRecord;
}

export const requireAccount: RequestHandler = async (req, res, next) => {
  try {
    const tokenHash = tokenFrom(req);
    const session = tokenHash && await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean();
    const account = session && await Account.findById(session.accountId).lean();
    if (!account) return void res.status(401).json({ error: "Sign in to continue." });
    res.locals.account = account;
    next();
  } catch (error) { next(error); }
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (accountFor(res).role !== "admin") return void res.status(403).json({ error: "Administrator access is required." });
  next();
};

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

authRouter.post("/signup", async (req, res, next) => {
  const result = registration.safeParse(req.body);
  if (!result.success) return void res.status(400).json({ error: "Enter your name, a valid email and a password of 8–128 characters." });
  const { name, email, role, password, adminCode: submittedCode } = result.data;
  if (role === "admin" && (!adminCode || !submittedCode || !timingSafeEqual(digest(adminCode), digest(submittedCode)))) {
    return void res.status(403).json({ error: "Enter a valid administrator signup code." });
  }
  try {
    if (await Account.exists({ email })) return void res.status(409).json({ error: "An account with this email already exists." });
    await signIn(res, await Account.create({ name, email, role, passwordHash: await passwordHash(password) }), 201);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return void res.status(409).json({ error: "An account with this email already exists." });
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  const result = credentials.safeParse(req.body);
  if (!result.success) return void res.status(400).json({ error: "Enter a valid email and password." });
  try {
    const account = await Account.findOne({ email: result.data.email }).lean();
    const expected = account?.passwordHash ?? "00000000000000000000000000000000:" + "0".repeat(128);
    const actual = await passwordHash(result.data.password, expected.split(":")[0]);
    if (!account || !timingSafeEqual(digest(actual), digest(expected))) {
      return void res.status(401).json({ error: "The email or password is incorrect." });
    }
    await signIn(res, account, 200);
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAccount, (_req, res) => { res.json(publicAccount(accountFor(res))); });
authRouter.post("/logout", async (req, res, next) => {
  try {
    const tokenHash = tokenFrom(req);
    if (tokenHash) await Session.deleteOne({ tokenHash });
    res.clearCookie(sessionCookie, cookieOptions).sendStatus(204);
  } catch (error) { next(error); }
});

export const accountRouter = Router();
accountRouter.get("/", async (_req, res, next) => {
  try {
    res.json((await Account.find({ role: { $ne: "admin" } }).sort({ name: 1 }).lean()).map(publicAccount));
  } catch (error) { next(error); }
});

accountRouter.put("/:id", (req, res, next) => scheduleWrite(async () => {
  const memberId = req.body?.memberId;
  if (!mongoose.isValidObjectId(req.params.id) || (memberId !== null && (typeof memberId !== "string" || !mongoose.isValidObjectId(memberId)))) {
    return void res.status(400).json({ error: "Select a valid teacher or class section." });
  }
  try {
    const account = await Account.findOne({ _id: req.params.id, role: { $ne: "admin" } });
    if (!account) return void res.status(404).json({ error: "Account not found." });
    if (memberId === null) {
      account.memberId = undefined;
    } else {
      const department = await getActiveDepartment();
      if (department?.parentDepartmentId) return void res.status(409).json({ error: "Switch to the department’s main routine before linking accounts." });
      const filter = { _id: memberId, departmentId: department?._id };
      const target = department && (account.role === "teacher"
        ? await Teacher.exists({ ...filter, isPlaceholder: { $ne: true } })
        : await ClassSection.exists(filter));
      if (!target) return void res.status(400).json({ error: "Select a teacher or class section in the active department." });
      account.memberId = new Types.ObjectId(memberId);
    }
    await account.save();
    res.json(publicAccount(account));
  } catch (error) { next(error); }
}).catch(next));
