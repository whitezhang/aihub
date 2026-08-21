<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { CatalogItem, Sort, Source } from "../api/items";
import { fetchItems } from "../api/items";
import HotItemRow from "../components/HotItemRow.vue";

type SourceTab = Source;

const sort = ref<Sort>("heat");
const sourceTab = ref<SourceTab>("github");
const selectedDay = ref<string>("");
const availableDays = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<CatalogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const monthOptions = computed(() => {
  const set = new Set(availableDays.value.map((d) => d.slice(0, 7)));
  return [...set].sort((a, b) => (a < b ? 1 : -1));
});

const selectedMonth = computed({
  get: () => (selectedDay.value ? selectedDay.value.slice(0, 7) : ""),
  set: (month: string) => {
    const days = availableDays.value.filter((d) => d.startsWith(month));
    if (days[0]) void selectDay(days[0]);
  },
});

const daysInMonth = computed(() => {
  const m = selectedMonth.value;
  if (!m) return [];
  return availableDays.value.filter((d) => d.startsWith(m));
});

const dayIndex = computed(() =>
  availableDays.value.findIndex((d) => d === selectedDay.value),
);

const canPrev = computed(
  () => dayIndex.value >= 0 && dayIndex.value < availableDays.value.length - 1,
);
const canNext = computed(() => dayIndex.value > 0);

const dayLabel = computed(() => formatDayLabel(selectedDay.value));

const sourceLabel = computed(() =>
  sourceTab.value === "github" ? "GitHub" : "Product Hunt",
);

function formatDayLabel(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "选择日期";
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const week = ["日", "一", "二", "三", "四", "五", "六"][dt.getDay()];
  return `${m}月${d}日 · 周${week}`;
}

function mergeDays(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort((x, y) => (x < y ? 1 : -1));
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchItems({
      category: "frontier",
      source: sourceTab.value,
      sort: sort.value,
      page: page.value,
      pageSize,
      day: selectedDay.value || undefined,
    });
    items.value = data.items;
    total.value = data.total;
    if (data.availableDays?.length) {
      availableDays.value = mergeDays(availableDays.value, data.availableDays);
    }
    if (data.day) {
      selectedDay.value = data.day;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** Prefetch available days from both sources once. */
async function bootstrapDays() {
  const [gh, ph] = await Promise.all([
    fetchItems({
      category: "frontier",
      source: "github",
      page: 1,
      pageSize: 1,
    }),
    fetchItems({
      category: "frontier",
      source: "producthunt",
      page: 1,
      pageSize: 1,
    }),
  ]);
  availableDays.value = mergeDays(
    gh.availableDays ?? [],
    ph.availableDays ?? [],
  );
  if (!selectedDay.value) {
    selectedDay.value =
      gh.day || ph.day || availableDays.value[0] || "";
  }
}

async function selectDay(day: string) {
  if (!day || day === selectedDay.value) return;
  selectedDay.value = day;
  page.value = 1;
  await load();
}

async function goPrevDay() {
  if (!canPrev.value) return;
  const next = availableDays.value[dayIndex.value + 1];
  if (next) await selectDay(next);
}

async function goNextDay() {
  if (!canNext.value) return;
  const next = availableDays.value[dayIndex.value - 1];
  if (next) await selectDay(next);
}

async function goLatest() {
  const latest = availableDays.value[0];
  if (latest) await selectDay(latest);
}

function onSource(tab: SourceTab) {
  if (sourceTab.value === tab) return;
  sourceTab.value = tab;
  page.value = 1;
  void load();
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    void goPrevDay();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    void goNextDay();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  try {
    await bootstrapDays();
  } catch {
    // load() will surface errors
  }
  await load();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});

watch(sort, () => {
  page.value = 1;
  void load();
});

function onPageChange(p: number) {
  page.value = p;
  void load();
}
</script>

<template>
  <section class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">AiHub · Daily Hot</p>
        <h1 class="hot-title">热点</h1>
      </div>
      <button
        type="button"
        class="latest-btn"
        :disabled="!availableDays.length || selectedDay === availableDays[0]"
        @click="goLatest"
      >
        回到最新一天
      </button>
    </header>

    <div class="toolbar">
      <div class="date-nav">
        <button
          type="button"
          class="nav-btn"
          :disabled="!canPrev"
          title="更早一天（←）"
          @click="goPrevDay"
        >
          ‹
        </button>
        <div class="date-main">
          <div class="date-big">{{ dayLabel }}</div>
          <div class="date-code">{{ selectedDay || "—" }}</div>
        </div>
        <button
          type="button"
          class="nav-btn"
          :disabled="!canNext"
          title="更新一天（→）"
          @click="goNextDay"
        >
          ›
        </button>
      </div>

      <div class="toolbar-right">
        <div class="seg" role="tablist" aria-label="来源">
          <button
            type="button"
            role="tab"
            class="seg-item"
            :class="{ active: sourceTab === 'github' }"
            @click="onSource('github')"
          >
            GitHub
          </button>
          <button
            type="button"
            role="tab"
            class="seg-item"
            :class="{ active: sourceTab === 'producthunt' }"
            @click="onSource('producthunt')"
          >
            Product Hunt
          </button>
        </div>
        <el-radio-group v-model="sort" size="small">
          <el-radio-button value="heat">按热度</el-radio-button>
          <el-radio-button value="latest">按时间</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-if="monthOptions.length" class="calendar">
      <div class="cal-row">
        <span class="cal-label">月份</span>
        <div class="chips">
          <button
            v-for="m in monthOptions"
            :key="m"
            type="button"
            class="chip"
            :class="{ active: selectedMonth === m }"
            @click="selectedMonth = m"
          >
            {{ m.replace("-", " / ") }}
          </button>
        </div>
      </div>
      <div class="cal-row">
        <span class="cal-label">日期</span>
        <div class="chips days">
          <button
            v-for="d in daysInMonth"
            :key="d"
            type="button"
            class="chip day"
            :class="{ active: selectedDay === d }"
            @click="selectDay(d)"
          >
            {{ Number(d.slice(8)) }}
          </button>
        </div>
      </div>
    </div>

    <div class="meta">
      <span>{{ sourceLabel }} · 共 {{ total }} 条</span>
      <span v-if="loading" class="loading">更新中…</span>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="alert"
    />

    <el-skeleton v-if="loading && items.length === 0" animated :rows="6" />

    <el-empty
      v-else-if="!loading && items.length === 0"
      :description="
        availableDays.length
          ? '这一天还没有该来源的快照'
          : '暂无热点数据，等待每日同步'
      "
    />

    <div v-else class="list" :class="{ dim: loading }">
      <HotItemRow
        v-for="item in items"
        :key="`${sourceTab}-${item.id}-${item.syncedAt}`"
        :item="item"
        :source-label="sourceLabel"
      />
    </div>

    <div v-if="total > pageSize" class="pager">
      <el-pagination
        :current-page="page"
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        background
        @current-change="onPageChange"
      />
    </div>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1rem;
  max-width: 920px;
  margin: 0 auto;
}
.hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}
.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fb923c;
  font-weight: 700;
}
.hot-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #9a3412;
}
.latest-btn {
  border: 1px solid #fdba74;
  background: #fff7ed;
  color: #c2410c;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.latest-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.toolbar {
  position: sticky;
  top: 3.4rem;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  backdrop-filter: blur(8px);
}
.date-nav {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.nav-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  color: #374151;
}
.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.nav-btn:not(:disabled):hover {
  border-color: #fdba74;
  color: #c2410c;
}
.date-main {
  min-width: 9.5rem;
  text-align: center;
}
.date-big {
  font-size: 1.05rem;
  font-weight: 750;
  color: #1f2937;
}
.date-code {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}
.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}
.seg {
  display: inline-flex;
  padding: 0.2rem;
  background: #f3f4f6;
  border-radius: 999px;
  gap: 0.15rem;
}
.seg-item {
  border: 0;
  background: transparent;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #4b5563;
}
.seg-item.active {
  background: #fff;
  color: #c2410c;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.calendar {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  display: grid;
  gap: 0.7rem;
}
.cal-row {
  display: grid;
  grid-template-columns: 3rem 1fr;
  gap: 0.65rem;
  align-items: start;
}
.cal-label {
  font-size: 0.78rem;
  color: #6b7280;
  font-weight: 650;
  padding-top: 0.35rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.chips.days {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}
.chip {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #374151;
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
  cursor: pointer;
  font-size: 0.82rem;
  white-space: nowrap;
}
.chip.day {
  min-width: 2.25rem;
  text-align: center;
  padding-left: 0.45rem;
  padding-right: 0.45rem;
}
.chip.active {
  background: #fff7ed;
  border-color: #fb923c;
  color: #c2410c;
  font-weight: 700;
}
.meta {
  display: flex;
  justify-content: space-between;
  color: #9ca3af;
  font-size: 0.8rem;
}
.loading {
  color: #ea580c;
}
.alert {
  margin: 0;
}
.list {
  display: grid;
  gap: 0.55rem;
  transition: opacity 0.15s ease;
}
.list.dim {
  opacity: 0.55;
}
.pager {
  display: flex;
  justify-content: center;
  padding-bottom: 1rem;
}
@media (max-width: 720px) {
  .toolbar {
    top: 0.5rem;
  }
  .cal-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}
</style>
