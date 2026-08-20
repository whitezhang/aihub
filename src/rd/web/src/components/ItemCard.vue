<script setup lang="ts">
import type { CatalogItem } from "../api/items";

defineProps<{
  item: CatalogItem;
}>();

function heatLabel(kind: CatalogItem["heatKind"]): string | null {
  if (kind === "star") return "Star";
  if (kind === "upvote") return "Upvote";
  return null;
}
</script>

<template>
  <a
    class="card"
    :href="item.url"
    target="_blank"
    rel="noopener noreferrer"
  >
    <div class="top">
      <h3>{{ item.title }}</h3>
      <span
        v-if="heatLabel(item.heatKind) && item.heatValue > 0"
        class="heat"
      >
        {{ heatLabel(item.heatKind) }} {{ item.heatValue }}
      </span>
    </div>
    <p v-if="item.summary" class="summary">{{ item.summary }}</p>
    <div v-if="item.tags.length" class="tags">
      <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>
  </a>
</template>

<style scoped>
.card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.9rem 1rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  border-color: #93c5fd;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
.heat {
  color: #1d4ed8;
  font-size: 0.85rem;
  white-space: nowrap;
}
.summary {
  margin: 0.45rem 0 0;
  color: #4b5563;
  line-height: 1.5;
  font-size: 0.92rem;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
}
.tag {
  font-size: 0.75rem;
  background: #f3f4f6;
  color: #374151;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}
</style>
