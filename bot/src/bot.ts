import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import config from "./config.js";
import { setupCommands } from "./commands/index.js";
import { clearInstructionCache } from "./services/openai.js";
import express from "express";

const app = express();

const fetchSettings = async () => {
    try {
        const res = await fetch(`${config.apiBaseUrl}/settings`);
        const json: any = await res.json();
        if (json.success && json.data) {
            return {
                apiId: Number(json.data.apiId),
                apiHash: json.data.apiHash,
                stringSession: json.data.stringSession
            };
        }
    } catch (e) {
        console.error("Failed to fetch settings from API:", e);
    }
    return null;
};

export let client: TelegramClient | undefined;

export const startBot = async () => {
  console.log("Fetching configuration from DB...");
  const settings = await fetchSettings();


  const apiId = settings ? settings.apiId : config.apiId;
  const apiHash = settings ? settings.apiHash : config.apiHash;

  // Strict priority: If settings were fetched, use them (even if empty string)
  // Only fallback to config if settings fetch failed (null)
  const session = settings ? settings.stringSession : config.stringSession;

  if (!apiId || !apiHash) {
      console.error("Error: API_ID and API_HASH must be provided (in DB or .env)!");
      return; // Return instead of process.exit to allow retries/reload
  }

  if (!session) {
      console.error("Error: String Session is missing. Waiting for configuration...");
      return;
  }

  const stringSession = new StringSession(session);

  if (client) {
      console.log("Disconnecting old client...");
      await client.disconnect();
      client = undefined;
  }

  client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
  });

  console.log("Connecting to Telegram...");
  try {
      await client.start({
        phoneNumber: async () => "",
        password: async () => "",
        phoneCode: async () => "",
        onError: (err) => console.log(err),
      });
      console.log("Connected directly as Userbot!");

      // Setup event handlers
      setupCommands(client);
  } catch (error) {
      console.error("Failed to connect:", error);
  }
};


app.post("/reload", async (req, res) => {
    console.log("Received reload request. Restarting bot with new settings...");
    clearInstructionCache();
    await startBot();
    res.json({ success: true, message: "Bot restarted and cache cleared" });
});

app.use(express.json());

// --- Broadcast Worker (Polling Queue) ---
const processBroadcastJob = async (job: any) => {
    if (!client || !client.connected) return;
    console.log(`[Worker] Processing Broadcast ID: ${job.id}`);

    try {
        // 1. Mark Processing
        await fetch(`${config.apiBaseUrl}/broadcast`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: job.id, status: 'PROCESSING' })
        });

        // 2. Fetch Active Subs
        const subRes = await fetch(`${config.apiBaseUrl}/subscription`);
        const subJson: any = await subRes.json();
        if (!subJson.success || !Array.isArray(subJson.data)) {
            throw new Error("Failed to fetch subscribers");
        }

        const now = new Date();
        const targets = subJson.data.filter((s: any) => {
            const startDate = new Date(s.startDate);
            const endDate = s.endDate ? new Date(s.endDate) : null;
            return startDate <= now && (!endDate || endDate >= now);
        });

        let successCount = 0;
        let failCount = 0;
        const failedIds: string[] = [];

        // 3. Send Loop
        for (const sub of targets) {
            try {
                if (sub.userId) {
                    await client.sendMessage(sub.userId, { message: job.message });
                    successCount++;
                    await new Promise(r => setTimeout(r, 200)); // Rate limit
                }
            } catch (e) {
                failCount++;
                failedIds.push(sub.userId);
            }
        }

        // 4. Mark Completed
        await fetch(`${config.apiBaseUrl}/broadcast`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: job.id,
                status: 'COMPLETED',
                sentCount: successCount,
                failedCount: failCount,
                log: { failedIds }
            })
        });
        console.log(`[Worker] Broadcast ${job.id} Completed. Sent: ${successCount}, Failed: ${failCount}`);

    } catch (e: any) {
        console.error(`[Worker] Failed job ${job.id}:`, e);
        // Mark Failed
        await fetch(`${config.apiBaseUrl}/broadcast`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: job.id, status: 'FAILED', log: { error: e.message } })
        });
    }
};

const startBroadcastWorker = () => {
    setInterval(async () => {
        try {
            if (!client || !client.connected) return;
            // Fetch PENDING
            const res = await fetch(`${config.apiBaseUrl}/broadcast?status=PENDING`);
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    await processBroadcastJob(list[0]);
                }
            }
        } catch (e) {
            console.error("[Worker] Polling Error:", e);
        }
    }, 30000); // Check every 30s
    console.log("Broadcast Worker Started (Polling 30s).");
};

const startScheduler = () => {
    setInterval(async () => {
        try {
            // Fetch Schedules
            const res = await fetch(`${config.apiBaseUrl}/schedule`);
            if (!res.ok) return;
            const schedules = (await res.json()) as any[];

            // Egypt Time
            const egyptTime = new Date().toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour12: false }); // "14:30:05" or "14:30"
            const [currentH, currentM] = egyptTime.split(":").map(Number);

            const todayStr = new Date().toLocaleDateString("en-US", { timeZone: "Africa/Cairo" });

            for (const task of schedules) {
                if (!task.isActive) continue;

                // Check Time Match
                const [targetH, targetM] = task.time.split(":").map(Number);

                // Matches minute (simple check)
                if (currentH === targetH && currentM === targetM) {

                    // Check if already run today
                    if (task.lastRunAt) {
                        const lastRunDate = new Date(task.lastRunAt).toLocaleDateString("en-US", { timeZone: "Africa/Cairo" });
                        if (lastRunDate === todayStr) continue; // Already run today
                    }

                    console.log(`[Scheduler] Triggering Task ${task.id} at ${task.time}`);

                    // 1. Create Broadcast Job
                    await fetch(`${config.apiBaseUrl}/broadcast`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: task.message })
                    });

                    // 2. Update Last Run
                    await fetch(`${config.apiBaseUrl}/schedule`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: task.id, lastRunAt: new Date() })
                    });
                }
            }

        } catch (e) { console.error("[Scheduler] Error:", e); }
    }, 60000); // Every minute
    console.log("Scheduler Started (Checking every minute).");
};

// Start Workers
startBroadcastWorker();
startScheduler();

app.use(express.json());
// app.post("/broadcast") removed in favor of worker.

app.listen(config.reloadPort, () => {
    console.log(`Bot Server listening on port ${config.reloadPort}`);
});
