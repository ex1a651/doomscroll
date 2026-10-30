import { requireNativeModule } from 'expo';

export type AppId = 'instagram' | 'youtube' | 'facebook';

export type DailyRow = {
  day: string; // YYYY-MM-DD
  app: AppId;
  swipes: number;
  reels: number; // estimated reels (first swipe of a session = 2, then +1)
  sessions: number;
  opens: number;
  fgMs: number; // foreground time in ms
};

export type HourlyRow = { day: string; hour: number; swipes: number; reels: number };

export type Status = {
  usageAccess: boolean;
  accessibilityEnabled: boolean;
  serviceRunning: boolean;
  batteryUnrestricted: boolean;
  lastSwipeAt: number;
  lastConnectedAt: number;
  startupError: string;
  crash: string;
};

export type DebugEntry = { t: number; app: AppId; dy: number; counted: boolean; note: string };

type DoomscrollNative = {
  getStatus(): Status;
  openUsageAccessSettings(): boolean;
  openAccessibilitySettings(): boolean;
  openAppDetails(): boolean;
  requestBatteryUnrestricted(): void;
  syncUsage(days: number): Promise<boolean>;
  getDaily(from: string, to: string): Promise<DailyRow[]>;
  getHourly(from: string, to: string): Promise<HourlyRow[]>;
  getDebugLog(): DebugEntry[];
  clearDebugLog(): void;
  clearCrash(): void;
  getSettleMs(): number;
  setSettleMs(ms: number): number;
};

export default requireNativeModule<DoomscrollNative>('Doomscroll');
