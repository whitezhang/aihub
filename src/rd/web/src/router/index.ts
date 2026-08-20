import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import CategoryListView from "../views/CategoryListView.vue";
import FrontierView from "../views/FrontierView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    {
      path: "/prompts",
      name: "prompts",
      component: CategoryListView,
      props: { category: "prompt", title: "AI 提示词" },
    },
    {
      path: "/mcp",
      name: "mcp",
      component: CategoryListView,
      props: { category: "mcp", title: "MCP" },
    },
    {
      path: "/skills",
      name: "skills",
      component: CategoryListView,
      props: { category: "skills", title: "Skills" },
    },
    { path: "/frontier", name: "frontier", component: FrontierView },
  ],
});
