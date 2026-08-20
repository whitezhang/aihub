<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const nav = [
  { path: "/", label: "首页" },
  { path: "/prompts", label: "AI 提示词" },
  { path: "/mcp", label: "MCP" },
  { path: "/skills", label: "Skills" },
  { path: "/frontier", label: "热点" },
] as const;

function go(path: string) {
  void router.push(path);
}
</script>

<template>
  <div class="shell">
    <header class="top">
      <button class="brand" type="button" @click="go('/')">AiHub</button>
      <nav class="nav">
        <button
          v-for="item in nav"
          :key="item.path"
          type="button"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          @click="go(item.path)"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  background: #f6f7f9;
  color: #1f2329;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.top {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.85rem 1.25rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  border: 0;
  background: transparent;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.02em;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.nav-item {
  border: 0;
  background: transparent;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  color: #4b5563;
}
.nav-item.active,
.nav-item:hover {
  background: #eef2ff;
  color: #1d4ed8;
}
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem;
}
.main:has(.page) {
  max-width: 960px;
}
@media (max-width: 640px) {
  .top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
