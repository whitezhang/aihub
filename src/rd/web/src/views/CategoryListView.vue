<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { CatalogItem, Category, Sort } from "../api/items";
import { fetchItems } from "../api/items";
import ItemCard from "../components/ItemCard.vue";

const props = defineProps<{
  category: Category;
  title: string;
}>();

const sort = ref<Sort>("heat");
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<CatalogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const emptyHint = computed(
  () =>
    "来源站点尚未接入，暂无条目。栏目已预留，接入后将自动展示。",
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchItems({
      category: props.category,
      sort: sort.value,
      page: page.value,
      pageSize,
    });
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([sort, page], load);
watch(
  () => props.category,
  () => {
    page.value = 1;
    void load();
  },
);
</script>

<template>
  <section class="page">
    <header class="head">
      <h1>{{ title }}</h1>
      <el-radio-group v-model="sort" size="small">
        <el-radio-button value="heat">热度</el-radio-button>
        <el-radio-button value="latest">最新</el-radio-button>
      </el-radio-group>
    </header>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-skeleton v-else-if="loading" animated :rows="4" />
    <el-empty v-else-if="items.length === 0" :description="emptyHint" />
    <div v-else class="list">
      <ItemCard v-for="item in items" :key="item.id" :item="item" />
    </div>

    <div v-if="total > pageSize" class="pager">
      <el-pagination
        v-model:current-page="page"
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        background
      />
    </div>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1rem;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
}
.list {
  display: grid;
  gap: 0.75rem;
}
.pager {
  display: flex;
  justify-content: center;
}
</style>
