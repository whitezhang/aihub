<script setup lang="ts">
import { computed } from "vue";
import type { TrendPoint } from "../api/items";

const props = defineProps<{
  points: TrendPoint[];
  width?: number;
  height?: number;
}>();

const w = computed(() => props.width ?? 128);
const h = computed(() => props.height ?? 40);
const padX = 4;
const padY = 6;

type Pt = { x: number; y: number; value: number; day: string };

const plotted = computed((): Pt[] => {
  const pts = props.points ?? [];
  if (pts.length === 0) return [];
  const values = pts.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = w.value - padX * 2;
  const innerH = h.value - padY * 2;

  return pts.map((p, i) => {
    const x =
      pts.length === 1 ? padX + innerW / 2 : padX + (i / (pts.length - 1)) * innerW;
    const y = padY + innerH - ((p.value - min) / span) * innerH;
    return { x, y, value: p.value, day: p.day };
  });
});

const linePath = computed(() => {
  const pts = plotted.value;
  if (pts.length < 2) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
});

const areaPath = computed(() => {
  const pts = plotted.value;
  if (pts.length < 2) return "";
  const baseY = h.value - padY;
  const head = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `${head} L${last.x.toFixed(1)},${baseY} L${first.x.toFixed(1)},${baseY} Z`;
});

const single = computed(() => plotted.value.length === 1);
const empty = computed(() => plotted.value.length === 0);
</script>

<template>
  <div class="wrap" :title="empty ? '暂无趋势数据' : `共 ${points.length} 天快照`">
    <svg
      class="spark"
      :viewBox="`0 0 ${w} ${h}`"
      :width="w"
      :height="h"
      role="img"
      aria-label="热度趋势"
    >
      <!-- baseline -->
      <line
        :x1="padX"
        :x2="w - padX"
        :y1="h - padY"
        :y2="h - padY"
        class="base"
      />
      <path v-if="areaPath" :d="areaPath" class="area" />
      <path v-if="linePath" :d="linePath" class="line" />
      <!-- single-day: horizontal stub + visible dot so chart is obvious -->
      <template v-if="single && plotted[0]">
        <line
          :x1="padX"
          :x2="w - padX"
          :y1="plotted[0].y"
          :y2="plotted[0].y"
          class="stub"
        />
        <circle
          :cx="plotted[0].x"
          :cy="plotted[0].y"
          r="3.5"
          class="dot"
        />
      </template>
      <circle
        v-for="(p, i) in plotted.length > 1 ? [plotted[plotted.length - 1]] : []"
        :key="i"
        :cx="p!.x"
        :cy="p!.y"
        r="3"
        class="dot"
      />
      <text v-if="empty" :x="w / 2" :y="h / 2 + 3" class="empty" text-anchor="middle">
        无数据
      </text>
    </svg>
    <div v-if="single" class="hint">仅 1 天</div>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 0.15rem;
  justify-items: end;
}
.spark {
  display: block;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
}
.base {
  stroke: #fdba74;
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0.7;
}
.area {
  fill: rgba(249, 115, 22, 0.18);
}
.line {
  fill: none;
  stroke: #ea580c;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.stub {
  stroke: #ea580c;
  stroke-width: 2;
  opacity: 0.55;
}
.dot {
  fill: #ea580c;
  stroke: #fff;
  stroke-width: 1;
}
.empty {
  fill: #9ca3af;
  font-size: 9px;
}
.hint {
  font-size: 0.65rem;
  color: #fb923c;
}
</style>
