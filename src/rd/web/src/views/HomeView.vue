<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section class="home">
    <h1>AiHub</h1>
    <p class="lead">
      AI 导航站：发现项目与热点。首页视觉与内容编排另案；一期先保证可进入各栏目。
    </p>
    <div class="links">
      <RouterLink to="/prompts">AI 提示词</RouterLink>
      <RouterLink to="/mcp">MCP</RouterLink>
      <RouterLink to="/skills">Skills</RouterLink>
      <RouterLink to="/frontier">热点</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.home {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}
h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}
.lead {
  margin: 0 0 1.25rem;
  color: #4b5563;
  line-height: 1.6;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.links a {
  color: #1d4ed8;
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  background: #eef2ff;
  border-radius: 8px;
}
.links a:hover {
  background: #dbeafe;
}
</style>
