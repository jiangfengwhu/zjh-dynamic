import { readPackageValue, writePackageValue, subscribePackageValue } from "../../ui/packageLink";

export type HabitData = {
  streak: number;
  lastCheckIn: string; // YYYY-MM-DD
  waterCount: number;
  waterDate: string; // YYYY-MM-DD
  sleepDate: string; // YYYY-MM-DD
  stickers: string[]; // List of sticker IDs earned
};

const STORAGE_KEY = "habit.data";

const defaultData: HabitData = {
  streak: 0,
  lastCheckIn: "",
  waterCount: 0,
  waterDate: "",
  sleepDate: "",
  stickers: [],
};

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function readHabitData(): HabitData {
  const raw = readPackageValue(STORAGE_KEY);
  if (!raw) return { ...defaultData };
  try {
    const data = JSON.parse(raw) as HabitData;
    // reset daily counters if date changed
    const today = getTodayStr();
    let updated = false;

    if (data.waterDate !== today) {
      data.waterCount = 0;
      data.waterDate = today;
      updated = true;
    }

    // Check streak
    if (data.lastCheckIn !== today && data.lastCheckIn !== getYesterdayStr() && data.lastCheckIn !== "") {
       data.streak = 0;
       updated = true;
    }

    if (updated) {
       writeHabitData(data);
    }

    return data;
  } catch {
    return { ...defaultData };
  }
}

export function writeHabitData(data: HabitData) {
  writePackageValue(STORAGE_KEY, JSON.stringify(data));
}

export function subscribeHabitData(listener: (data: HabitData) => void): () => void {
  return subscribePackageValue(STORAGE_KEY, (raw) => {
    if (!raw) {
      listener({ ...defaultData });
      return;
    }
    try {
      listener(JSON.parse(raw));
    } catch {
      listener({ ...defaultData });
    }
  });
}
