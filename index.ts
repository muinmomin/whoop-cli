interface LoginResponse {
  AuthenticationResult?: {
    AccessToken: string;
    ExpiresIn: number;
  };
}

interface TokenData {
  accessToken: string;
  expiresAt: number;
}

interface DailyStatsOutput {
  date: string;
  day: {
    start: string | null;
    end: string | null;
  };
  sleep: {
    score: number | null;
    hours: string | null;
    hoursVsNeeded: number | null;
    hoursNeeded: string | null;
    hours30dAvg: string | null;
    efficiency: number | null;
    rhr: {
      value: number | null;
      avg30d: number | null;
    };
    hrv: {
      value: number | null;
      avg30d: number | null;
    };
    bedTime: string | null;
    wakeTime: string | null;
    stages: {
      rem: string | null;
      deep: string | null;
      light: string | null;
    };
  };
  steps: {
    value: number | null;
    avg30d: number | null;
  };
  workouts: Array<{
    name: string;
    start: string | null;
    end: string | null;
    duration: string | null;
  }>;
  healthspan: {
    whoopAge: number | null;
    yearsDifference: number | null;
    paceOfAging: number | null;
    nextUpdateIn: string | null;
  };
}

interface RangeStatsOutput {
  startDate: string;
  endDate: string;
  days: number;
  sleep: {
    avgScore: number | null;
    minScore: number | null;
    maxScore: number | null;
  };
  rhr: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  steps: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  workouts: {
    total: number;
    types: string[];
  };
  healthspan: {
    whoopAge: number | null;
    yearsDifference: number | null;
    paceOfAging: number | null;
  };
}

interface KeyStat {
  current: string | null;
  thirtyDay: string | null;
}

const MACHINE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const WHOOP_API_BASE_URL = "https://api.prod.whoop.com";

class WhoopClient {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private tokenData: TokenData | null = null;
  private readonly clientId = "";

  constructor(input: { email: string; password: string }) {
    this.email = input.email;
    this.password = input.password;
    this.baseUrl = WHOOP_API_BASE_URL;
  }

  async login(): Promise<TokenData> {
    const url = `${this.baseUrl}/auth-service/v3/whoop`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Host: "api.prod.whoop.com",
        Accept: "*/*",
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthParameters: {
          USERNAME: this.email,
          PASSWORD: this.password,
        },
        ClientId: this.clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Login failed: ${response.status} ${response.statusText}${await formatResponseExcerpt(response)}`
      );
    }

    const data = (await response.json()) as LoginResponse;
    const auth = data.AuthenticationResult;
    if (!auth?.AccessToken || typeof auth.ExpiresIn !== "number") {
      throw new Error("Login failed: authentication token not present in response");
    }

    this.tokenData = {
      accessToken: auth.AccessToken,
      expiresAt: Date.now() + auth.ExpiresIn * 1000,
    };

    return this.tokenData;
  }

  async getHome(date: string): Promise<unknown> {
    return this.get(`/home-service/v1/home?date=${date}`);
  }

  async getSleep(date: string): Promise<unknown> {
    return this.get(`/home-service/v1/deep-dive/sleep?date=${date}`);
  }

  async getSleepLastNight(date: string): Promise<unknown> {
    return this.get(`/home-service/v1/deep-dive/sleep/last-night?date=${date}`);
  }

  async getStrain(date: string): Promise<unknown> {
    return this.get(`/home-service/v1/deep-dive/strain?date=${date}`);
  }

  async getHealthspan(date: string): Promise<unknown> {
    return this.get(`/healthspan-service/v1/healthspan/bff?date=${date}`);
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokenData) {
      await this.login();
      return;
    }

    const expiresInMs = this.tokenData.expiresAt - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      await this.login();
    }
  }

  private async get(path: string): Promise<unknown> {
    let retried = false;

    while (true) {
      await this.ensureValidToken();
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: await this.getHeaders(),
      });

      if (response.ok) {
        return response.json();
      }

      if (response.status === 401 && !retried) {
        retried = true;
        await this.login();
        continue;
      }

      throw new Error(
        `Whoop API error: ${response.status} ${response.statusText}${await formatResponseExcerpt(response)}`
      );
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    await this.ensureValidToken();
    if (!this.tokenData) {
      throw new Error("No access token available");
    }

    return {
      Host: "api.prod.whoop.com",
      Authorization: `Bearer ${this.tokenData.accessToken}`,
      Accept: "*/*",
      "User-Agent": "iOS",
      "Content-Type": "application/json",
      "X-WHOOP-Device-Platform": "iOS",
      "X-WHOOP-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      Locale: "en_US",
      Currency: "USD",
    };
  }
}

type FlagValue = string | boolean;

function parseFlags(tokens: string[]): Record<string, FlagValue> {
  const flags: Record<string, FlagValue> = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Use "--help" for usage.`);
    }

    const key = token.slice(2);
    const next = tokens[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
      continue;
    }

    flags[key] = true;
  }

  return flags;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Create /Users/muin/Developer/whoop-cli/.env from /Users/muin/Developer/whoop-cli/.env.example`
    );
  }
  return value;
}

function getFlagString(flags: Record<string, FlagValue>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(flags: Record<string, FlagValue>, key: string): boolean {
  return key in flags;
}

function getDefaultDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD`);
  }
  return value;
}

function ensureDateRange(startDate: string, endDate: string): void {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Invalid date range");
  }
  if (start > end) {
    throw new Error(`Invalid range: ${startDate} is after ${endDate}`);
  }
}

function toDateList(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function normalizeWhoopTimestamp(raw?: string | null): string | null {
  if (!raw) {
    return null;
  }
  return raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function parseDate(raw?: string | null): Date | null {
  const normalized = normalizeWhoopTimestamp(raw);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toLocalIso(raw?: string | null): string | null {
  const parsed = parseDate(raw);
  if (!parsed) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  const hour = `${parsed.getHours()}`.padStart(2, "0");
  const minute = `${parsed.getMinutes()}`.padStart(2, "0");
  const second = `${parsed.getSeconds()}`.padStart(2, "0");
  const offset = -parsed.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const offsetHour = `${Math.floor(absOffset / 60)}`.padStart(2, "0");
  const offsetMinute = `${absOffset % 60}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
}

function parseDisplayNumber(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const sanitized = value.replace(/[^0-9.-]/g, "");
  if (!sanitized) {
    return null;
  }
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDisplayInt(value?: string | null): number | null {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed);
}

function formatDurationBetween(start: Date | null, end: Date | null): string | null {
  if (!start || !end) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return null;
  }

  const totalSeconds = Math.round(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 && hours === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.length > 0 ? parts.join(" ") : "0m";
}

function formatClock(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return trimmed;
  }
  return `${Number.parseInt(match[1], 10)}h ${Number.parseInt(match[2], 10)}m`;
}

function normalizeWorkoutName(raw?: string | null): string {
  if (!raw) {
    return "Workout";
  }
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseNextUpdateIn(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(/NEXT UPDATE IN\s+(.+)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return value.toLowerCase();
}

function getOverviewPillar(overview: any): any | null {
  if (!Array.isArray(overview?.pillars)) {
    return null;
  }
  return overview.pillars.find((pillar: any) => pillar?.type === "OVERVIEW") ?? null;
}

function getKeyStats(overview: any): Record<string, KeyStat> {
  const stats: Record<string, KeyStat> = {};
  const overviewPillar = getOverviewPillar(overview);
  if (!overviewPillar || !Array.isArray(overviewPillar.sections)) {
    return stats;
  }

  for (const section of overviewPillar.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }

    for (const item of section.items) {
      if (item?.type !== "KEY_STATISTIC") {
        continue;
      }
      const trendKey = item?.content?.trend_key;
      if (typeof trendKey !== "string") {
        continue;
      }
      stats[trendKey] = {
        current:
          typeof item?.content?.current_value_display === "string"
            ? item.content.current_value_display
            : null,
        thirtyDay:
          typeof item?.content?.thirty_day_value_display === "string"
            ? item.content.thirty_day_value_display
            : null,
      };
    }
  }

  return stats;
}

function getSleepActivityFromOverview(overview: any): any | null {
  const overviewPillar = getOverviewPillar(overview);
  if (!overviewPillar || !Array.isArray(overviewPillar.sections)) {
    return null;
  }

  for (const section of overviewPillar.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "ITEMS_CARD" || !Array.isArray(item?.content?.items)) {
        continue;
      }
      for (const activity of item.content.items) {
        if (activity?.type !== "ACTIVITY") {
          continue;
        }
        const title = `${activity?.content?.title ?? ""}`.toUpperCase();
        const kind = `${activity?.content?.type ?? ""}`.toUpperCase();
        if (title === "SLEEP" || kind === "SLEEP") {
          return activity.content;
        }
      }
    }
  }

  return null;
}

function getActivitiesFromOverview(overview: any): Array<{ title: string | null; start: string | null; end: string | null; type: string | null }> {
  const output: Array<{ title: string | null; start: string | null; end: string | null; type: string | null }> = [];
  const overviewPillar = getOverviewPillar(overview);
  if (!overviewPillar || !Array.isArray(overviewPillar.sections)) {
    return output;
  }

  for (const section of overviewPillar.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "ITEMS_CARD" || !Array.isArray(item?.content?.items)) {
        continue;
      }
      for (const activity of item.content.items) {
        if (activity?.type !== "ACTIVITY") {
          continue;
        }
        output.push({
          title: typeof activity?.content?.title === "string" ? activity.content.title : null,
          type: typeof activity?.content?.type === "string" ? activity.content.type : null,
          start:
            typeof activity?.content?.during?.lower_endpoint === "string"
              ? activity.content.during.lower_endpoint
              : null,
          end:
            typeof activity?.content?.during?.upper_endpoint === "string"
              ? activity.content.during.upper_endpoint
              : null,
        });
      }
    }
  }

  return output;
}

function getActivitiesFromStrain(strain: any): Array<{ title: string | null; start: string | null; end: string | null; type: string | null }> {
  const output: Array<{ title: string | null; start: string | null; end: string | null; type: string | null }> = [];
  if (!Array.isArray(strain?.sections)) {
    return output;
  }

  for (const section of strain.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "ACTIVITY") {
        continue;
      }
      output.push({
        title: typeof item?.content?.title === "string" ? item.content.title : null,
        type: typeof item?.content?.type === "string" ? item.content.type : null,
        start:
          typeof item?.content?.during?.lower_endpoint === "string"
            ? item.content.during.lower_endpoint
            : null,
        end:
          typeof item?.content?.during?.upper_endpoint === "string"
            ? item.content.during.upper_endpoint
            : null,
      });
    }
  }

  return output;
}

function buildWorkouts(
  overview: any,
  strain: any
): Array<{ name: string; start: string | null; end: string | null; duration: string | null }> {
  const combined = [...getActivitiesFromOverview(overview), ...getActivitiesFromStrain(strain)];
  const workouts: Array<{ name: string; start: string | null; end: string | null; duration: string | null }> = [];
  const seen = new Set<string>();

  for (const activity of combined) {
    const title = `${activity.title ?? ""}`.toUpperCase();
    const type = `${activity.type ?? ""}`.toUpperCase();
    if (!title || title === "SLEEP" || type === "SLEEP") {
      continue;
    }

    const name = normalizeWorkoutName(activity.title);
    const startDate = parseDate(activity.start);
    const endDate = parseDate(activity.end);
    const start = startDate ? startDate.toISOString() : null;
    const end = endDate ? endDate.toISOString() : null;
    const duration = formatDurationBetween(startDate, endDate);
    const key = `${name}|${start ?? ""}|${end ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    workouts.push({ name, start, end, duration });
  }

  workouts.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  return workouts;
}

function getSleepScore(sleep: any): number | null {
  if (!Array.isArray(sleep?.sections)) {
    return null;
  }
  for (const section of sleep.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "SCORE_GAUGE") {
        continue;
      }
      return parseDisplayInt(item?.content?.score_display);
    }
  }
  return null;
}

function getSleepEfficiency(sleep: any): number | null {
  if (!Array.isArray(sleep?.sections)) {
    return null;
  }
  for (const section of sleep.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "CONTRIBUTORS_TILE" || !Array.isArray(item?.content?.metrics)) {
        continue;
      }
      for (const metric of item.content.metrics) {
        if (metric?.id === "CONTRIBUTORS_TILE_IN_SLEEP_EFFICIENCY") {
          return parseDisplayInt(metric?.status);
        }
      }
    }
  }
  return null;
}

function getSleepHoursVsNeeded(sleep: any): number | null {
  if (!Array.isArray(sleep?.sections)) {
    return null;
  }
  for (const section of sleep.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "CONTRIBUTORS_TILE" || !Array.isArray(item?.content?.metrics)) {
        continue;
      }
      for (const metric of item.content.metrics) {
        if (metric?.id === "CONTRIBUTORS_TILE_HOURS_V_NEEDED") {
          return parseDisplayInt(metric?.status);
        }
      }
    }
  }
  return null;
}

function getSleepStages(lastNight: any): { rem: string | null; deep: string | null; light: string | null } {
  const stages = { rem: null as string | null, deep: null as string | null, light: null as string | null };
  if (!Array.isArray(lastNight?.sections)) {
    return stages;
  }

  for (const section of lastNight.sections) {
    if (!Array.isArray(section.items)) {
      continue;
    }
    for (const item of section.items) {
      if (item?.type !== "DETAILS_GRAPHING_CARD" || item?.content?.id !== "hours_of_sleep") {
        continue;
      }
      const cardContent = Array.isArray(item?.content?.card_content) ? item.content.card_content : [];
      const barCard = cardContent.find((entry: any) => entry?.type === "BAR_GRAPH_CARD");
      const zones = Array.isArray(barCard?.content?.heart_rate_zones) ? barCard.content.heart_rate_zones : [];
      for (const zone of zones) {
        const id = zone?.id;
        const value = formatClock(zone?.bar_graph_tile_time_display);
        if (id === "REM_SLEEP") {
          stages.rem = value;
        } else if (id === "SWS_SLEEP") {
          stages.deep = value;
        } else if (id === "LIGHT_SLEEP") {
          stages.light = value;
        }
      }
      return stages;
    }
  }

  return stages;
}

function getBedWakeTimes(lastNight: any, overview: any): { bedTime: string | null; wakeTime: string | null } {
  const headerParams = lastNight?.header_section?.destination?.parameters;
  const fromLastNight = {
    bedTime: toLocalIso(typeof headerParams?.start_time === "string" ? headerParams.start_time : null),
    wakeTime: toLocalIso(typeof headerParams?.end_time === "string" ? headerParams.end_time : null),
  };

  if (fromLastNight.bedTime && fromLastNight.wakeTime) {
    return fromLastNight;
  }

  const sleepActivity = getSleepActivityFromOverview(overview);
  return {
    bedTime: fromLastNight.bedTime ?? toLocalIso(sleepActivity?.during?.lower_endpoint),
    wakeTime: fromLastNight.wakeTime ?? toLocalIso(sleepActivity?.during?.upper_endpoint),
  };
}

function getDayEndTime(overview: any): string | null {
  const raw = overview?.metadata?.cycle_metadata?.during?.upper_endpoint;
  if (typeof raw !== "string") {
    return null;
  }
  return toLocalIso(raw);
}

function healthspanSummary(healthspan: any): {
  whoopAge: number | null;
  yearsDifference: number | null;
  paceOfAging: number | null;
  nextUpdateIn: string | null;
} {
  const styleValues = healthspan?.unlocked_content?.whoop_age_amoeba?.style_values;
  return {
    whoopAge:
      typeof styleValues?.age === "number"
        ? Number(styleValues.age.toFixed(1))
        : parseDisplayNumber(healthspan?.unlocked_content?.whoop_age_amoeba?.age_value_display),
    yearsDifference:
      typeof styleValues?.years_difference === "number"
        ? Number(styleValues.years_difference.toFixed(1))
        : null,
    paceOfAging:
      typeof styleValues?.pace_of_aging === "number"
        ? Number(styleValues.pace_of_aging.toFixed(1))
        : parseDisplayNumber(healthspan?.unlocked_content?.whoop_age_amoeba?.pace_of_aging_display),
    nextUpdateIn: parseNextUpdateIn(
      typeof healthspan?.navigation_subtitle === "string" ? healthspan.navigation_subtitle : null
    ),
  };
}

function formatNumber(value: number | null, fractionDigits = 0): string {
  if (value === null) {
    return "n/a";
  }
  return value.toFixed(fractionDigits);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${value}%`;
}

function formatHumanDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: MACHINE_TIME_ZONE,
  });
}

function formatHumanDateTime(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: MACHINE_TIME_ZONE,
  });
}

function formatDailyStatsText(output: DailyStatsOutput): string {
  const lines: string[] = [];
  lines.push(`WHOOP Stats (${formatHumanDate(output.date)})`);
  lines.push(`Timezone: ${MACHINE_TIME_ZONE}`);
  lines.push("");

  lines.push("Day");
  lines.push(`  Start: ${formatHumanDateTime(output.day.start)}`);
  lines.push(`  End: ${formatHumanDateTime(output.day.end)}`);
  lines.push("");

  lines.push("Sleep");
  lines.push(`  Score: ${formatPercent(output.sleep.score)}`);
  lines.push(`  Hours: ${output.sleep.hours ?? "n/a"}`);
  lines.push(`  Hours vs Needed: ${formatPercent(output.sleep.hoursVsNeeded)}`);
  lines.push(`  Hours Needed: ${output.sleep.hoursNeeded ?? "n/a"}`);
  lines.push(`  Hours 30d Avg: ${output.sleep.hours30dAvg ?? "n/a"}`);
  lines.push(`  Efficiency: ${formatPercent(output.sleep.efficiency)}`);
  lines.push(`  RHR: ${formatNumber(output.sleep.rhr.value)} (30d avg: ${formatNumber(output.sleep.rhr.avg30d)})`);
  lines.push(`  HRV: ${formatNumber(output.sleep.hrv.value)} (30d avg: ${formatNumber(output.sleep.hrv.avg30d)})`);
  lines.push(`  Bed Time: ${formatHumanDateTime(output.sleep.bedTime)}`);
  lines.push(`  Wake Time: ${formatHumanDateTime(output.sleep.wakeTime)}`);
  lines.push(`  Stage REM: ${output.sleep.stages.rem ?? "n/a"}`);
  lines.push(`  Stage Deep: ${output.sleep.stages.deep ?? "n/a"}`);
  lines.push(`  Stage Light: ${output.sleep.stages.light ?? "n/a"}`);
  lines.push("");

  lines.push("Steps");
  lines.push(`  Value: ${formatNumber(output.steps.value)}`);
  lines.push(`  Avg 30d: ${formatNumber(output.steps.avg30d)}`);
  lines.push("");

  lines.push("Workouts");
  if (output.workouts.length === 0) {
    lines.push("  None");
  } else {
    for (const workout of output.workouts) {
      lines.push(`  - ${workout.name}`);
      lines.push(`    Start: ${formatHumanDateTime(workout.start)}`);
      lines.push(`    End: ${formatHumanDateTime(workout.end)}`);
      lines.push(`    Duration: ${workout.duration ?? "n/a"}`);
    }
  }
  lines.push("");

  lines.push("Healthspan");
  lines.push(`  WHOOP Age: ${formatNumber(output.healthspan.whoopAge, 1)}`);
  lines.push(`  Years Difference: ${formatNumber(output.healthspan.yearsDifference, 1)}`);
  lines.push(`  Pace of Aging: ${output.healthspan.paceOfAging === null ? "n/a" : `${output.healthspan.paceOfAging.toFixed(1)}x`}`);
  lines.push(`  Next Update In: ${output.healthspan.nextUpdateIn ?? "n/a"}`);

  return lines.join("\n");
}

function formatRangeStatsText(output: RangeStatsOutput): string {
  const lines: string[] = [];
  lines.push(
    `WHOOP Stats (${formatHumanDate(output.startDate)} -> ${formatHumanDate(output.endDate)})`
  );
  lines.push(`Timezone: ${MACHINE_TIME_ZONE}`);
  lines.push(`Days: ${output.days}`);
  lines.push("");

  lines.push("Sleep");
  lines.push(`  Avg Score: ${formatNumber(output.sleep.avgScore)}`);
  lines.push(`  Min Score: ${formatNumber(output.sleep.minScore)}`);
  lines.push(`  Max Score: ${formatNumber(output.sleep.maxScore)}`);
  lines.push("");

  lines.push("RHR");
  lines.push(`  Avg: ${formatNumber(output.rhr.avg)}`);
  lines.push(`  Min: ${formatNumber(output.rhr.min)}`);
  lines.push(`  Max: ${formatNumber(output.rhr.max)}`);
  lines.push("");

  lines.push("Steps");
  lines.push(`  Avg: ${formatNumber(output.steps.avg)}`);
  lines.push(`  Min: ${formatNumber(output.steps.min)}`);
  lines.push(`  Max: ${formatNumber(output.steps.max)}`);
  lines.push("");

  lines.push("Workouts");
  lines.push(`  Total: ${output.workouts.total}`);
  lines.push(`  Types: ${output.workouts.types.length > 0 ? output.workouts.types.join(", ") : "none"}`);
  lines.push("");

  lines.push("Healthspan (end date snapshot)");
  lines.push(`  WHOOP Age: ${formatNumber(output.healthspan.whoopAge, 1)}`);
  lines.push(`  Years Difference: ${formatNumber(output.healthspan.yearsDifference, 1)}`);
  lines.push(`  Pace of Aging: ${output.healthspan.paceOfAging === null ? "n/a" : `${output.healthspan.paceOfAging.toFixed(1)}x`}`);

  return lines.join("\n");
}

function numericSummary(values: number[]): { avg: number | null; min: number | null; max: number | null } {
  if (values.length === 0) {
    return { avg: null, min: null, max: null };
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

async function buildDailyStats(client: WhoopClient, date: string): Promise<DailyStatsOutput> {
  const [overview, sleep, strain, healthspan, sleepLastNight] = (await Promise.all([
    client.getHome(date),
    client.getSleep(date),
    client.getStrain(date),
    client.getHealthspan(date),
    client.getSleepLastNight(date),
  ])) as [any, any, any, any, any];

  const keyStats = getKeyStats(overview);
  const stages = getSleepStages(sleepLastNight);
  const bedWake = getBedWakeTimes(sleepLastNight, overview);
  const dayEnd = getDayEndTime(overview);
  const workouts = buildWorkouts(overview, strain);
  const health = healthspanSummary(healthspan);

  const sleepHours = formatClock(keyStats.SLEEP_HOURS?.current);
  const sleepNeeded = formatClock(keyStats.SLEEP_NEED?.current);
  const sleepHours30 = formatClock(keyStats.SLEEP_HOURS?.thirtyDay);
  const rhrValue = parseDisplayInt(keyStats.RHR?.current);
  const rhr30 = parseDisplayInt(keyStats.RHR?.thirtyDay);
  const hrvValue = parseDisplayInt(keyStats.HRV?.current);
  const hrv30 = parseDisplayInt(keyStats.HRV?.thirtyDay);
  const stepsValue = parseDisplayInt(keyStats.STEPS?.current);
  const steps30 = parseDisplayInt(keyStats.STEPS?.thirtyDay);
  const sleepScore = getSleepScore(sleep);
  const sleepEfficiency = getSleepEfficiency(sleep);
  const sleepHoursVsNeeded = getSleepHoursVsNeeded(sleep);

  return {
    date,
    day: {
      start: bedWake.wakeTime,
      end: dayEnd,
    },
    sleep: {
      score: sleepScore,
      hours: sleepHours,
      hoursVsNeeded: sleepHoursVsNeeded,
      hoursNeeded: sleepNeeded,
      hours30dAvg: sleepHours30,
      efficiency: sleepEfficiency,
      rhr: {
        value: rhrValue,
        avg30d: rhr30,
      },
      hrv: {
        value: hrvValue,
        avg30d: hrv30,
      },
      bedTime: bedWake.bedTime,
      wakeTime: bedWake.wakeTime,
      stages,
    },
    steps: {
      value: stepsValue,
      avg30d: steps30,
    },
    workouts,
    healthspan: {
      whoopAge: health.whoopAge,
      yearsDifference: health.yearsDifference,
      paceOfAging: health.paceOfAging,
      nextUpdateIn: health.nextUpdateIn,
    },
  };
}

async function buildRangeStats(client: WhoopClient, startDate: string, endDate: string): Promise<RangeStatsOutput> {
  const dates = toDateList(startDate, endDate);
  const overviews = (await Promise.all(dates.map((date) => client.getHome(date)))) as any[];
  const healthspan = (await client.getHealthspan(endDate)) as any;

  const sleepScores: number[] = [];
  const rhrValues: number[] = [];
  const stepValues: number[] = [];
  let workoutTotal = 0;
  const workoutTypes = new Set<string>();

  for (const overview of overviews) {
    const keyStats = getKeyStats(overview);
    const sleepScore = parseDisplayInt(keyStats.SLEEP_PERFORMANCE?.current);
    const rhr = parseDisplayInt(keyStats.RHR?.current);
    const steps = parseDisplayInt(keyStats.STEPS?.current);

    if (sleepScore !== null) {
      sleepScores.push(sleepScore);
    }
    if (rhr !== null) {
      rhrValues.push(rhr);
    }
    if (steps !== null) {
      stepValues.push(steps);
    }

    const dailyWorkouts = buildWorkouts(overview, null);
    workoutTotal += dailyWorkouts.length;
    for (const workout of dailyWorkouts) {
      workoutTypes.add(workout.name);
    }
  }

  const sleepSummary = numericSummary(sleepScores);
  const rhrSummary = numericSummary(rhrValues);
  const stepsSummary = numericSummary(stepValues);
  const health = healthspanSummary(healthspan);

  return {
    startDate,
    endDate,
    days: dates.length,
    sleep: {
      avgScore: sleepSummary.avg,
      minScore: sleepSummary.min,
      maxScore: sleepSummary.max,
    },
    rhr: {
      avg: rhrSummary.avg,
      min: rhrSummary.min,
      max: rhrSummary.max,
    },
    steps: {
      avg: stepsSummary.avg,
      min: stepsSummary.min,
      max: stepsSummary.max,
    },
    workouts: {
      total: workoutTotal,
      types: [...workoutTypes].sort(),
    },
    healthspan: {
      whoopAge: health.whoopAge,
      yearsDifference: health.yearsDifference,
      paceOfAging: health.paceOfAging,
    },
  };
}

async function runAuth(tokens: string[]): Promise<void> {
  const flags = parseFlags(tokens);
  const allowedFlags = new Set(["help"]);
  for (const key of Object.keys(flags)) {
    if (!allowedFlags.has(key)) {
      throw new Error(`Unknown flag "--${key}". Run "bun run auth --help"`);
    }
  }

  if (hasFlag(flags, "help")) {
    printAuthHelp();
    return;
  }

  const client = createClientFromEnv();
  const token = await client.login();
  console.log("Authentication succeeded.");
  console.log(`Token expires: ${new Date(token.expiresAt).toISOString()}`);
}

async function runStats(tokens: string[]): Promise<void> {
  const flags = parseFlags(tokens);
  const allowedFlags = new Set(["help", "date", "startDate", "endDate", "text", "json"]);
  for (const key of Object.keys(flags)) {
    if (!allowedFlags.has(key)) {
      throw new Error(`Unknown flag "--${key}". Run "bun run stats --help"`);
    }
  }

  if (hasFlag(flags, "help")) {
    printStatsHelp();
    return;
  }

  const wantsText = hasFlag(flags, "text");
  const wantsJson = hasFlag(flags, "json");
  if (wantsText && wantsJson) {
    throw new Error('Use either "--text" or "--json", not both.');
  }
  const outputFormat: "json" | "text" = wantsText ? "text" : "json";

  const dateFlag = getFlagString(flags, "date");
  const startDateFlag = getFlagString(flags, "startDate");
  const endDateFlag = getFlagString(flags, "endDate");

  if (hasFlag(flags, "date") && !dateFlag) {
    throw new Error('The "--date" flag requires a value in YYYY-MM-DD format.');
  }
  if (hasFlag(flags, "startDate") && !startDateFlag) {
    throw new Error('The "--startDate" flag requires a value in YYYY-MM-DD format.');
  }
  if (hasFlag(flags, "endDate") && !endDateFlag) {
    throw new Error('The "--endDate" flag requires a value in YYYY-MM-DD format.');
  }

  if (dateFlag && (startDateFlag || endDateFlag)) {
    throw new Error("Use either --date OR --startDate/--endDate");
  }
  if ((startDateFlag && !endDateFlag) || (!startDateFlag && endDateFlag)) {
    throw new Error("Both --startDate and --endDate are required for range mode");
  }

  const client = createClientFromEnv();

  if (startDateFlag && endDateFlag) {
    const startDate = ensureDate(startDateFlag);
    const endDate = ensureDate(endDateFlag);
    ensureDateRange(startDate, endDate);
    const output = await buildRangeStats(client, startDate, endDate);
    if (outputFormat === "text") {
      console.log(formatRangeStatsText(output));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
    return;
  }

  const date = ensureDate(dateFlag ?? getDefaultDate());
  const output = await buildDailyStats(client, date);
  if (outputFormat === "text") {
    console.log(formatDailyStatsText(output));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

function createClientFromEnv(): WhoopClient {
  return new WhoopClient({
    email: readRequiredEnv("WHOOP_EMAIL"),
    password: readRequiredEnv("WHOOP_PASSWORD"),
  });
}

function printHelp(): void {
  console.log(`whoop-cli (Bun)

Usage:
  whoop auth
  whoop stats --date YYYY-MM-DD [--text|--json]

Commands:
  auth    Validate WHOOP credentials by logging in and printing token expiry
  stats   Return compact JSON stats for a day
`);
}

function printAuthHelp(): void {
  console.log(`Usage:
  whoop auth

Options:
  --help               Show this help
`);
}

function printStatsHelp(): void {
  console.log(`Usage:
  whoop stats --date YYYY-MM-DD

Options:
  --text               Human-readable output
  --json               JSON output (default)

Notes:
  - If no flags are provided, --date defaults to local today
  - Auth is automatic via WHOOP_EMAIL and WHOOP_PASSWORD in .env
`);
}

async function main(): Promise<void> {
  const argv = (typeof Bun !== "undefined" ? Bun.argv.slice(2) : process.argv.slice(2)).filter(Boolean);
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  if (command === "auth") {
    await runAuth(rest);
    return;
  }

  if (command === "stats") {
    await runStats(rest);
    return;
  }

  throw new Error(`Unknown command "${command}". Run "whoop --help"`);
}

async function formatResponseExcerpt(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (!text) {
      return "";
    }
    const compact = text.replace(/\s+/g, " ");
    return ` | body: ${compact.slice(0, 300)}`;
  } catch {
    return "";
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
