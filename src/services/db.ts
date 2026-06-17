import { supabase, isSupabaseConfigured } from "./supabase";
import { getCurrentUser } from "./auth";

// --- Types ---
export interface Garden {
  id: string;
  user_id: string;
  name: string;
  description: string;
  cover_image: string;
  created_at: string;
}

export interface Plant {
  id: string;
  user_id: string;
  garden_id: string | null;
  name: string;
  species: string;
  location: string;
  planting_date: string;
  status: "healthy" | "flowering" | "fruiting" | "dormant" | "sick";
  notes: string;
  cover_image: string;
  archived: boolean;
  last_watered_at?: string | null;
  created_at: string;
}

export type ActivityType =
  | "watering"
  | "fertilizing"
  | "pruning"
  | "repotting"
  | "pest_control"
  | "observation"
  | "flowering"
  | "harvest"
  | "bulk_watering";

export interface Activity {
  id: string;
  user_id: string;
  plant_id: string;
  type: ActivityType;
  date: string;
  details: string;
  notes: string;
  photo_url?: string;
  created_at: string;
  
  // Joined fields
  plant_name?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  plant_id: string;
  type: ActivityType;
  interval_days: number;
  start_date: string;
  last_performed: string | null;
  created_at: string;

  // Calculated client-side fields
  next_due_date?: string;
  task_status?: "due" | "overdue" | "upcoming" | "pending";
  plant_name?: string;
  plant_cover_image?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title_en: string;
  title_th: string;
  message_en: string;
  message_th: string;
  type: "due" | "upcoming" | "overdue";
  read: boolean;
  created_at: string;
}

export interface BulkWateringHistory {
  id: string;
  user_id: string;
  watered_at: string;
  affected_plants_count: number;
  created_at: string;
}

// --- Fertilizer Types ---
export type FertilizerType = "granular" | "liquid" | "organic" | "compost" | "foliar" | "other";

export interface Fertilizer {
  id: string;
  user_id: string;
  name: string;
  npk_formula: string;
  type: FertilizerType;
  default_interval_days: number;
  color: string;
  description: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  usage_count?: number;
}

export interface PlantFertilizer {
  id: string;
  user_id: string;
  plant_id: string;
  fertilizer_id: string;
  interval_days: number;
  last_applied_date: string | null;
  next_due_date: string | null;
  active: boolean;
  created_at: string;
  // Joined fields
  fertilizer_name?: string;
  fertilizer_npk?: string;
  fertilizer_color?: string;
  fertilizer_type?: FertilizerType;
  plant_name?: string;
  task_status?: "due" | "overdue" | "upcoming" | "pending";
}

export interface FertilizerHistory {
  id: string;
  user_id: string;
  plant_id: string;
  fertilizer_id: string;
  applied_date: string;
  amount: string;
  note: string;
  created_at: string;
  // Joined fields
  plant_name?: string;
  fertilizer_name?: string;
  fertilizer_npk?: string;
  fertilizer_color?: string;
}

// --- Local Storage Keys ---
const GARDENS_KEY = "plant_tracker_gardens";
const PLANTS_KEY = "plant_tracker_plants";
const ACTIVITIES_KEY = "plant_tracker_activities";
const SCHEDULES_KEY = "plant_tracker_schedules";
const NOTIFICATIONS_KEY = "plant_tracker_notifications";
const FERTILIZERS_KEY = "plant_tracker_fertilizers";
const PLANT_FERTILIZERS_KEY = "plant_tracker_plant_fertilizers";
const FERTILIZER_HISTORY_KEY = "plant_tracker_fertilizer_history";

// --- In-memory Plants Cache ---
// Keyed by "gardenId:includeArchived". Shared promise prevents duplicate parallel fetches.
const _plantsCache = new Map<string, Plant[]>();
const _plantsResolving = new Map<string, Promise<Plant[]>>();

const plantsCacheKey = (gardenId: string | null, includeArchived: boolean) =>
  `${gardenId ?? ""}:${includeArchived}`;

export const invalidatePlantsCache = () => {
  _plantsCache.clear();
  _plantsResolving.clear();
};

// --- Date Calculation Helpers ---
export const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const calculateNextDueDate = (startDateStr: string, intervalDays: number, lastPerformedStr: string | null): Date => {
  const base = lastPerformedStr ? new Date(lastPerformedStr) : new Date(startDateStr);
  const next = new Date(base);
  next.setDate(next.getDate() + intervalDays);
  return next;
};

export const determineTaskStatus = (nextDue: Date): "due" | "overdue" | "upcoming" | "pending" => {
  const today = getStartOfDay(new Date());
  const dueDay = getStartOfDay(nextDue);
  
  const diffTime = dueDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due";
  if (diffDays <= 7) return "upcoming";
  return "pending";
};

// Expand Schedule with dynamic computations
export const enrichSchedule = (schedule: Schedule, plants: Plant[]): Schedule => {
  const plant = plants.find(p => p.id === schedule.plant_id);
  const nextDue = calculateNextDueDate(schedule.start_date, schedule.interval_days, schedule.last_performed);
  
  return {
    ...schedule,
    next_due_date: nextDue.toISOString(),
    task_status: determineTaskStatus(nextDue),
    plant_name: plant ? plant.name : "Unknown Plant",
    plant_cover_image: plant ? plant.cover_image : "",
  };
};

// --- Mock Data Hydration ---
const getLocalStorageData = <T>(key: string, defaultData: T[]): T[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(key, JSON.stringify(defaultData));
  return defaultData;
};

const saveLocalStorageData = <T>(key: string, data: T[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

const DEFAULT_GARDENS = (userId: string): Garden[] => [
  {
    "id": "g-1",
    "user_id": userId,
    "name": "ไม้ดอก",
    "description": "ไม้ดอก collection",
    "cover_image": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=600&auto=format&fit=crop",
    "created_at": "2026-05-11T10:54:45.278Z"
  },
  {
    "id": "g-2",
    "user_id": userId,
    "name": "สมุนไพร",
    "description": "สมุนไพร collection",
    "cover_image": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=600&auto=format&fit=crop",
    "created_at": "2026-05-11T10:54:45.282Z"
  },
  {
    "id": "g-3",
    "user_id": userId,
    "name": "ไม้ประดับ",
    "description": "ไม้ประดับ collection",
    "cover_image": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop",
    "created_at": "2026-05-11T10:54:45.282Z"
  },
  {
    "id": "g-4",
    "user_id": userId,
    "name": "ไม้ใบ",
    "description": "ไม้ใบ collection",
    "cover_image": "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop",
    "created_at": "2026-05-11T10:54:45.282Z"
  }
];

const DEFAULT_PLANTS = (userId: string): Plant[] => [
  {
    "id": "p-1",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "เดซี่ 1",
    "species": "Bellis perennis",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-2",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "เดซี่ 2",
    "species": "Bellis perennis",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1606041008023-472dfb5e530f?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-3",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "กุหลาบพุ่มเล็ก",
    "species": "Rosa (Miniature Rose)",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: 🌸 ดอก (8-24-24). ",
    "cover_image": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-4",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "แพรเซี่ยงไฮ้",
    "species": "Portulaca grandiflora",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-5",
    "user_id": userId,
    "garden_id": "g-2",
    "name": "โรสแมรี่",
    "species": "Salvia rosmarinus",
    "location": "สมุนไพร",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1515589654462-a9881e276b8a?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-6",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "เบญจมาศเงิน",
    "species": "Crossostephium chinense",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1508784411316-02b8cd4d3a3a?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-7",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "บานชื่นแคระ",
    "species": "Zinnia elegans",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1596742572443-023f57baa755?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-8",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "มะลิ",
    "species": "Jasminum sambac",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: 🌸 ดอก (8-24-24). ",
    "cover_image": "https://images.unsplash.com/photo-1508784411316-02b8cd4d3a3a?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-9",
    "user_id": userId,
    "garden_id": "g-3",
    "name": "หลิวใต้หวัน",
    "species": "Cuphea hyssopifolia",
    "location": "ไม้ประดับ",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-10",
    "user_id": userId,
    "garden_id": "g-4",
    "name": "หัวใจเศรษฐี",
    "species": "Ficus triangularis variegata",
    "location": "ไม้ใบ",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ⚖️ กลาง (16-16-16). ",
    "cover_image": "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-11",
    "user_id": userId,
    "garden_id": "g-2",
    "name": "กระเพรา (เพาะ)",
    "species": "Ocimum tenuiflorum",
    "location": "สมุนไพร",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ยังไม่ใส่. ",
    "cover_image": "https://images.unsplash.com/photo-1618173745284-8840a2c00a0a?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-12",
    "user_id": userId,
    "garden_id": "g-2",
    "name": "โหระพา (เพาะ)",
    "species": "Ocimum basilicum",
    "location": "สมุนไพร",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: ยังไม่ใส่. ",
    "cover_image": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  },
  {
    "id": "p-13",
    "user_id": userId,
    "garden_id": "g-1",
    "name": "กุหลาบมงมาร์ต",
    "species": "Rosa (Montmartre)",
    "location": "ไม้ดอก",
    "planting_date": "2026-04-01",
    "status": "healthy",
    "notes": "ปุ๋ยหลัก: 🌸 ดอก (8-24-24). ",
    "cover_image": "https://images.unsplash.com/photo-1558244481-9b16869408b8?q=80&w=400&auto=format&fit=crop",
    "archived": false,
    "created_at": "2026-05-13T10:54:45.282Z"
  }
];

const DEFAULT_ACTIVITIES = (userId: string): Activity[] => [
  {
    "id": "a-1",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-2",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-3",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-4",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-5",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-6",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-7",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-8",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-9",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-10",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "fertilizing",
    "date": "2026-04-30T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-04-30T00:00:00.000Z"
  },
  {
    "id": "a-11",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-12",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-13",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-14",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-15",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-16",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-17",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-18",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-19",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-20",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "watering",
    "date": "2026-05-06T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "a-21",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "fertilizing",
    "date": "2026-05-07T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌱 อินทรีย์ (0-0-0)",
    "notes": "",
    "created_at": "2026-05-07T00:00:00.000Z"
  },
  {
    "id": "a-22",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "fertilizing",
    "date": "2026-05-07T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌱 อินทรีย์ (0-0-0)",
    "notes": "",
    "created_at": "2026-05-07T00:00:00.000Z"
  },
  {
    "id": "a-23",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "pruning",
    "date": "2026-05-08T00:00:00.000Z",
    "details": "ตัดแต่งกิ่งก้าน: บำรุงฟื้นฟู",
    "notes": "",
    "created_at": "2026-05-08T00:00:00.000Z"
  },
  {
    "id": "a-24",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "date": "2026-05-09T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-09T00:00:00.000Z"
  },
  {
    "id": "a-25",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "watering",
    "date": "2026-05-12T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-12T00:00:00.000Z"
  },
  {
    "id": "a-26",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-27",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-28",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-29",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-30",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-31",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-32",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-33",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "date": "2026-05-14T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "a-34",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-35",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "pruning",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ตัดแต่งกิ่งก้าน: บำรุงฟื้นฟู",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-36",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-37",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-38",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-39",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-40",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-41",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-42",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-43",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-44",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-45",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดพ่นน้ำทางใบและสารบำรุง",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-46",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "repotting",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "เปลี่ยนดินย้ายกระถางบำรุงราก",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-47",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "watering",
    "date": "2026-05-16T00:00:00.000Z",
    "details": "ฉีดรดน้ำลงหน้าดิน",
    "notes": "",
    "created_at": "2026-05-16T00:00:00.000Z"
  },
  {
    "id": "a-48",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "pruning",
    "date": "2026-05-20T00:00:00.000Z",
    "details": "ตัดแต่งกิ่งก้าน: บำรุงฟื้นฟู",
    "notes": "",
    "created_at": "2026-05-20T00:00:00.000Z"
  },
  {
    "id": "a-49",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "fertilizing",
    "date": "2026-05-21T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-21T00:00:00.000Z"
  },
  {
    "id": "a-50",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "pruning",
    "date": "2026-05-27T00:00:00.000Z",
    "details": "ตัดแต่งกิ่งก้าน: บำรุงฟื้นฟู",
    "notes": "",
    "created_at": "2026-05-27T00:00:00.000Z"
  },
  {
    "id": "a-51",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "date": "2026-05-27T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-27T00:00:00.000Z"
  },
  {
    "id": "a-52",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "fertilizing",
    "date": "2026-05-27T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-05-27T00:00:00.000Z"
  },
  {
    "id": "a-53",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-54",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-55",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-56",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-57",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-58",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-59",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-60",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "fertilizing",
    "date": "2026-06-03T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: ⚖️ กลาง (16-16-16)",
    "notes": "",
    "created_at": "2026-06-03T00:00:00.000Z"
  },
  {
    "id": "a-61",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "date": "2026-06-09T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-06-09T00:00:00.000Z"
  },
  {
    "id": "a-62",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "fertilizing",
    "date": "2026-06-09T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-06-09T00:00:00.000Z"
  },
  {
    "id": "a-63",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "fertilizing",
    "date": "2026-06-09T00:00:00.000Z",
    "details": "ใส่ปุ๋ยเคมี: 🌸 ดอก (8-24-24)",
    "notes": "",
    "created_at": "2026-06-09T00:00:00.000Z"
  }
];

const DEFAULT_SCHEDULES = (userId: string): Schedule[] => [
  {
    "id": "s-1",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-1",
    "user_id": userId,
    "plant_id": "p-1",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-2",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-2",
    "user_id": userId,
    "plant_id": "p-2",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-3",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "fertilizing",
    "interval_days": 10,
    "start_date": "2026-06-09",
    "last_performed": "2026-06-09T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-3",
    "user_id": userId,
    "plant_id": "p-3",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-4",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-4",
    "user_id": userId,
    "plant_id": "p-4",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-5",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-5",
    "user_id": userId,
    "plant_id": "p-5",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-6",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-6",
    "user_id": userId,
    "plant_id": "p-6",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-7",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-7",
    "user_id": userId,
    "plant_id": "p-7",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-8",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "fertilizing",
    "interval_days": 10,
    "start_date": "2026-06-09",
    "last_performed": "2026-06-09T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-8",
    "user_id": userId,
    "plant_id": "p-8",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-9",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-9",
    "user_id": userId,
    "plant_id": "p-9",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-10",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "fertilizing",
    "interval_days": 14,
    "start_date": "2026-06-03",
    "last_performed": "2026-06-03T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-10",
    "user_id": userId,
    "plant_id": "p-10",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-11",
    "user_id": userId,
    "plant_id": "p-11",
    "type": "watering",
    "interval_days": 1,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-12",
    "user_id": userId,
    "plant_id": "p-12",
    "type": "watering",
    "interval_days": 1,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-13",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "fertilizing",
    "interval_days": 10,
    "start_date": "2026-06-09",
    "last_performed": "2026-06-09T00:00:00.000Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  },
  {
    "id": "s-water-13",
    "user_id": userId,
    "plant_id": "p-13",
    "type": "watering",
    "interval_days": 2,
    "start_date": "2026-06-01",
    "last_performed": "2026-06-09T10:54:45.282Z",
    "created_at": "2026-05-16T10:54:45.282Z"
  }
];

// Hydrates local arrays for an authenticated user
const loadLocalDatabase = (userId: string) => {
  const gardens = getLocalStorageData(GARDENS_KEY, DEFAULT_GARDENS(userId)).filter(x => x.user_id === userId);
  const plants = getLocalStorageData(PLANTS_KEY, DEFAULT_PLANTS(userId)).filter(x => x.user_id === userId);
  const activities = getLocalStorageData(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(userId)).filter(x => x.user_id === userId);
  const schedules = getLocalStorageData(SCHEDULES_KEY, DEFAULT_SCHEDULES(userId)).filter(x => x.user_id === userId);
  const notifications = getLocalStorageData<Notification>(NOTIFICATIONS_KEY, []).filter(x => x.user_id === userId);
  
  return { gardens, plants, activities, schedules, notifications };
};

// --- Database Operations Wrapper ---

export const getGardens = async (): Promise<Garden[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("gardens")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  return db.gardens;
};

export const createGarden = async (name: string, description: string, coverImage: string): Promise<Garden> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const newGarden = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    description,
    cover_image: coverImage || "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=600&auto=format&fit=crop",
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("gardens")
      .insert(newGarden)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  const allGardens = getLocalStorageData<Garden>(GARDENS_KEY, DEFAULT_GARDENS(user.id));
  allGardens.push(newGarden);
  saveLocalStorageData(GARDENS_KEY, allGardens);
  return newGarden;
};

export const updateGarden = async (id: string, updates: Partial<Garden>): Promise<Garden> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("gardens")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Local Storage Fallback
  const allGardens = getLocalStorageData<Garden>(GARDENS_KEY, DEFAULT_GARDENS(user.id));
  const idx = allGardens.findIndex(g => g.id === id && g.user_id === user.id);
  if (idx === -1) throw new Error("Garden not found");
  
  const updated = { ...allGardens[idx], ...updates };
  allGardens[idx] = updated;
  saveLocalStorageData(GARDENS_KEY, allGardens);
  return updated;
};

export const deleteGarden = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("gardens")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  // Local Storage Fallback
  const allGardens = getLocalStorageData<Garden>(GARDENS_KEY, DEFAULT_GARDENS(user.id));
  const filteredGardens = allGardens.filter(g => !(g.id === id && g.user_id === user.id));
  saveLocalStorageData(GARDENS_KEY, filteredGardens);

  // Cascade delete or set null on plants
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
  const updatedPlants = allPlants.map(p => {
    if (p.garden_id === id && p.user_id === user.id) {
      return { ...p, garden_id: null };
    }
    return p;
  });
  saveLocalStorageData(PLANTS_KEY, updatedPlants);
};

export const getPlants = async (gardenId: string | null = null, includeArchived: boolean = false): Promise<Plant[]> => {
  const cacheKey = plantsCacheKey(gardenId, includeArchived);

  // Return cached result immediately
  if (_plantsCache.has(cacheKey)) return _plantsCache.get(cacheKey)!;

  // Reuse in-flight promise for parallel callers
  if (_plantsResolving.has(cacheKey)) return _plantsResolving.get(cacheKey)!;

  const promise = (async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      let result: Plant[];

      if (isSupabaseConfigured && supabase) {
        let query = supabase.from("plants").select("*").eq("user_id", user.id);
        if (gardenId) query = query.eq("garden_id", gardenId);
        if (!includeArchived) query = query.eq("archived", false);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        result = data || [];
      } else {
        // Local Storage Fallback
        const db = loadLocalDatabase(user.id);
        let list = db.plants;
        if (gardenId) list = list.filter(p => p.garden_id === gardenId);
        if (!includeArchived) list = list.filter(p => !p.archived);
        result = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      _plantsCache.set(cacheKey, result);
      return result;
    } finally {
      _plantsResolving.delete(cacheKey);
    }
  })();

  _plantsResolving.set(cacheKey, promise);
  return promise;
};

export const getPlantById = async (id: string): Promise<Plant | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("plants")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) return null;
    return data;
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  const found = db.plants.find(p => p.id === id);
  return found || null;
};

export const createPlant = async (plant: Omit<Plant, "id" | "user_id" | "archived" | "created_at">): Promise<Plant> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const newPlant: Plant = {
    ...plant,
    id: crypto.randomUUID(),
    user_id: user.id,
    archived: false,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("plants")
      .insert(newPlant)
      .select()
      .single();
    if (error) throw error;
    invalidatePlantsCache();
    return data;
  }

  // Local Storage Fallback
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
  allPlants.push(newPlant);
  saveLocalStorageData(PLANTS_KEY, allPlants);
  invalidatePlantsCache();
  return newPlant;
};

export const updatePlant = async (id: string, updates: Partial<Plant>): Promise<Plant> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("plants")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    invalidatePlantsCache();
    return data;
  }

  // Local Storage Fallback
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
  const idx = allPlants.findIndex(p => p.id === id && p.user_id === user.id);
  if (idx === -1) throw new Error("Plant not found");

  const updated = { ...allPlants[idx], ...updates };
  allPlants[idx] = updated;
  saveLocalStorageData(PLANTS_KEY, allPlants);
  invalidatePlantsCache();
  return updated;
};

export const deletePlant = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("plants")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    invalidatePlantsCache();
    return;
  }

  // Local Storage Fallback
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
  saveLocalStorageData(PLANTS_KEY, allPlants.filter(p => !(p.id === id && p.user_id === user.id)));

  // Cascade delete activities & schedules
  const allActs = getLocalStorageData<Activity>(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(user.id));
  saveLocalStorageData(ACTIVITIES_KEY, allActs.filter(a => !(a.plant_id === id && a.user_id === user.id)));

  const allScheds = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  saveLocalStorageData(SCHEDULES_KEY, allScheds.filter(s => !(s.plant_id === id && s.user_id === user.id)));
  invalidatePlantsCache();
};

export const archivePlant = async (id: string, archiveState: boolean): Promise<Plant> => {
  return updatePlant(id, { archived: archiveState });
};

export const getActivities = async (plantId: string | null = null, limit: number | null = null): Promise<Activity[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from("activities")
      .select(`
        *,
        plants:plant_id(name)
      `)
      .eq("user_id", user.id)
      .neq("type", "watering");
      
    if (plantId) query = query.eq("plant_id", plantId);
    query = query.order("date", { ascending: false });
    
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    
    const mapped = (data || []).map((a: any) => ({
      ...a,
      plant_name: a.plants?.name || "Unknown Plant"
    }));

    let bulkActivities: Activity[] = [];
    if (!plantId) {
      let bulkQuery = supabase
        .from("bulk_watering_history")
        .select("*")
        .eq("user_id", user.id)
        .order("watered_at", { ascending: false });
      if (limit) bulkQuery = bulkQuery.limit(limit);
      const { data: bulkData, error: bulkError } = await bulkQuery;
      if (!bulkError && bulkData) {
        bulkActivities = bulkData.map((b: any) => ({
          id: b.id,
          user_id: b.user_id,
          plant_id: "bulk",
          type: "bulk_watering" as ActivityType,
          date: b.watered_at,
          details: String(b.affected_plants_count),
          notes: "",
          created_at: b.created_at,
          plant_name: "ทุกต้น"
        }));
      }
    }

    const combined = [...mapped, ...bulkActivities];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (limit) return combined.slice(0, limit);
    return combined;
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  let list = db.activities.filter(a => a.type !== "watering");
  if (plantId) list = list.filter(a => a.plant_id === plantId);

  const mapped = list.map(a => {
    const plant = db.plants.find(p => p.id === a.plant_id);
    return {
      ...a,
      plant_name: plant ? plant.name : "Unknown Plant"
    };
  });

  let bulkActivities: Activity[] = [];
  if (!plantId) {
    const storedBulk = getLocalStorageData<any>("plant_tracker_bulk_watering_history", []).filter(b => b.user_id === user.id);
    bulkActivities = storedBulk.map((b: any) => ({
      id: b.id,
      user_id: b.user_id,
      plant_id: "bulk",
      type: "bulk_watering" as ActivityType,
      date: b.watered_at,
      details: String(b.affected_plants_count),
      notes: "",
      created_at: b.created_at,
      plant_name: "ทุกต้น"
    }));
  }

  const combined = [...mapped, ...bulkActivities];
  combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (limit) return combined.slice(0, limit);
  return combined;
};
export const createActivity = async (activity: Omit<Activity, "id" | "user_id" | "created_at">): Promise<Activity> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  let activityDate = activity.date;
  if (activityDate && activityDate.length === 10) {
    const todayLocal = new Date().toLocaleDateString("sv-SE");
    if (activityDate === todayLocal) {
      activityDate = new Date().toISOString();
    } else {
      activityDate = new Date(`${activityDate}T00:00:00`).toISOString();
    }
  }

  const newActivity: Activity = {
    ...activity,
    date: activityDate,
    id: crypto.randomUUID(),
    user_id: user.id,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("activities")
      .insert(newActivity)
      .select()
      .single();
    if (error) throw error;
    return newActivity;
  }

  // Local Storage Fallback
  const allActivities = getLocalStorageData<Activity>(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(user.id));
  allActivities.push(newActivity);
  saveLocalStorageData(ACTIVITIES_KEY, allActivities);
  
  // If this activity matches a schedule task, update that schedule's last_performed
  const schedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id))
    .filter(s => s.plant_id === activity.plant_id && s.type === activity.type && s.user_id === user.id);
  
  if (schedules.length > 0) {
    const allScheds = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
    const updated = allScheds.map(s => {
      if (s.plant_id === activity.plant_id && s.type === activity.type && s.user_id === user.id) {
        return { ...s, last_performed: activity.date };
      }
      return s;
    });
    saveLocalStorageData(SCHEDULES_KEY, updated);
  }

  return newActivity;
};

export const deleteActivity = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  // Local Storage Fallback
  const allActivities = getLocalStorageData<Activity>(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(user.id));
  saveLocalStorageData(ACTIVITIES_KEY, allActivities.filter(a => !(a.id === id && a.user_id === user.id)));
};

export const getSchedules = async (plantId: string | null = null): Promise<Schedule[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const dbPlants = await getPlants(null, true);

  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("schedules").select("*").eq("user_id", user.id).neq("type", "watering");
    if (plantId) query = query.eq("plant_id", plantId);
    
    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(s => enrichSchedule(s, dbPlants));
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  let list = db.schedules.filter(s => s.type !== "watering");
  if (plantId) list = list.filter(s => s.plant_id === plantId);
  
  return list.map(s => enrichSchedule(s, dbPlants));
};

export const createSchedule = async (schedule: Omit<Schedule, "id" | "user_id" | "last_performed" | "created_at">): Promise<Schedule> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const newSchedule: Schedule = {
    ...schedule,
    id: crypto.randomUUID(),
    user_id: user.id,
    last_performed: null,
    created_at: new Date().toISOString(),
  };

  const dbPlants = await getPlants(null, true);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("schedules")
      .insert(newSchedule)
      .select()
      .single();
    if (error) throw error;
    return enrichSchedule(data, dbPlants);
  }

  // Local Storage Fallback
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  allSchedules.push(newSchedule);
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);
  return enrichSchedule(newSchedule, dbPlants);
};

export const updateSchedule = async (id: string, updates: Partial<Schedule>): Promise<Schedule> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const dbPlants = await getPlants(null, true);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("schedules")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return enrichSchedule(data, dbPlants);
  }

  // Local Storage Fallback
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  const idx = allSchedules.findIndex(s => s.id === id && s.user_id === user.id);
  if (idx === -1) throw new Error("Schedule not found");

  const updated = { ...allSchedules[idx], ...updates };
  allSchedules[idx] = updated;
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);
  return enrichSchedule(updated, dbPlants);
};

export const deleteSchedule = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  // Local Storage Fallback
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  saveLocalStorageData(SCHEDULES_KEY, allSchedules.filter(s => !(s.id === id && s.user_id === user.id)));
};

export const performSchedule = async (
  id: string,
  dateStr: string,
  customDetails?: string,
  customNotes?: string
): Promise<Schedule> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch schedule
  const schedules = await getSchedules();
  const found = schedules.find(s => s.id === id);
  if (!found) throw new Error("Schedule not found");

  // Log activity
  await createActivity({
    plant_id: found.plant_id,
    type: found.type,
    date: dateStr,
    details: customDetails || `Performed recurring scheduled task: ${found.type.charAt(0).toUpperCase() + found.type.slice(1)}`,
    notes: customNotes || "Marked as completed from schedules planner."
  });

  // Update last_performed
  const updated = await updateSchedule(id, { last_performed: dateStr });
  
  // Re-queue notification check (can trigger a dynamic check later)
  return updated;
};

// --- Notifications System ---

export const getNotifications = async (): Promise<Notification[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  // Before returning, dynamically scan active schedules to auto-generate due/overdue notifications
  const schedules = await getSchedules();
  const allPlants = await getPlants(null, true);
  
  const notifications: Notification[] = [];
  
  schedules.forEach(s => {
    if (s.task_status === "due" || s.task_status === "overdue") {
      const plant = allPlants.find(p => p.id === s.plant_id);
      if (!plant || plant.archived) return;

      const taskNameEn = s.type.charAt(0).toUpperCase() + s.type.slice(1);
      const taskNameTh = s.type === "watering" ? "รดน้ำ" : s.type === "fertilizing" ? "ใส่ปุ๋ย" : s.type === "pruning" ? "ตัดแต่งกิ่ง" : s.type === "repotting" ? "เปลี่ยนกระถาง" : s.type === "pest_control" ? "กำจัดศัตรูพืช" : "ดูแลทั่วไป";

      const timeLabel = s.task_status === "due" ? "due today" : "overdue";
      const timeLabelTh = s.task_status === "due" ? "ครบกำหนดวันนี้" : "เลยกำหนดส่ง";

      notifications.push({
        id: `auto-${s.id}-${s.task_status}`,
        user_id: user.id,
        title_en: `${taskNameEn} ${timeLabel}!`,
        title_th: `งาน ${taskNameTh} ${timeLabelTh}!`,
        message_en: `Your plant "${s.plant_name}" is ready for ${s.type}.`,
        message_th: `พืช "${s.plant_name}" ของคุณต้องการการ "${taskNameTh}" แล้ว`,
        type: s.task_status,
        read: false,
        created_at: s.next_due_date || new Date().toISOString(),
      });
    }
  });

  // Dynamically check watering schedules to see if any are due or overdue
  const wateringSchedules = await getWateringSchedules();
  let hasDueWatering = false;
  let hasOverdueWatering = false;
  let earliestDueDate: string | null = null;
  
  wateringSchedules.forEach(s => {
    const plant = allPlants.find(p => p.id === s.plant_id);
    if (!plant || plant.archived) return;

    if (s.task_status === "overdue") {
      hasOverdueWatering = true;
    } else if (s.task_status === "due") {
      hasDueWatering = true;
    }
    
    if (s.task_status === "due" || s.task_status === "overdue") {
      if (!earliestDueDate || (s.next_due_date && s.next_due_date < earliestDueDate)) {
        earliestDueDate = s.next_due_date || null;
      }
    }
  });

  if (hasOverdueWatering || hasDueWatering) {
    notifications.push({
      id: "auto-bulk-watering",
      user_id: user.id,
      title_en: "Time to water your plants!",
      title_th: "ถึงเวลารดน้ำต้นไม้แล้ว",
      message_en: "Some of your plants need watering.",
      message_th: "มีต้นไม้ที่ถึงกำหนดรดน้ำแล้ว",
      type: hasOverdueWatering ? "overdue" : "due",
      read: false,
      created_at: earliestDueDate || new Date().toISOString(),
    });
  }

  if (isSupabaseConfigured && supabase) {
    // Merge database-saved notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (error) return notifications;
    
    const dbNotifications = (data || []) as Notification[];
    return [...notifications, ...dbNotifications];
  }

  // Local Storage Fallback
  const stored = getLocalStorageData<Notification>(NOTIFICATIONS_KEY, []).filter(x => x.user_id === user.id);
  
  // We combine auto-generated task reminders (always unread until marked done) + stored custom alerts
  return [...notifications, ...stored].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getWateringSchedules = async (plantId: string | null = null): Promise<Schedule[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const dbPlants = await getPlants(null, true);

  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("schedules").select("*").eq("user_id", user.id).eq("type", "watering");
    if (plantId) query = query.eq("plant_id", plantId);
    
    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(s => enrichSchedule(s, dbPlants));
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  let list = db.schedules.filter(s => s.type === "watering");
  if (plantId) list = list.filter(s => s.plant_id === plantId);
  
  return list.map(s => enrichSchedule(s, dbPlants));
};

export const waterAllPlants = async (): Promise<{ success: boolean; affectedCount: number }> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const userId = user.id;
  const nowStr = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data: activePlants, error: plantsError } = await supabase
      .from("plants")
      .select("id")
      .eq("user_id", userId)
      .eq("archived", false);
    if (plantsError) throw plantsError;
    if (!activePlants || activePlants.length === 0) {
      return { success: true, affectedCount: 0 };
    }
    const activePlantIds = activePlants.map(p => p.id);

    // Update last_watered_at for active plants
    const { error: updatePlantsError } = await supabase
      .from("plants")
      .update({ last_watered_at: nowStr })
      .in("id", activePlantIds);
    if (updatePlantsError) throw updatePlantsError;

    // Update watering schedules for these plants
    const { error: updateSchedulesError } = await supabase
      .from("schedules")
      .update({ last_performed: nowStr })
      .eq("type", "watering")
      .in("plant_id", activePlantIds);
    if (updateSchedulesError) throw updateSchedulesError;

    // Insert into bulk_watering_history
    const { error: historyError } = await supabase
      .from("bulk_watering_history")
      .insert({
        user_id: userId,
        watered_at: nowStr,
        affected_plants_count: activePlantIds.length,
      });
    if (historyError) throw historyError;

    return { success: true, affectedCount: activePlantIds.length };
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(userId);
  const activePlants = db.plants.filter(p => !p.archived);
  if (activePlants.length === 0) {
    return { success: true, affectedCount: 0 };
  }
  const activePlantIds = activePlants.map(p => p.id);

  // Update plants in localStorage
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(userId));
  const updatedPlants = allPlants.map(p => {
    if (activePlantIds.includes(p.id)) {
      return { ...p, last_watered_at: nowStr };
    }
    return p;
  });
  saveLocalStorageData(PLANTS_KEY, updatedPlants);

  // Update schedules in localStorage
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(userId));
  const updatedSchedules = allSchedules.map(s => {
    if (s.type === "watering" && activePlantIds.includes(s.plant_id)) {
      return { ...s, last_performed: nowStr };
    }
    return s;
  });
  saveLocalStorageData(SCHEDULES_KEY, updatedSchedules);

  // Create bulk watering history in localStorage
  const bulkHistory = getLocalStorageData<any>("plant_tracker_bulk_watering_history", []);
  const newBulkHistoryItem = {
    id: crypto.randomUUID(),
    user_id: userId,
    watered_at: nowStr,
    affected_plants_count: activePlantIds.length,
    created_at: nowStr,
  };
  bulkHistory.push(newBulkHistoryItem);
  saveLocalStorageData("plant_tracker_bulk_watering_history", bulkHistory);

  return { success: true, affectedCount: activePlantIds.length };
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  if (id.startsWith("auto-")) {
    // Auto-generated notifications can be cleared by performing the task. 
    // We mark it "read" by locally storing the read status of auto IDs in a local list.
    const readAutoKeys = JSON.parse(localStorage.getItem("plant_tracker_read_autos") || "[]");
    readAutoKeys.push(id);
    localStorage.setItem("plant_tracker_read_autos", JSON.stringify(readAutoKeys));
    return;
  }

  if (isSupabaseConfigured && supabase) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", user.id);
    return;
  }

  // Local Storage Fallback
  const stored = getLocalStorageData<Notification>(NOTIFICATIONS_KEY, []);
  const updated = stored.map(n => {
    if (n.id === id && n.user_id === user.id) return { ...n, read: true };
    return n;
  });
  saveLocalStorageData(NOTIFICATIONS_KEY, updated);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  const notifications = await getNotifications();
  const autoIds = notifications.filter(n => n.id.startsWith("auto-")).map(n => n.id);

  const readAutoKeys = JSON.parse(localStorage.getItem("plant_tracker_read_autos") || "[]");
  const merged = Array.from(new Set([...readAutoKeys, ...autoIds]));
  localStorage.setItem("plant_tracker_read_autos", JSON.stringify(merged));

  if (isSupabaseConfigured && supabase) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);
    return;
  }

  // Local Storage Fallback
  const stored = getLocalStorageData<Notification>(NOTIFICATIONS_KEY, []);
  const updated = stored.map(n => {
    if (n.user_id === user.id) return { ...n, read: true };
    return n;
  });
  saveLocalStorageData(NOTIFICATIONS_KEY, updated);
};

// --- Global Search Utility ---

export interface SearchResult {
  plants: Plant[];
  activities: Activity[];
}

export const globalSearch = async (query: string): Promise<SearchResult> => {
  if (!query.trim()) return { plants: [], activities: [] };
  const normalizedQuery = query.toLowerCase();

  const allPlants = await getPlants(null, true); // Search all including archived
  const allActivities = await getActivities();

  const filteredPlants = allPlants.filter(
    p =>
      p.name.toLowerCase().includes(normalizedQuery) ||
      p.species.toLowerCase().includes(normalizedQuery) ||
      p.location.toLowerCase().includes(normalizedQuery)
  );

  const filteredActivities = allActivities.filter(
    a =>
      a.details.toLowerCase().includes(normalizedQuery) ||
      a.notes.toLowerCase().includes(normalizedQuery) ||
      (a.plant_name && a.plant_name.toLowerCase().includes(normalizedQuery))
  );

  return {
    plants: filteredPlants,
    activities: filteredActivities,
  };
};

// ============================================================
// FERTILIZER MANAGEMENT
// ============================================================

const DEFAULT_FERTILIZERS = (userId: string): Fertilizer[] => [
  {
    id: "fert-1",
    user_id: userId,
    name: "กลาง 16-16-16",
    npk_formula: "16-16-16",
    type: "granular",
    default_interval_days: 14,
    color: "#10b981",
    description: "ปุ๋ยเคมีสูตรกลาง เหมาะสำหรับไม้ดอกและไม้ใบทั่วไป",
    is_archived: false,
    created_at: "2026-05-11T10:54:45.278Z",
    updated_at: "2026-05-11T10:54:45.278Z",
  },
  {
    id: "fert-2",
    user_id: userId,
    name: "ดอก 8-24-24",
    npk_formula: "8-24-24",
    type: "granular",
    default_interval_days: 10,
    color: "#f59e0b",
    description: "ปุ๋ยสูตรส่งเสริมการออกดอก เหมาะสำหรับกุหลาบ มะลิ และไม้ดอกทั่วไป",
    is_archived: false,
    created_at: "2026-05-11T10:54:45.278Z",
    updated_at: "2026-05-11T10:54:45.278Z",
  },
  {
    id: "fert-3",
    user_id: userId,
    name: "อินทรีย์",
    npk_formula: "0-0-0",
    type: "organic",
    default_interval_days: 30,
    color: "#8b5cf6",
    description: "ปุ๋ยอินทรีย์ปรับปรุงดิน เหมาะสำหรับพืชทุกชนิด",
    is_archived: false,
    created_at: "2026-05-11T10:54:45.278Z",
    updated_at: "2026-05-11T10:54:45.278Z",
  },
];

// Helper to compute PlantFertilizer next_due_date and task_status
const enrichPlantFertilizer = (pf: PlantFertilizer, fertilizers: Fertilizer[], plants: Plant[]): PlantFertilizer => {
  const fertilizer = fertilizers.find(f => f.id === pf.fertilizer_id);
  const plant = plants.find(p => p.id === pf.plant_id);
  let next_due_date: string | null = null;
  let task_status: PlantFertilizer["task_status"] = "pending";

  if (pf.last_applied_date) {
    const next = new Date(pf.last_applied_date);
    next.setDate(next.getDate() + pf.interval_days);
    next_due_date = next.toISOString();
    task_status = determineTaskStatus(next);
  } else if (pf.created_at) {
    const next = new Date(pf.created_at);
    next.setDate(next.getDate() + pf.interval_days);
    next_due_date = next.toISOString();
    task_status = determineTaskStatus(next);
  }

  return {
    ...pf,
    next_due_date,
    task_status,
    fertilizer_name: fertilizer ? fertilizer.name : "Unknown Fertilizer",
    fertilizer_npk: fertilizer ? fertilizer.npk_formula : "",
    fertilizer_color: fertilizer ? fertilizer.color : "#10b981",
    fertilizer_type: fertilizer ? fertilizer.type : "granular",
    plant_name: plant ? plant.name : "Unknown Plant",
  };
};

// --- Fertilizer CRUD ---

export const getFertilizers = async (includeArchived = false): Promise<Fertilizer[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id))
    .filter(f => f.user_id === user.id);

  // Compute usage_count per fertilizer
  const plantFertilizers = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, [])
    .filter(pf => pf.user_id === user.id);

  const withCount = all.map(f => ({
    ...f,
    usage_count: plantFertilizers.filter(pf => pf.fertilizer_id === f.id && pf.active).length,
  }));

  return includeArchived ? withCount : withCount.filter(f => !f.is_archived);
};

export const createFertilizer = async (
  data: Omit<Fertilizer, "id" | "user_id" | "is_archived" | "created_at" | "updated_at" | "usage_count">
): Promise<Fertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();
  const newFertilizer: Fertilizer = {
    ...data,
    id: crypto.randomUUID(),
    user_id: user.id,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  all.push(newFertilizer);
  saveLocalStorageData(FERTILIZERS_KEY, all);
  return newFertilizer;
};

export const updateFertilizer = async (id: string, updates: Partial<Fertilizer>): Promise<Fertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const idx = all.findIndex(f => f.id === id && f.user_id === user.id);
  if (idx === -1) throw new Error("Fertilizer not found");

  const updated = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
  all[idx] = updated;
  saveLocalStorageData(FERTILIZERS_KEY, all);
  return updated;
};

export const archiveFertilizer = async (id: string, archiveState: boolean): Promise<Fertilizer> => {
  return updateFertilizer(id, { is_archived: archiveState });
};

export const deleteFertilizer = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  saveLocalStorageData(FERTILIZERS_KEY, all.filter(f => !(f.id === id && f.user_id === user.id)));
};

// --- Plant Fertilizer Schedule CRUD ---

export const getPlantFertilizers = async (plantId?: string): Promise<PlantFertilizer[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id))
    .filter(f => f.user_id === user.id);

  const dbPlants = getLocalStorageData<Plant>(PLANTS_KEY, []).filter(p => p.user_id === user.id);

  let list = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, [])
    .filter(pf => pf.user_id === user.id && pf.active);

  if (plantId) list = list.filter(pf => pf.plant_id === plantId);

  return list.map(pf => enrichPlantFertilizer(pf, fertilizers, dbPlants));
};

export const createPlantFertilizer = async (
  data: { plant_id: string; fertilizer_id: string; interval_days: number }
): Promise<PlantFertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const newPF: PlantFertilizer = {
    id: crypto.randomUUID(),
    user_id: user.id,
    plant_id: data.plant_id,
    fertilizer_id: data.fertilizer_id,
    interval_days: data.interval_days,
    last_applied_date: null,
    next_due_date: null,
    active: true,
    created_at: new Date().toISOString(),
  };

  const all = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, []);
  all.push(newPF);
  saveLocalStorageData(PLANT_FERTILIZERS_KEY, all);

  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const plants = getLocalStorageData<Plant>(PLANTS_KEY, []);
  return enrichPlantFertilizer(newPF, fertilizers, plants);
};

export const updatePlantFertilizer = async (id: string, updates: Partial<PlantFertilizer>): Promise<PlantFertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const all = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, []);
  const idx = all.findIndex(pf => pf.id === id && pf.user_id === user.id);
  if (idx === -1) throw new Error("PlantFertilizer not found");

  const updated = { ...all[idx], ...updates };
  all[idx] = updated;
  saveLocalStorageData(PLANT_FERTILIZERS_KEY, all);

  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const plants = getLocalStorageData<Plant>(PLANTS_KEY, []);
  return enrichPlantFertilizer(updated, fertilizers, plants);
};

export const deletePlantFertilizer = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Soft delete — set active = false to preserve history references
  const all = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, []);
  const idx = all.findIndex(pf => pf.id === id && pf.user_id === user.id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], active: false };
    saveLocalStorageData(PLANT_FERTILIZERS_KEY, all);
  }
};

// --- Apply Fertilizer (One-Click Workflow) ---



export const applyFertilizer = async (
  plantFertilizerId: string,
  amount: string,
  note: string,
  dateStr?: string
): Promise<{ plantFertilizer: PlantFertilizer; history: FertilizerHistory }> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  let applied_date = dateStr || new Date().toISOString();
  if (applied_date.length === 10) {
    const todayLocal = new Date().toLocaleDateString("sv-SE");
    if (applied_date === todayLocal) {
      applied_date = new Date().toISOString();
    } else {
      applied_date = new Date(`${applied_date}T00:00:00`).toISOString();
    }
  }

  // 1. Find PlantFertilizer record
  const allPF = getLocalStorageData<PlantFertilizer>(PLANT_FERTILIZERS_KEY, []);
  const pfIdx = allPF.findIndex(pf => pf.id === plantFertilizerId && pf.user_id === user.id);
  if (pfIdx === -1) throw new Error("Plant fertilizer schedule not found");

  const pf = allPF[pfIdx];

  // 2. Update last_applied_date
  const nextDue = new Date(applied_date);
  nextDue.setDate(nextDue.getDate() + pf.interval_days);
  const updatedPF = {
    ...pf,
    last_applied_date: applied_date,
    next_due_date: nextDue.toISOString(),
  };
  allPF[pfIdx] = updatedPF;
  saveLocalStorageData(PLANT_FERTILIZERS_KEY, allPF);

  // 3. Write FertilizerHistory record
  const historyRecord: FertilizerHistory = {
    id: crypto.randomUUID(),
    user_id: user.id,
    plant_id: pf.plant_id,
    fertilizer_id: pf.fertilizer_id,
    applied_date,
    amount,
    note,
    created_at: new Date().toISOString(),
  };
  const allHistory = getLocalStorageData<FertilizerHistory>(FERTILIZER_HISTORY_KEY, []);
  allHistory.push(historyRecord);
  saveLocalStorageData(FERTILIZER_HISTORY_KEY, allHistory);

  // 4. Also write to Activities log so Calendar/Dashboard timeline stays populated
  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const fertInfo = fertilizers.find(f => f.id === pf.fertilizer_id);
  const fertLabel = fertInfo ? `${fertInfo.name} (${fertInfo.npk_formula})` : "Fertilizer";

  await createActivity({
    plant_id: pf.plant_id,
    type: "fertilizing",
    date: applied_date,
    details: `ใส่ปุ๋ย: ${fertLabel}${amount ? ` — ${amount}` : ""}`,
    notes: note,
  });

  // 5. Return enriched result
  const plants = getLocalStorageData<Plant>(PLANTS_KEY, []);
  const enrichedPF = enrichPlantFertilizer(updatedPF, fertilizers, plants);

  const plant = plants.find(p => p.id === pf.plant_id);
  const enrichedHistory: FertilizerHistory = {
    ...historyRecord,
    plant_name: plant ? plant.name : "Unknown Plant",
    fertilizer_name: fertInfo ? fertInfo.name : "Unknown",
    fertilizer_npk: fertInfo ? fertInfo.npk_formula : "",
    fertilizer_color: fertInfo ? fertInfo.color : "#10b981",
  };

  return { plantFertilizer: enrichedPF, history: enrichedHistory };
};

export const logFertilizationDirect = async (
  plantId: string,
  fertilizerId: string,
  amount: string,
  note: string,
  dateStr?: string
): Promise<FertilizerHistory> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  let applied_date = dateStr || new Date().toISOString();
  if (applied_date.length === 10) {
    const todayLocal = new Date().toLocaleDateString("sv-SE");
    if (applied_date === todayLocal) {
      applied_date = new Date().toISOString();
    } else {
      applied_date = new Date(`${applied_date}T00:00:00`).toISOString();
    }
  }

  // 1. Write FertilizerHistory record
  const historyRecord: FertilizerHistory = {
    id: crypto.randomUUID(),
    user_id: user.id,
    plant_id: plantId,
    fertilizer_id: fertilizerId,
    applied_date,
    amount,
    note,
    created_at: new Date().toISOString(),
  };
  const allHistory = getLocalStorageData<FertilizerHistory>(FERTILIZER_HISTORY_KEY, []);
  allHistory.push(historyRecord);
  saveLocalStorageData(FERTILIZER_HISTORY_KEY, allHistory);

  // 2. Also write to Activities log so Calendar/Dashboard timeline stays populated
  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const fertInfo = fertilizers.find(f => f.id === fertilizerId);
  const fertLabel = fertInfo ? `${fertInfo.name} (${fertInfo.npk_formula})` : "Fertilizer";

  await createActivity({
    plant_id: plantId,
    type: "fertilizing",
    date: applied_date,
    details: `ใส่ปุ๋ย: ${fertLabel}${amount ? ` — ${amount}` : ""}`,
    notes: note,
  });

  const plants = getLocalStorageData<Plant>(PLANTS_KEY, []);
  const plant = plants.find(p => p.id === plantId);

  return {
    ...historyRecord,
    plant_name: plant ? plant.name : "Unknown Plant",
    fertilizer_name: fertInfo ? fertInfo.name : "Unknown",
    fertilizer_npk: fertInfo ? fertInfo.npk_formula : "",
    fertilizer_color: fertInfo ? fertInfo.color : "#10b981",
  };
};

// --- Fertilizer History ---

export const getFertilizerHistory = async (
  plantId?: string,
  fertilizerId?: string,
  limit?: number
): Promise<FertilizerHistory[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id))
    .filter(f => f.user_id === user.id);
  const plants = getLocalStorageData<Plant>(PLANTS_KEY, []).filter(p => p.user_id === user.id);

  let list = getLocalStorageData<FertilizerHistory>(FERTILIZER_HISTORY_KEY, [])
    .filter(h => h.user_id === user.id);

  if (plantId) list = list.filter(h => h.plant_id === plantId);
  if (fertilizerId) list = list.filter(h => h.fertilizer_id === fertilizerId);

  // Sort descending by applied_date
  list.sort((a, b) => new Date(b.applied_date).getTime() - new Date(a.applied_date).getTime());
  if (limit) list = list.slice(0, limit);

  return list.map(h => {
    const fertilizer = fertilizers.find(f => f.id === h.fertilizer_id);
    const plant = plants.find(p => p.id === h.plant_id);
    return {
      ...h,
      plant_name: plant ? plant.name : "Unknown Plant",
      fertilizer_name: fertilizer ? fertilizer.name : "Unknown",
      fertilizer_npk: fertilizer ? fertilizer.npk_formula : "",
      fertilizer_color: fertilizer ? fertilizer.color : "#10b981",
    };
  });
};

// Helper: get all active plant-fertilizer schedules as a flat list (for dashboard task cards)
export const getAllFertilizerScheduleTasks = async (): Promise<PlantFertilizer[]> => {
  return getPlantFertilizers();
};

export const importSampleDataToSupabase = async (): Promise<{ success: boolean; error: Error | null }> => {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: new Error("Not authenticated") };

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: new Error("Supabase is not configured") };
  }

  try {
    const userId = user.id;

    // 1. Get default mock data
    const mockGardens = DEFAULT_GARDENS(userId);
    const mockPlants = DEFAULT_PLANTS(userId);
    const mockActivities = DEFAULT_ACTIVITIES(userId);
    const mockSchedules = DEFAULT_SCHEDULES(userId);

    // 2. Maps to store UUID mappings
    const gardenIdMap: Record<string, string> = {};
    const plantIdMap: Record<string, string> = {};

    // 3. Import Gardens
    const gardensToInsert = mockGardens.map(g => {
      const newUuid = crypto.randomUUID();
      gardenIdMap[g.id] = newUuid;
      return {
        id: newUuid,
        user_id: userId,
        name: g.name,
        description: g.description || "",
        cover_image: g.cover_image || "",
        created_at: g.created_at || new Date().toISOString()
      };
    });

    const { error: gError } = await supabase.from("gardens").insert(gardensToInsert);
    if (gError) throw gError;

    // 4. Import Plants
    const plantsToInsert = mockPlants.map(p => {
      const newUuid = crypto.randomUUID();
      plantIdMap[p.id] = newUuid;
      return {
        id: newUuid,
        user_id: userId,
        garden_id: p.garden_id ? gardenIdMap[p.garden_id] || null : null,
        name: p.name,
        species: p.species,
        location: p.location || "",
        planting_date: p.planting_date,
        status: p.status,
        notes: p.notes || "",
        cover_image: p.cover_image || "",
        archived: p.archived || false,
        created_at: p.created_at || new Date().toISOString()
      };
    });

    const { error: pError } = await supabase.from("plants").insert(plantsToInsert);
    if (pError) throw pError;

    // 5. Import Schedules
    const schedulesToInsert = mockSchedules.map(s => {
      if (s.type === "watering") return null;
      const mappedPlantId = plantIdMap[s.plant_id];
      if (!mappedPlantId) return null;
      return {
        id: crypto.randomUUID(),
        user_id: userId,
        plant_id: mappedPlantId,
        type: s.type,
        interval_days: s.interval_days,
        start_date: s.start_date,
        last_performed: s.last_performed || null,
        created_at: s.created_at || new Date().toISOString()
      };
    }).filter((s): s is NonNullable<typeof s> => !!s);

    if (schedulesToInsert.length > 0) {
      const { error: sError } = await supabase.from("schedules").insert(schedulesToInsert);
      if (sError) throw sError;
    }

    // 6. Import Activities
    const activitiesToInsert = mockActivities.map(a => {
      if (a.type === "watering") return null;
      const mappedPlantId = plantIdMap[a.plant_id];
      if (!mappedPlantId) return null;
      return {
        id: crypto.randomUUID(),
        user_id: userId,
        plant_id: mappedPlantId,
        type: a.type,
        date: a.date,
        details: a.details || "",
        notes: a.notes || "",
        photo_url: null,
        created_at: a.created_at || new Date().toISOString()
      };
    }).filter((a): a is NonNullable<typeof a> => !!a);

    if (activitiesToInsert.length > 0) {
      const { error: aError } = await supabase.from("activities").insert(activitiesToInsert);
      if (aError) throw aError;
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Failed to seed Supabase:", err);
    return { success: false, error: err };
  }
};

