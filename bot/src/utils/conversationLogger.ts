import fs from "fs/promises";
import path from "path";

const LOG_DIR = "logs";
const LOG_FILE = "conversations.csv";

const ensureLogDir = async () => {
  try {
    await fs.access(LOG_DIR);
  } catch {
    await fs.mkdir(LOG_DIR);
  }
};

const escapeCsv = (str: string) => {
  if (!str) return '""';
  // Escape double quotes by doubling them, wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
};

export const logConversation = async (
  userId: number | string,
  username: string = "Unknown",
  message: string,
  response: string
) => {
  // Only log in non-production environments
  if (process.env.NODE_ENV === "production") return;

  await ensureLogDir();
  const filePath = path.join(LOG_DIR, LOG_FILE);
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    await fs.writeFile(
      filePath,
      "Timestamp,UserID,Username,UserMessage,BotResponse\n",
      "utf8"
    );
  }

  const timestamp = new Date().toISOString();
  const line = `${timestamp},${userId},${escapeCsv(username)},${escapeCsv(
    message
  )},${escapeCsv(response)}\n`;

  await fs.appendFile(filePath, line, "utf8");
};
