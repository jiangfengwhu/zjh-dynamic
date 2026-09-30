import { getAppContext } from "@zijinhua/app-sdk";
const { get: readPackageValue, set: writePackageValue, subscribe: subscribePackageValue } = getAppContext().storage;

export type PomodoroStats = {
  date: string;
  flowers: number;
};

const STATS_KEY = "stats";

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function readPomodoroStats(): PomodoroStats {
  const raw = readPackageValue(STATS_KEY);
  const today = getTodayString();
  if (!raw) return { date: today, flowers: 0 };
  try {
    const parsed = JSON.parse(raw) as PomodoroStats;
    if (parsed.date === today) {
      return parsed;
    }
    // New day
    return { date: today, flowers: 0 };
  } catch {
    return { date: today, flowers: 0 };
  }
}

export function writePomodoroStats(stats: PomodoroStats) {
  writePackageValue(STATS_KEY, JSON.stringify(stats));
}

export function subscribePomodoroStats(listener: (stats: PomodoroStats) => void): () => void {
  return subscribePackageValue(STATS_KEY, (value) => {
    const today = getTodayString();
    if (!value) {
      listener({ date: today, flowers: 0 });
      return;
    }
    try {
      const parsed = JSON.parse(value) as PomodoroStats;
      if (parsed.date === today) {
        listener(parsed);
      } else {
        listener({ date: today, flowers: 0 });
      }
    } catch {
      listener({ date: today, flowers: 0 });
    }
  });
}

export function addPomodoroFlower() {
  const current = readPomodoroStats();
  const today = getTodayString();
  writePomodoroStats({ date: today, flowers: current.flowers + 1 });
}
