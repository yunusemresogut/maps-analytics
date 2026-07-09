import { del, list, put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { mockUsers } from "@/data/users";

const ROOT_DB_PATH = path.join(process.cwd(), "data/local_db.json");
const SRC_DB_PATH = path.join(process.cwd(), "src/data/local_db.json");

function getDbPath() {
  if (fs.existsSync(ROOT_DB_PATH)) {
    return ROOT_DB_PATH;
  }
  if (fs.existsSync(SRC_DB_PATH)) {
    try {
      // Migrate existing local_db.json from src/data to data (root level)
      // to prevent Next.js dev server from recompiling/reloading on every file write.
      fs.mkdirSync(path.dirname(ROOT_DB_PATH), { recursive: true });
      fs.copyFileSync(SRC_DB_PATH, ROOT_DB_PATH);
      return ROOT_DB_PATH;
    } catch (err) {
      console.error("Migration to root DB path failed, using src DB path:", err);
      return SRC_DB_PATH;
    }
  }
  return ROOT_DB_PATH;
}

function getInitialData() {
  return {
    stores: [],
    storeData: {},
    users: mockUsers,
    activityLogs: [],
  };
}

function isBlobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Private helper to read raw database from source without queueing (caller must queue)
async function _readDb(): Promise<any> {
  try {
    if (isBlobConfigured()) {
      const { blobs } = await list();
      const dbBlobs = blobs.filter(
        (b) => b.pathname.startsWith("db") && b.pathname.endsWith(".json")
      );

      if (dbBlobs.length > 0) {
        // Sort descending by uploadedAt to get the latest version
        dbBlobs.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        const latestBlob = dbBlobs[0];

        const response = await fetch(`${latestBlob.url}?t=${Date.now()}`, {
          cache: "no-store",
        });
        return await response.json();
      }
    } else {
      const dbPath = getDbPath();
      if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, "utf-8");
        return JSON.parse(fileContent);
      }
    }
  } catch (error) {
    console.error("Error reading database:", error);
  }
  return getInitialData();
}

// Private helper to write raw database to source without queueing (caller must queue)
async function _writeDb(db: any): Promise<void> {
  if (isBlobConfigured()) {
    // Write new blob with a random suffix (guarantees a unique URL that bypasses CDN cache)
    await put("db.json", JSON.stringify(db), {
      access: "public",
      addRandomSuffix: true,
    });

    // Clean up older database blobs asynchronously to avoid storage bloat
    try {
      const { blobs } = await list();
      const dbBlobs = blobs.filter(
        (b) => b.pathname.startsWith("db") && b.pathname.endsWith(".json")
      );
      
      // Sort by uploadedAt descending
      dbBlobs.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      
      // The newest one is dbBlobs[0]. Delete all others.
      const latestUrl = dbBlobs[0]?.url;
      const oldBlobs = dbBlobs.filter((b) => b.url !== latestUrl);
      
      for (const old of oldBlobs) {
        try {
          await del(old.url);
        } catch (delErr) {
          console.error("Error deleting old blob version:", delErr);
        }
      }
    } catch (cleanupErr) {
      console.error("Error cleaning up old blobs:", cleanupErr);
    }
  } else {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }
}

// Shared promise chain for serialization (Mutex Queue)
let dbQueue = Promise.resolve();

async function runInQueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = dbQueue.then(operation);
  dbQueue = result.catch(() => {}) as Promise<any>;
  return result;
}

// Public API
export async function getDb(): Promise<any> {
  return runInQueue(async () => {
    return await _readDb();
  });
}

export async function updateDb(payload: any): Promise<any> {
  return runInQueue(async () => {
    const db = await _readDb();
    
    // Merge payload keys. If a key is passed, we overwrite or merge it.
    const updated = {
      ...db,
      ...payload,
    };
    
    await _writeDb(updated);
    return updated;
  });
}

export async function addActivityLog(entry: any): Promise<any> {
  return runInQueue(async () => {
    const db = await _readDb();
    const logs = [entry, ...(db.activityLogs ?? [])].slice(0, 500);
    db.activityLogs = logs;
    await _writeDb(db);
    return db;
  });
}

export async function clearActivityLogs(): Promise<any> {
  return runInQueue(async () => {
    const db = await _readDb();
    db.activityLogs = [];
    await _writeDb(db);
    return db;
  });
}
