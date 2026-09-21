import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
export async function store(buffer: Buffer) {
  await mkdir(config.uploads, { recursive: true });
  const id = randomUUID();
  await writeFile(resolve(config.uploads, id), buffer, { flag: "wx" });
  return id;
}
export async function read(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid storage reference");
  return readFile(resolve(config.uploads, id));
}
