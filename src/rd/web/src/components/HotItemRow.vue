<script setup lang="ts">
import { computed } from "vue";
import type { CatalogItem } from "../api/items";
import HeatSparkline from "./HeatSparkline.vue";

const props = defineProps<{
  item: CatalogItem;
  sourceLabel: string;
}>();

const heatText = computed(() => {
  const item = props.item;
  if (item.heatKind === "star" && item.heatValue > 0) {
    return { value: formatNum(item.heatValue), unit: "Star" };
  }
  if (item.heatKind === "upvote" && item.heatValue > 0) {
    return { value: formatNum(item.heatValue), unit: "Upvote" };
  }
  return null;
});

const rankClass = computed(() => {
  const r = props.item.rank ?? 99;
  if (r === 1) return "r1";
  if (r === 2) return "r2";
  if (r === 3) return "r3";
  return "";
});

const visibleTags = computed(() => (props.item.tags ?? []).slice(0, 3));

const trendTip = computed(() => {
  const t = props.item.trend ?? [];
  if (t.length === 0) return "暂无趋势";
  if (t.length === 1) return `${t[0]!.day} · ${t[0]!.value}`;
  const a = t[0]!;
  const b = t[t.length - 1]!;
  return `${a.day} → ${b.day} · ${a.value} → ${b.value}`;
});

function rankText(rank?: number): string {
  return String(rank ?? 0).padStart(2, "0");
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
</script>

<template>
  <a
    class="row"
    :href="item.url"
    target="_blank"
    rel="noopener noreferrer"
  >
    <div class="rank" :class="rankClass">{{ rankText(item.rank) }}</div>
    <div class="main">
      <div class="title-row">
        <h3 class="title">{{ item.title }}</h3>
        <span class="open" aria-hidden="true">↗</span>
      </div>
      <p v-if="item.summary" class="summary">{{ item.summary }}</p>
      <div v-if="visibleTags.length" class="tags">
        <span v-for="tag in visibleTags" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </div>
    <div class="metrics">
      <template v-if="heatText">
        <div class="heat">{{ heatText.value }}</div>
        <div class="unit">{{ heatText.unit }}</div>
      </template>
      <div v-else class="unit muted">暂无热度</div>
    </div>
    <div class="trend" :title="trendTip">
      <div class="src">{{ sourceLabel }}</div>
      <HeatSparkline :points="item.trend ?? []" />
    </div>
  </a>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 88px 140px;
  gap: 0.75rem 0.9rem;
  align-items: center;
  text-decoration: none;
  color: inherit;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 14px;
  padding: 0.9rem 1rem;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.row:hover {
  border-color: #fdba74;
  box-shadow: 0 8px 24px rgba(234, 88, 12, 0.06);
  transform: translateY(-1px);
}
.rank {
  font-size: 1.4rem;
  font-weight: 800;
  color: #d1d5db;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.rank.r1 { color: #ea580c; }
.rank.r2 { color: #f97316; }
.rank.r3 { color: #fb923c; }
.main { min-width: 0; }
.title-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.open {
  color: #d1d5db;
  font-size: 0.85rem;
  flex: 0 0 auto;
}
.row:hover .open { color: #ea580c; }
.summary {
  margin: 0.28rem 0 0;
  color: #6b7280;
  font-size: 0.86rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.4rem;
}
.tag {
  font-size: 0.7rem;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  padding: 0.08rem 0.4rem;
  border-radius: 4px;
}
.metrics {
  text-align: right;
}
.heat {
  color: #ea580c;
  font-weight: 800;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.unit {
  margin-top: 0.1rem;
  color: #9ca3af;
  font-size: 0.72rem;
}
.unit.muted { color: #d1d5db; }
.trend {
  display: grid;
  gap: 0.2rem;
  justify-items: end;
}
.src {
  font-size: 0.7rem;
  color: #9ca3af;
}
@media (max-width: 760px) {
  .row {
    grid-template-columns: 40px minmax(0, 1fr);
    grid-template-areas:
      "rank main"
      "metrics trend";
  }
  .rank { grid-area: rank; }
  .main { grid-area: main; }
  .metrics {
    grid-area: metrics;
    text-align: left;
  }
  .trend {
    grid-area: trend;
    justify-items: end;
  }
}
</style>
