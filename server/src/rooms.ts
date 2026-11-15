import mongoose, { Schema } from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { Department, RoutineEntry } from "./models.js";
import { publishedRoutineScope } from "./departments.js";
import { roomSlot, type RoomConstraints } from "./solver/types.js";
import { scheduleWrite } from "./scheduleWrite.js";

const roomFields = z.object({
  number: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  floor: z.number().int().min(0).max(30),
  capacity: z.number().int().min(1).max(10000),
  type: z.enum(["theory", "lab"]),
});
type RoomFields = z.infer<typeof roomFields>;

export const Room = mongoose.model<RoomFields>("Room", new Schema({
  number: { type: String, unique: true, required: true },
  floor: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, required: true, enum: ["theory", "lab"] },
}));

const roomsByFloor: [number, [string, number, RoomFields["type"]?][]][] = [
  [0, [["G-6", 120], ["G7", 120], ["G-8", 80]]],
  [1, [["119", 80], ["123", 30], ["124", 30], ["121", 120], ["122", 120], ["125", 60], ["102", 60, "lab"], ["103", 60, "lab"]]],
  [2, [["219", 80], ["223", 30], ["224", 30], ["221", 120], ["222", 120], ["225", 60], ["226", 120], ["202", 60, "lab"], ["203", 60, "lab"]]],
];

export async function addDefaultRooms(): Promise<void> {
  await Room.init();
  if (await Room.exists({})) return;
  await Room.bulkWrite(roomsByFloor.flatMap(([floor, rooms]) => rooms.map(([number, capacity, type = "theory"]) => ({
    updateOne: { filter: { number }, update: { $setOnInsert: { number, floor, capacity, type } }, upsert: true },
  }))));
}

export async function otherRoomReservations(departmentId: string) {
  const active = await Department.findById(departmentId).select("parentDepartmentId").lean();
  return Department.find({ parentDepartmentId: null, _id: { $ne: active?.parentDepartmentId ?? departmentId } }).select("publicationId").lean();
}

export async function roomConstraints(departmentId: string, classSizes: Map<string, number>): Promise<RoomConstraints> {
  const departments = await otherRoomReservations(departmentId);
  const [rooms, otherEntries] = await Promise.all([
    Room.find().sort({ capacity: 1, number: 1 }).lean(),
    departments.length ? RoutineEntry.find({ $or: departments.map(publishedRoutineScope), roomId: { $exists: true } }).lean() : [],
  ]);
  const reserved = new Set(otherEntries.flatMap((entry) => entry.roomId
    ? [roomSlot(entry.roomId.toString(), entry.day, entry.period)] : []));
  return { rooms: rooms.map((room) => ({ ...room, id: room._id.toString() })), classSizes, reserved };
}

export const roomRouter = Router();

roomRouter.get("/", async (_req, res, next) => {
  try {
    const rooms = await Room.find().sort({ floor: 1, number: 1 }).lean();
    res.json(rooms.map(({ _id, number, floor, capacity, type }) => ({ id: _id.toString(), number, floor, capacity, type })));
  } catch (error) { next(error); }
});

roomRouter.post("/", (req, res, next) => scheduleWrite(async () => {
  const parsed = roomFields.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Enter a room number, floor, type and positive seating capacity." });
  try {
    if (await Room.exists({ number: parsed.data.number })) return void res.status(409).json({ error: "That room number already exists." });
    await Room.create(parsed.data);
    res.status(201).json({ message: "Room added." });
  } catch (error) { next(error); }
}).catch(next));

roomRouter.put("/:id", (req, res, next) => scheduleWrite(async () => {
  const parsed = roomFields.safeParse(req.body);
  if (!parsed.success || !mongoose.isValidObjectId(req.params.id)) return void res.status(400).json({ error: "Enter valid room details." });
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return void res.status(404).json({ error: "Room not found." });
    if (await Room.exists({ number: parsed.data.number, _id: { $ne: room._id } })) {
      return void res.status(409).json({ error: "That room number already exists." });
    }
    if ((parsed.data.capacity < room.capacity || parsed.data.type !== room.type) && await RoutineEntry.exists({ roomId: room._id })) {
      return void res.status(409).json({ error: "Clear routines that use this room before reducing its capacity or changing its type." });
    }
    await room.set(parsed.data).save();
    res.json({ message: "Room updated." });
  } catch (error) { next(error); }
}).catch(next));
