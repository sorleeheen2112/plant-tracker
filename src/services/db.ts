import { supabase, isSupabaseConfigured } from "./supabase";
import { getCurrentUser } from "./auth";
import { triggerLineNotification } from "./notification.service";

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
  updated_at?: string;
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
  fertilizer_id?: string | null;
  fertilizer_amount?: string | null;
  created_at: string;
  
  // Joined fields
  plant_name?: string;
  fertilizer_name?: string;
  fertilizer_npk?: string;
  fertilizer_color?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  plant_id: string;
  type: ActivityType;
  interval_days: number;
  start_date: string;
  last_performed: string | null;
  fertilizer_id?: string | null;
  created_at: string;

  // Calculated client-side fields
  next_due_date?: string;
  task_status?: "due" | "overdue" | "upcoming" | "pending";
  plant_name?: string;
  plant_cover_image?: string;
  overdue_days?: number;
  fertilizer_name?: string;
  fertilizer_npk?: string;
  fertilizer_color?: string;
  fertilizer_type?: FertilizerType;
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
export const enrichSchedule = (schedule: Schedule, plants: Plant[], fertilizers: Fertilizer[] = []): Schedule => {
  const plant = plants.find(p => p.id === schedule.plant_id);
  const nextDue = calculateNextDueDate(schedule.start_date, schedule.interval_days, schedule.last_performed);
  const status = determineTaskStatus(nextDue);

  const today = getStartOfDay(new Date());
  const dueDay = getStartOfDay(nextDue);
  const diffTime = today.getTime() - dueDay.getTime();
  const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const fert = schedule.fertilizer_id && fertilizers ? fertilizers.find(f => f.id === schedule.fertilizer_id) : null;
  
  return {
    ...schedule,
    next_due_date: nextDue.toISOString(),
    task_status: status,
    plant_name: plant ? plant.name : "Unknown Plant",
    plant_cover_image: plant ? plant.cover_image : "",
    overdue_days: status === "overdue" ? (overdueDays <= 0 ? 1 : overdueDays) : 0,
    fertilizer_name: fert ? fert.name : undefined,
    fertilizer_npk: fert ? fert.npk_formula : undefined,
    fertilizer_color: fert ? fert.color : undefined,
    fertilizer_type: fert ? fert.type : undefined,
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

const DEFAULT_ACTIVITIES = (userId: string): Activity[] => {
  const rawList: Partial<Activity>[] = [
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
  return rawList.map(a => {
    if (a.type === "fertilizing") {
      const isRose = ["p-3", "p-8", "p-13"].includes(a.plant_id || "");
      return {
        ...a,
        fertilizer_id: isRose ? "fert-2" : "fert-1",
        fertilizer_amount: "1/2 ช้อนชา"
      } as Activity;
    }
    return a as Activity;
  });
};

const DEFAULT_SCHEDULES = (userId: string): Schedule[] => {
  const rawList: Partial<Schedule>[] = [
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
  return rawList.map(s => {
    if (s.type === "fertilizing") {
      const isRose = ["p-3", "p-8", "p-13"].includes(s.plant_id || "");
      return { ...s, fertilizer_id: isRose ? "fert-2" : "fert-1" } as Schedule;
    }
    return s as Schedule;
  });
};

const runLocalStorageMigration = (userId: string) => {
  if (typeof window === "undefined") return;

  const MIGRATED_KEY = `plant_tracker_migrated_v4_${userId}`;
  if (window.localStorage.getItem(MIGRATED_KEY)) return;

  try {
    const oldPF = getLocalStorageData<PlantFertilizer>("plant_tracker_plant_fertilizers", []);
    const oldHistory = getLocalStorageData<FertilizerHistory>("plant_tracker_fertilizer_history", []);
    const schedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(userId));
    const activities = getLocalStorageData<Activity>(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(userId));

    const updatedSchedules = schedules.filter(s => !(s.type === "fertilizing" && s.user_id === userId));

    oldPF.forEach((pf: PlantFertilizer) => {
      if (pf.user_id !== userId || !pf.active) return;
      
      const newSchedule: Schedule = {
        id: pf.id,
        user_id: userId,
        plant_id: pf.plant_id,
        type: "fertilizing",
        interval_days: pf.interval_days,
        start_date: pf.created_at ? pf.created_at.substring(0, 10) : new Date().toLocaleDateString("sv-SE"),
        last_performed: pf.last_applied_date || null,
        fertilizer_id: pf.fertilizer_id,
        created_at: pf.created_at || new Date().toISOString(),
      };
      updatedSchedules.push(newSchedule);
    });

    const existingActivityIds = new Set(activities.map(a => a.id));
    
    oldHistory.forEach((h: FertilizerHistory) => {
      if (h.user_id !== userId) return;
      
      const activityId = h.id || crypto.randomUUID();
      if (existingActivityIds.has(activityId)) return;

      const fertLabel = h.fertilizer_name || "Fertilizer";
      const newActivity: Activity = {
        id: activityId,
        user_id: userId,
        plant_id: h.plant_id,
        type: "fertilizing",
        date: h.applied_date,
        details: `ใส่ปุ๋ย: ${fertLabel}${h.amount ? ` — ${h.amount}` : ""}`,
        notes: h.note || "",
        fertilizer_id: h.fertilizer_id,
        fertilizer_amount: h.amount || null,
        created_at: h.created_at || new Date().toISOString(),
      };
      
      activities.push(newActivity);
      existingActivityIds.add(activityId);
    });

    saveLocalStorageData(SCHEDULES_KEY, updatedSchedules);
    saveLocalStorageData(ACTIVITIES_KEY, activities);

    window.localStorage.removeItem("plant_tracker_plant_fertilizers");
    window.localStorage.removeItem("plant_tracker_fertilizer_history");

    window.localStorage.setItem(MIGRATED_KEY, "true");
    console.log("Local storage database schema migration to v4 complete.");
  } catch (err) {
    console.error("Failed to run local storage database migration:", err);
  }
};

// Hydrates local arrays for an authenticated user
const loadLocalDatabase = (userId: string) => {
  runLocalStorageMigration(userId);

  const gardens = getLocalStorageData(GARDENS_KEY, DEFAULT_GARDENS(userId)).filter(x => x.user_id === userId);
  const plants = getLocalStorageData(PLANTS_KEY, DEFAULT_PLANTS(userId)).filter(x => x.user_id === userId);
  const activities = getLocalStorageData(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(userId)).filter(x => x.user_id === userId);
  const schedules = getLocalStorageData(SCHEDULES_KEY, DEFAULT_SCHEDULES(userId)).filter(x => x.user_id === userId);
  const notifications = getLocalStorageData<Notification>(NOTIFICATIONS_KEY, []).filter(x => x.user_id === userId);
  const fertilizers = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(userId)).filter(x => x.user_id === userId);
  
  return { gardens, plants, activities, schedules, notifications, fertilizers };
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

  const nowStr = new Date().toISOString();
  const newPlant: Plant = {
    ...plant,
    id: crypto.randomUUID(),
    user_id: user.id,
    archived: false,
    created_at: nowStr,
    updated_at: nowStr,
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("plants")
      .insert(newPlant)
      .select()
      .single();
    if (error) {
      console.warn("Failed to insert plant with updated_at, retrying without updated_at column:", error);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { updated_at, ...plantWithoutUpdatedAt } = newPlant;
      const { data: retryData, error: retryError } = await supabase
        .from("plants")
        .insert(plantWithoutUpdatedAt)
        .select()
        .single();
      if (retryError) throw retryError;
      invalidatePlantsCache();
      return retryData;
    }
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

  if (updates.status === "sick") {
    // Trigger plant health alert asynchronously
    (async () => {
      try {
        const plants = await getPlants(null, true);
        const plant = plants.find(p => p.id === id);
        const plantName = plant ? plant.name : updates.name || "พืชของคุณ";
        const msg = `🍂 Plant Tracker\n\nพบปัญหาความแข็งแรงของพืช "${plantName}" ของคุณ\n\nกรุณาเปิดแอป Plant Tracker เพื่อตรวจสอบคำแนะนำการดูแลครับ`;
        await triggerLineNotification(user.id, "plantHealth", msg);
      } catch (err) {
        console.error("Failed to trigger plant health notification:", err);
      }
    })();
  }

  const enrichedUpdates = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("plants")
      .update(enrichedUpdates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) {
      console.warn("Failed to update plant with updated_at, retrying without updated_at column:", error);
      const { data: retryData, error: retryError } = await supabase
        .from("plants")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (retryError) throw retryError;
      invalidatePlantsCache();
      return retryData;
    }
    invalidatePlantsCache();
    return data;
  }

  // Local Storage Fallback
  const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
  const idx = allPlants.findIndex(p => p.id === id && p.user_id === user.id);
  if (idx === -1) throw new Error("Plant not found");

  const updated = { ...allPlants[idx], ...enrichedUpdates };
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

  const dbFertilizers = await getFertilizers(true);

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
    
    const mapped = (data || []).map((a: Omit<Activity, "plant_name"> & { plants?: { name: string } | null }) => ({
      ...a,
      plant_name: a.plants?.name || "Unknown Plant",
      fertilizer_name: dbFertilizers.find(f => f.id === a.fertilizer_id)?.name || undefined,
      fertilizer_npk: dbFertilizers.find(f => f.id === a.fertilizer_id)?.npk_formula || undefined,
      fertilizer_color: dbFertilizers.find(f => f.id === a.fertilizer_id)?.color || undefined,
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
        bulkActivities = bulkData.map((b: { id: string; user_id: string; watered_at: string; affected_plants_count: number; created_at: string }) => ({
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
    const fert = db.fertilizers.find(f => f.id === a.fertilizer_id);
    return {
      ...a,
      plant_name: plant ? plant.name : "Unknown Plant",
      fertilizer_name: fert ? fert.name : undefined,
      fertilizer_npk: fert ? fert.npk_formula : undefined,
      fertilizer_color: fert ? fert.color : undefined,
    };
  });

  let bulkActivities: Activity[] = [];
  if (!plantId) {
    const storedBulk = getLocalStorageData<{ id: string; user_id: string; watered_at: string; affected_plants_count: number; created_at: string }>("plant_tracker_bulk_watering_history", []).filter(b => b.user_id === user.id);
    bulkActivities = storedBulk.map((b: { id: string; user_id: string; watered_at: string; affected_plants_count: number; created_at: string }) => ({
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
    const { error } = await supabase
      .from("activities")
      .insert(newActivity);
    if (error) throw error;

    if (activity.plant_id && activity.plant_id !== "bulk") {
      try {
        await updatePlant(activity.plant_id, {});
      } catch (err) {
        console.warn("Failed to update plant updated_at during activity logging:", err);
      }

      try {
        let schedQuery = supabase
          .from("schedules")
          .update({ last_performed: activityDate })
          .eq("user_id", user.id)
          .eq("plant_id", activity.plant_id)
          .eq("type", activity.type);
        if (activity.fertilizer_id) {
          schedQuery = schedQuery.eq("fertilizer_id", activity.fertilizer_id);
        }
        await schedQuery;
      } catch (err) {
        console.warn("Failed to update schedule last_performed in Supabase:", err);
      }
    }

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
        if (s.type === "fertilizing" && s.fertilizer_id && activity.fertilizer_id && s.fertilizer_id !== activity.fertilizer_id) {
          return s;
        }
        return { ...s, last_performed: activityDate };
      }
      return s;
    });
    saveLocalStorageData(SCHEDULES_KEY, updated);
  }

  if (activity.plant_id && activity.plant_id !== "bulk") {
    try {
      await updatePlant(activity.plant_id, {});
    } catch (err) {
      console.warn("Failed to update plant updated_at during activity logging:", err);
    }
  }

  return newActivity;
};

export const deleteActivity = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (isSupabaseConfigured && supabase) {
    // 1. Fetch the activity to be deleted
    const { data: actData } = await supabase
      .from("activities")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (actData) {
      // Delete from activities table
      const { error: delError } = await supabase
        .from("activities")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (delError) throw delError;

      // Delete corresponding entry in fertilizer_history if applicable
      if (actData.type === "fertilizing") {
        try {
          await supabase
            .from("fertilizer_history")
            .delete()
            .eq("user_id", user.id)
            .eq("plant_id", actData.plant_id)
            .eq("applied_date", actData.date);
        } catch (err) {
          console.warn("Failed to clean up fertilizer_history:", err);
        }
      }

      // Re-sync schedule last_performed and calendar
      if (actData.plant_id && actData.plant_id !== "bulk") {
        let remQuery = supabase
          .from("activities")
          .select("date")
          .eq("user_id", user.id)
          .eq("plant_id", actData.plant_id)
          .eq("type", actData.type)
          .order("date", { ascending: false })
          .limit(1);

        if (actData.fertilizer_id) {
          remQuery = remQuery.eq("fertilizer_id", actData.fertilizer_id);
        }

        const { data: remActivities } = await remQuery;
        const newLastPerformed = remActivities && remActivities.length > 0 ? remActivities[0].date : null;

        let schedUpdateQuery = supabase
          .from("schedules")
          .update({ last_performed: newLastPerformed })
          .eq("user_id", user.id)
          .eq("plant_id", actData.plant_id)
          .eq("type", actData.type);

        if (actData.fertilizer_id) {
          schedUpdateQuery = schedUpdateQuery.eq("fertilizer_id", actData.fertilizer_id);
        }

        await schedUpdateQuery;

        if (actData.type === "watering") {
          await supabase
            .from("plants")
            .update({ last_watered_at: newLastPerformed })
            .eq("id", actData.plant_id)
            .eq("user_id", user.id);
          invalidatePlantsCache();
        }
      }
      return;
    }

    // Check if it's a bulk watering history entry
    const { data: bulkData } = await supabase
      .from("bulk_watering_history")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (bulkData) {
      const { error: delBulkErr } = await supabase
        .from("bulk_watering_history")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (delBulkErr) throw delBulkErr;
      return;
    }

    return;
  }

  // Local Storage Fallback
  const storedBulk = getLocalStorageData<{ id: string; user_id: string; watered_at: string; affected_plants_count: number; created_at: string }>("plant_tracker_bulk_watering_history", []);
  const isBulk = storedBulk.some(b => b.id === id && b.user_id === user.id);
  if (isBulk) {
    saveLocalStorageData(
      "plant_tracker_bulk_watering_history",
      storedBulk.filter(b => !(b.id === id && b.user_id === user.id))
    );
    return;
  }

  const allActivities = getLocalStorageData<Activity>(ACTIVITIES_KEY, DEFAULT_ACTIVITIES(user.id));
  const targetActivity = allActivities.find(a => a.id === id && a.user_id === user.id);
  if (!targetActivity) return;

  const remainingActivities = allActivities.filter(a => !(a.id === id && a.user_id === user.id));
  saveLocalStorageData(ACTIVITIES_KEY, remainingActivities);

  if (targetActivity.type === "fertilizing") {
    const fertHistory = getLocalStorageData<FertilizerHistory>("plant_tracker_fertilizer_history", []);
    saveLocalStorageData(
      "plant_tracker_fertilizer_history",
      fertHistory.filter(fh => !(fh.user_id === user.id && fh.plant_id === targetActivity.plant_id && fh.applied_date === targetActivity.date))
    );
  }

  // Re-sync schedule last_performed and calendar
  if (targetActivity.plant_id && targetActivity.plant_id !== "bulk") {
    const sameTypeRemaining = remainingActivities
      .filter(a => a.user_id === user.id && a.plant_id === targetActivity.plant_id && a.type === targetActivity.type && (!targetActivity.fertilizer_id || a.fertilizer_id === targetActivity.fertilizer_id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const newLastPerformed = sameTypeRemaining.length > 0 ? sameTypeRemaining[0].date : null;

    const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
    const updatedSchedules = allSchedules.map(s => {
      if (s.user_id === user.id && s.plant_id === targetActivity.plant_id && s.type === targetActivity.type) {
        if (s.type === "fertilizing" && targetActivity.fertilizer_id && s.fertilizer_id && s.fertilizer_id !== targetActivity.fertilizer_id) {
          return s;
        }
        return { ...s, last_performed: newLastPerformed };
      }
      return s;
    });
    saveLocalStorageData(SCHEDULES_KEY, updatedSchedules);

    if (targetActivity.type === "watering") {
      const allPlants = getLocalStorageData<Plant>(PLANTS_KEY, DEFAULT_PLANTS(user.id));
      const updatedPlants = allPlants.map(p => {
        if (p.id === targetActivity.plant_id && p.user_id === user.id) {
          return { ...p, last_watered_at: newLastPerformed };
        }
        return p;
      });
      saveLocalStorageData(PLANTS_KEY, updatedPlants);
      invalidatePlantsCache();
    }
  }
};

export const getSchedules = async (
  plantId: string | null = null,
  includeArchived: boolean = false
): Promise<Schedule[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("schedules").select("*").eq("user_id", user.id).neq("type", "watering");
    if (plantId) query = query.eq("plant_id", plantId);
    
    const { data, error } = await query;
    if (error) throw error;

    let list = (data || []).map(s => enrichSchedule(s, dbPlants, dbFertilizers));
    if (!plantId && !includeArchived) {
      list = list.filter(s => {
        const plant = dbPlants.find(p => p.id === s.plant_id);
        return plant ? !plant.archived : false;
      });
    }
    return list;
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  let list = db.schedules.filter(s => s.type !== "watering");
  if (plantId) list = list.filter(s => s.plant_id === plantId);
  
  let enrichedList = list.map(s => enrichSchedule(s, dbPlants, db.fertilizers));
  if (!plantId && !includeArchived) {
    enrichedList = enrichedList.filter(s => {
      const plant = dbPlants.find(p => p.id === s.plant_id);
      return plant ? !plant.archived : false;
    });
  }
  return enrichedList;
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
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("schedules")
      .insert(newSchedule)
      .select()
      .single();
    if (error) throw error;
    return enrichSchedule(data, dbPlants, dbFertilizers);
  }

  // Local Storage Fallback
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  allSchedules.push(newSchedule);
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);
  return enrichSchedule(newSchedule, dbPlants, DEFAULT_FERTILIZERS(user.id));
};

export const updateSchedule = async (id: string, updates: Partial<Schedule>): Promise<Schedule> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("schedules")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return enrichSchedule(data, dbPlants, dbFertilizers);
  }

  // Local Storage Fallback
  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  const idx = allSchedules.findIndex(s => s.id === id && s.user_id === user.id);
  if (idx === -1) throw new Error("Schedule not found");

  const updated = { ...allSchedules[idx], ...updates };
  allSchedules[idx] = updated;
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);
  return enrichSchedule(updated, dbPlants, DEFAULT_FERTILIZERS(user.id));
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
  customNotes?: string,
  fertilizerId?: string,
  fertilizerAmount?: string
): Promise<Schedule> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch schedule
  const schedules = await getSchedules(null, true);
  const found = schedules.find(s => s.id === id);
  if (!found) throw new Error("Schedule not found");

  let targetFertId = fertilizerId || found.fertilizer_id;
  let targetIntervalDays = found.interval_days;
  let finalDetails = customDetails;

  if (found.type === "fertilizing") {
    const fertilizers = await getFertilizers(true);
    if (!targetFertId) {
      if (fertilizers.length > 0) {
        targetFertId = fertilizers[0].id;
      } else {
        const defaultFert = await createFertilizer({
          name: "ปุ๋ยบำรุงทั่วไป",
          npk_formula: "16-16-16",
          type: "granular",
          default_interval_days: 30,
          color: "#10b981",
          description: "ปุ๋ยบำรุงเม็ดทั่วไปที่สร้างขึ้นโดยอัตโนมัติ"
        });
        targetFertId = defaultFert.id;
      }
    }

    const fertInfo = fertilizers.find(f => f.id === targetFertId);
    if (fertInfo) {
      targetIntervalDays = fertInfo.default_interval_days;
    }

    if (!finalDetails) {
      const fertLabel = fertInfo ? `${fertInfo.name} (${fertInfo.npk_formula})` : "Fertilizer";
      finalDetails = `ใส่ปุ๋ย: ${fertLabel}${fertilizerAmount ? ` — ${fertilizerAmount}` : ""}`;
    }
  }

  // Log activity
  await createActivity({
    plant_id: found.plant_id,
    type: found.type,
    date: dateStr,
    details: finalDetails || `Performed recurring scheduled task: ${found.type.charAt(0).toUpperCase() + found.type.slice(1)}`,
    notes: customNotes || "Marked as completed from schedules planner.",
    fertilizer_id: found.type === "fertilizing" ? targetFertId : undefined,
    fertilizer_amount: found.type === "fertilizing" ? fertilizerAmount : undefined,
  });

  // Update schedule
  const updated = await updateSchedule(found.id, {
    last_performed: dateStr,
    fertilizer_id: found.type === "fertilizing" ? targetFertId : undefined,
    interval_days: found.type === "fertilizing" ? targetIntervalDays : found.interval_days
  });

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

export const getWateringSchedules = async (
  plantId: string | null = null,
  includeArchived: boolean = false
): Promise<Schedule[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const dbPlants = await getPlants(null, true);

  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("schedules").select("*").eq("user_id", user.id).eq("type", "watering");
    if (plantId) query = query.eq("plant_id", plantId);
    
    const { data, error } = await query;
    if (error) throw error;

    let list = (data || []).map(s => enrichSchedule(s, dbPlants));
    if (!plantId && !includeArchived) {
      list = list.filter(s => {
        const plant = dbPlants.find(p => p.id === s.plant_id);
        return plant ? !plant.archived : false;
      });
    }
    return list;
  }

  // Local Storage Fallback
  const db = loadLocalDatabase(user.id);
  let list = db.schedules.filter(s => s.type === "watering");
  if (plantId) list = list.filter(s => s.plant_id === plantId);
  
  let enrichedList = list.map(s => enrichSchedule(s, dbPlants));
  if (!plantId && !includeArchived) {
    enrichedList = enrichedList.filter(s => {
      const plant = dbPlants.find(p => p.id === s.plant_id);
      return plant ? !plant.archived : false;
    });
  }
  return enrichedList;
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

    // Update last_watered_at and updated_at for active plants
    let updatePlantsError;
    const { error: firstTryError } = await supabase
      .from("plants")
      .update({ last_watered_at: nowStr, updated_at: nowStr })
      .in("id", activePlantIds);
    
    if (firstTryError) {
      console.warn("Failed to bulk update plants with updated_at, retrying with only last_watered_at:", firstTryError);
      const { error: retryError } = await supabase
        .from("plants")
        .update({ last_watered_at: nowStr })
        .in("id", activePlantIds);
      updatePlantsError = retryError;
    }
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
      return { ...p, last_watered_at: nowStr, updated_at: nowStr };
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
  const bulkHistory = getLocalStorageData<{ id: string; user_id: string; watered_at: string; affected_plants_count: number; created_at: string }>("plant_tracker_bulk_watering_history", []);
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

// Helper to map Schedule to PlantFertilizer for UI compatibility
const mapScheduleToPlantFertilizer = (s: Schedule): PlantFertilizer => {
  return {
    id: s.id,
    user_id: s.user_id,
    plant_id: s.plant_id,
    fertilizer_id: s.fertilizer_id || "",
    interval_days: s.interval_days,
    last_applied_date: s.last_performed,
    next_due_date: s.next_due_date || null,
    active: true,
    created_at: s.created_at,
    fertilizer_name: s.fertilizer_name,
    fertilizer_npk: s.fertilizer_npk,
    fertilizer_color: s.fertilizer_color,
    fertilizer_type: s.fertilizer_type,
    plant_name: s.plant_name,
    task_status: s.task_status as PlantFertilizer["task_status"],
  };
};

// --- Fertilizer CRUD ---

export const getFertilizers = async (includeArchived = false): Promise<Fertilizer[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  let all: Fertilizer[] = [];

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("fertilizers")
      .select("*")
      .eq("user_id", user.id);
    if (!error && data) {
      all = data;
    }
  } else {
    all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id))
      .filter(f => f.user_id === user.id);
  }

  // To compute usage_count, we query schedules of type 'fertilizing'
  let schedList: Schedule[] = [];
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from("schedules").select("*").eq("user_id", user.id).eq("type", "fertilizing");
    schedList = data || [];
  } else {
    const db = loadLocalDatabase(user.id);
    schedList = db.schedules.filter(s => s.type === "fertilizing");
  }

  const withCount = all.map(f => ({
    ...f,
    usage_count: schedList.filter(s => s.fertilizer_id === f.id).length,
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

  if (isSupabaseConfigured && supabase) {
    const { data: inserted, error } = await supabase
      .from("fertilizers")
      .insert(newFertilizer)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  all.push(newFertilizer);
  saveLocalStorageData(FERTILIZERS_KEY, all);
  return newFertilizer;
};

export const updateFertilizer = async (id: string, updates: Partial<Fertilizer>): Promise<Fertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data: updated, error } = await supabase
      .from("fertilizers")
      .update({ ...updates, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  const idx = all.findIndex(f => f.id === id && f.user_id === user.id);
  if (idx === -1) throw new Error("Fertilizer not found");

  const updated = { ...all[idx], ...updates, updated_at: now };
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

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("fertilizers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  const all = getLocalStorageData<Fertilizer>(FERTILIZERS_KEY, DEFAULT_FERTILIZERS(user.id));
  saveLocalStorageData(FERTILIZERS_KEY, all.filter(f => !(f.id === id && f.user_id === user.id)));
};

// --- Plant Fertilizer Schedule CRUD ---

export const getPlantFertilizers = async (plantId?: string): Promise<PlantFertilizer[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  let schedList: Schedule[] = [];
  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("schedules").select("*").eq("user_id", user.id).eq("type", "fertilizing");
    if (plantId) query = query.eq("plant_id", plantId);
    const { data, error } = await query;
    if (error) throw error;
    schedList = (data || []).map(s => enrichSchedule(s, dbPlants, dbFertilizers));
  } else {
    const db = loadLocalDatabase(user.id);
    let list = db.schedules.filter(s => s.type === "fertilizing");
    if (plantId) list = list.filter(s => s.plant_id === plantId);
    schedList = list.map(s => enrichSchedule(s, dbPlants, db.fertilizers));
  }

  return schedList.map(mapScheduleToPlantFertilizer);
};

export const createPlantFertilizer = async (
  data: { plant_id: string; fertilizer_id: string; interval_days: number }
): Promise<PlantFertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const newSchedule: Schedule = {
    id: crypto.randomUUID(),
    user_id: user.id,
    plant_id: data.plant_id,
    type: "fertilizing",
    interval_days: data.interval_days,
    start_date: new Date().toLocaleDateString("sv-SE"),
    last_performed: null,
    fertilizer_id: data.fertilizer_id,
    created_at: new Date().toISOString(),
  };

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    const { data: inserted, error } = await supabase
      .from("schedules")
      .insert(newSchedule)
      .select()
      .single();
    if (error) throw error;
    return mapScheduleToPlantFertilizer(enrichSchedule(inserted, dbPlants, dbFertilizers));
  }

  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  allSchedules.push(newSchedule);
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);

  return mapScheduleToPlantFertilizer(enrichSchedule(newSchedule, dbPlants, DEFAULT_FERTILIZERS(user.id)));
};

export const updatePlantFertilizer = async (id: string, updates: Partial<PlantFertilizer>): Promise<PlantFertilizer> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const scheduleUpdates: Partial<Schedule> = {};
  if (updates.interval_days !== undefined) scheduleUpdates.interval_days = updates.interval_days;
  if (updates.last_applied_date !== undefined) scheduleUpdates.last_performed = updates.last_applied_date;
  if (updates.fertilizer_id !== undefined) scheduleUpdates.fertilizer_id = updates.fertilizer_id;

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  if (isSupabaseConfigured && supabase) {
    const { data: updated, error } = await supabase
      .from("schedules")
      .update(scheduleUpdates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return mapScheduleToPlantFertilizer(enrichSchedule(updated, dbPlants, dbFertilizers));
  }

  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  const idx = allSchedules.findIndex(s => s.id === id && s.user_id === user.id);
  if (idx === -1) throw new Error("Schedule not found");

  const updated = { ...allSchedules[idx], ...scheduleUpdates };
  allSchedules[idx] = updated;
  saveLocalStorageData(SCHEDULES_KEY, allSchedules);

  return mapScheduleToPlantFertilizer(enrichSchedule(updated, dbPlants, DEFAULT_FERTILIZERS(user.id)));
};

export const deletePlantFertilizer = async (id: string): Promise<void> => {
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

  const allSchedules = getLocalStorageData<Schedule>(SCHEDULES_KEY, DEFAULT_SCHEDULES(user.id));
  saveLocalStorageData(SCHEDULES_KEY, allSchedules.filter(s => !(s.id === id && s.user_id === user.id)));
};

// --- Apply Fertilizer Workflow ---

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

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);
  
  let schedule: Schedule;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", plantFertilizerId)
      .single();
    if (error) throw error;
    schedule = data;
  } else {
    const db = loadLocalDatabase(user.id);
    const found = db.schedules.find(s => s.id === plantFertilizerId);
    if (!found) throw new Error("Schedule not found");
    schedule = found;
  }

  const fertInfo = dbFertilizers.find(f => f.id === schedule.fertilizer_id);
  const updatedSchedule = await updateSchedule(schedule.id, { 
    last_performed: applied_date,
    interval_days: fertInfo ? fertInfo.default_interval_days : schedule.interval_days
  });

  const fertLabel = fertInfo ? `${fertInfo.name} (${fertInfo.npk_formula})` : "Fertilizer";

  const newActivity = await createActivity({
    plant_id: schedule.plant_id,
    type: "fertilizing",
    date: applied_date,
    details: `ใส่ปุ๋ย: ${fertLabel}${amount ? ` — ${amount}` : ""}`,
    notes: note,
    fertilizer_id: schedule.fertilizer_id,
    fertilizer_amount: amount,
  });

  const enrichedPF = mapScheduleToPlantFertilizer(enrichSchedule(updatedSchedule, dbPlants, dbFertilizers));
  
  const plant = dbPlants.find(p => p.id === schedule.plant_id);
  const enrichedHistory: FertilizerHistory = {
    id: newActivity.id,
    user_id: user.id,
    plant_id: schedule.plant_id,
    fertilizer_id: schedule.fertilizer_id || "",
    applied_date: applied_date,
    amount: amount,
    note: note,
    created_at: newActivity.created_at,
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

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);
  const fertInfo = dbFertilizers.find(f => f.id === fertilizerId);
  const fertLabel = fertInfo ? `${fertInfo.name} (${fertInfo.npk_formula})` : "Fertilizer";

  const newActivity = await createActivity({
    plant_id: plantId,
    type: "fertilizing",
    date: applied_date,
    details: `ใส่ปุ๋ย: ${fertLabel}${amount ? ` — ${amount}` : ""}`,
    notes: note,
    fertilizer_id: fertilizerId,
    fertilizer_amount: amount,
  });

  let scheduleToUpdate: Schedule | null = null;
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("plant_id", plantId)
      .eq("type", "fertilizing");
    if (data && data.length > 0) {
      const exactMatch = data.find(s => s.fertilizer_id === fertilizerId);
      if (exactMatch) {
        scheduleToUpdate = exactMatch;
      } else {
        const genericMatch = data.find(s => !s.fertilizer_id);
        if (genericMatch) {
          scheduleToUpdate = genericMatch;
        } else {
          scheduleToUpdate = data[0];
        }
      }
    }
  } else {
    const db = loadLocalDatabase(user.id);
    const plantScheds = db.schedules.filter(s => s.plant_id === plantId && s.type === "fertilizing");
    if (plantScheds.length > 0) {
      const exactMatch = plantScheds.find(s => s.fertilizer_id === fertilizerId);
      if (exactMatch) {
        scheduleToUpdate = exactMatch;
      } else {
        const genericMatch = plantScheds.find(s => !s.fertilizer_id);
        if (genericMatch) {
          scheduleToUpdate = genericMatch;
        } else {
          scheduleToUpdate = plantScheds[0];
        }
      }
    }
  }

  if (scheduleToUpdate) {
    await updateSchedule(scheduleToUpdate.id, {
      last_performed: applied_date,
      fertilizer_id: fertilizerId,
      interval_days: fertInfo ? fertInfo.default_interval_days : scheduleToUpdate.interval_days
    });
  }

  const plant = dbPlants.find(p => p.id === plantId);
  return {
    id: newActivity.id,
    user_id: user.id,
    plant_id: plantId,
    fertilizer_id: fertilizerId,
    applied_date: applied_date,
    amount: amount,
    note: note,
    created_at: newActivity.created_at,
    plant_name: plant ? plant.name : "Unknown Plant",
    fertilizer_name: fertInfo ? fertInfo.name : "Unknown",
    fertilizer_npk: fertInfo ? fertInfo.npk_formula : "",
    fertilizer_color: fertInfo ? fertInfo.color : "#10b981",
  };
};

export const getFertilizerHistory = async (
  plantId?: string,
  limit?: number,
  maxResults = 20
): Promise<FertilizerHistory[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  let actList: Activity[] = [];
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from("activities").select("*").eq("user_id", user.id).eq("type", "fertilizing");
    if (plantId) query = query.eq("plant_id", plantId);
    query = query.order("date", { ascending: false });
    if (limit || maxResults) query = query.limit(limit || maxResults);
    const { data, error } = await query;
    if (!error && data) actList = data;
  } else {
    const db = loadLocalDatabase(user.id);
    let list = db.activities.filter(a => a.type === "fertilizing");
    if (plantId) list = list.filter(a => a.plant_id === plantId);
    list = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (limit || maxResults) list = list.slice(0, limit || maxResults);
    actList = list;
  }

  const dbPlants = await getPlants(null, true);
  const dbFertilizers = await getFertilizers(true);

  return actList.map(a => {
    const plant = dbPlants.find(p => p.id === a.plant_id);
    const fertInfo = dbFertilizers.find(f => f.id === a.fertilizer_id);
    return {
      id: a.id,
      user_id: a.user_id,
      plant_id: a.plant_id,
      fertilizer_id: a.fertilizer_id || "",
      applied_date: a.date,
      amount: a.fertilizer_amount || "",
      note: a.notes,
      created_at: a.created_at,
      plant_name: plant ? plant.name : "Unknown Plant",
      fertilizer_name: fertInfo ? fertInfo.name : "Unknown",
      fertilizer_npk: fertInfo ? fertInfo.npk_formula : "",
      fertilizer_color: fertInfo ? fertInfo.color : "#10b981",
    };
  });
};

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
    const mockFertilizers = DEFAULT_FERTILIZERS(userId);
    const mockActivities = DEFAULT_ACTIVITIES(userId);
    const mockSchedules = DEFAULT_SCHEDULES(userId);

    // 2. Maps to store UUID mappings
    const gardenIdMap: Record<string, string> = {};
    const plantIdMap: Record<string, string> = {};
    const fertilizerIdMap: Record<string, string> = {};

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

    // 4. Import Fertilizers
    const fertilizersToInsert = mockFertilizers.map(f => {
      const newUuid = crypto.randomUUID();
      fertilizerIdMap[f.id] = newUuid;
      return {
        id: newUuid,
        user_id: userId,
        name: f.name,
        npk_formula: f.npk_formula || "",
        type: f.type,
        default_interval_days: f.default_interval_days,
        color: f.color || "",
        description: f.description || "",
        is_archived: f.is_archived || false,
        created_at: f.created_at || new Date().toISOString(),
        updated_at: f.updated_at || new Date().toISOString()
      };
    });

    const { error: fError } = await supabase.from("fertilizers").insert(fertilizersToInsert);
    if (fError) throw fError;

    // 5. Import Plants
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

    // 6. Import Schedules
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
        fertilizer_id: s.fertilizer_id ? fertilizerIdMap[s.fertilizer_id] || null : null,
        created_at: s.created_at || new Date().toISOString()
      };
    }).filter((s): s is NonNullable<typeof s> => !!s);

    if (schedulesToInsert.length > 0) {
      const { error: sError } = await supabase.from("schedules").insert(schedulesToInsert);
      if (sError) throw sError;
    }

    // 7. Import Activities
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
        fertilizer_id: a.fertilizer_id ? fertilizerIdMap[a.fertilizer_id] || null : null,
        fertilizer_amount: a.fertilizer_amount || null,
        created_at: a.created_at || new Date().toISOString()
      };
    }).filter((a): a is NonNullable<typeof a> => !!a);

    if (activitiesToInsert.length > 0) {
      const { error: aError } = await supabase.from("activities").insert(activitiesToInsert);
      if (aError) throw aError;
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    console.error("Failed to seed Supabase:", err);
    return { success: false, error: err as Error };
  }
};

