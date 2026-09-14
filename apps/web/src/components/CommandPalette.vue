<script setup lang="ts">
import {
  Clock3,
  Command,
  CornerDownLeft,
  LibraryBig,
  MessageSquarePlus,
  MessageSquareText,
  Search,
  Settings2,
  SunMoon,
  WandSparkles,
  X
} from "@lucide/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
  type ComponentPublicInstance,
  type CSSProperties
} from "vue";
import "./CommandPalette.css";

export interface CommandPaletteConversation {
  id: string;
  title: string;
}

export interface CommandPalettePrompt {
  id: string;
  title: string;
  content: string;
  category?: string;
}

type ThemePreference = "light" | "dark" | "system";
type ActionName = "new-chat" | "open-workspace" | "open-settings" | "toggle-theme";
type CommandKind = "action" | "conversation" | "prompt";

interface CommandItem {
  id: string;
  kind: CommandKind;
  label: string;
  description: string;
  searchText: string;
  icon: Component;
  action?: ActionName;
  value?: string;
}

interface CommandSection {
  id: CommandKind;
  label: string;
  items: CommandItem[];
}

type StaggerStyle = CSSProperties & { "--command-delay": string };

const props = defineProps<{
  open: boolean;
  conversations: CommandPaletteConversation[];
  prompts: CommandPalettePrompt[];
  currentTheme: ThemePreference;
}>();

const emit = defineEmits<{
  close: [];
  "new-chat": [];
  "select-conversation": [id: string];
  "use-prompt": [content: string];
  "open-workspace": [];
  "open-settings": [];
  "toggle-theme": [];
}>();

const query = ref("");
const activeIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const optionRefs = ref(new Map<string, HTMLElement>());

const themeLabel = computed(() => ({
  light: "当前为浅色模式",
  dark: "当前为深色模式",
  system: "当前跟随系统"
})[props.currentTheme]);

const actionItems = computed<CommandItem[]>(() => [
  {
    id: "action-new-chat",
    kind: "action",
    label: "新建对话",
    description: "从一个空白会话开始",
    searchText: "新建 对话 聊天 new chat",
    icon: MessageSquarePlus,
    action: "new-chat"
  },
  {
    id: "action-workspace",
    kind: "action",
    label: "打开工作台",
    description: "管理会话分组与提示词",
    searchText: "工作台 分组 提示词 模板 workspace",
    icon: LibraryBig,
    action: "open-workspace"
  },
  {
    id: "action-settings",
    kind: "action",
    label: "个性化设置",
    description: "调整主题、颜色与界面密度",
    searchText: "设置 个性化 颜色 密度 settings",
    icon: Settings2,
    action: "open-settings"
  },
  {
    id: "action-theme",
    kind: "action",
    label: "切换外观主题",
    description: themeLabel.value,
    searchText: `主题 浅色 深色 系统 theme ${props.currentTheme}`,
    icon: SunMoon,
    action: "toggle-theme"
  }
]);

const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase());

function matchesQuery(item: CommandItem) {
  if (!normalizedQuery.value) return true;
  return `${item.label} ${item.description} ${item.searchText}`
    .toLocaleLowerCase()
    .includes(normalizedQuery.value);
}

const sections = computed<CommandSection[]>(() => {
  const hasQuery = Boolean(normalizedQuery.value);
  const actions = actionItems.value.filter(matchesQuery);
  const conversations = props.conversations
    .map<CommandItem>((conversation) => ({
      id: `conversation-${conversation.id}`,
      kind: "conversation",
      label: conversation.title || "未命名对话",
      description: "继续这段对话",
      searchText: conversation.title,
      icon: MessageSquareText,
      value: conversation.id
    }))
    .filter(matchesQuery)
    .slice(0, hasQuery ? 20 : 6);
  const prompts = props.prompts
    .map<CommandItem>((prompt) => ({
      id: `prompt-${prompt.id}`,
      kind: "prompt",
      label: prompt.title,
      description: prompt.category ? `${prompt.category} · 插入到输入框` : "插入到输入框",
      searchText: `${prompt.title} ${prompt.category ?? ""} ${prompt.content}`,
      icon: WandSparkles,
      value: prompt.content
    }))
    .filter(matchesQuery)
    .slice(0, hasQuery ? 20 : 6);

  return [
    { id: "action", label: "快捷操作", items: actions },
    { id: "conversation", label: hasQuery ? "匹配的对话" : "最近对话", items: conversations },
    { id: "prompt", label: hasQuery ? "匹配的提示词" : "提示词", items: prompts }
  ].filter((section) => section.items.length > 0) as CommandSection[];
});

const commandItems = computed(() => sections.value.flatMap((section) => section.items));
const activeItem = computed(() => commandItems.value[activeIndex.value]);
const activeDescendant = computed(() => activeItem.value ? `command-option-${activeItem.value.id}` : undefined);

watch(() => props.open, async (open) => {
  if (!open) return;
  query.value = "";
  activeIndex.value = 0;
  await nextTick();
  searchInput.value?.focus();
  searchInput.value?.select();
});

watch([normalizedQuery, commandItems], async () => {
  activeIndex.value = commandItems.value.length ? 0 : -1;
  await nextTick();
  scrollActiveItemIntoView();
});

watch(activeIndex, async () => {
  await nextTick();
  scrollActiveItemIntoView();
});

function setOptionRef(element: Element | ComponentPublicInstance | null, id: string) {
  if (element instanceof HTMLElement) optionRefs.value.set(id, element);
  else optionRefs.value.delete(id);
}

function scrollActiveItemIntoView() {
  const item = activeItem.value;
  if (!item) return;
  optionRefs.value.get(item.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function moveSelection(direction: 1 | -1) {
  const count = commandItems.value.length;
  if (!count) return;
  activeIndex.value = (activeIndex.value + direction + count) % count;
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "Home") {
    event.preventDefault();
    activeIndex.value = commandItems.value.length ? 0 : -1;
  } else if (event.key === "End") {
    event.preventDefault();
    activeIndex.value = commandItems.value.length - 1;
  } else if (event.key === "Enter" && activeItem.value) {
    event.preventDefault();
    activateItem(activeItem.value);
  }
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    searchInput.value?.focus();
  }
}

function activateItem(item: CommandItem) {
  if (item.kind === "conversation" && item.value) emit("select-conversation", item.value);
  else if (item.kind === "prompt" && item.value) emit("use-prompt", item.value);
  else if (item.action === "new-chat") emit("new-chat");
  else if (item.action === "open-workspace") emit("open-workspace");
  else if (item.action === "open-settings") emit("open-settings");
  else if (item.action === "toggle-theme") emit("toggle-theme");
  emit("close");
}

function clearQuery() {
  query.value = "";
  searchInput.value?.focus();
}

function staggerStyle(index: number): StaggerStyle {
  return { "--command-delay": `${Math.min(index, 12) * 18}ms` };
}

onMounted(() => window.addEventListener("keydown", handleWindowKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleWindowKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="command-palette">
      <div v-if="open" class="command-palette-backdrop" @mousedown.self="emit('close')">
        <section
          class="command-palette"
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
        >
          <header class="command-palette-header">
            <div class="command-palette-search">
              <Search :size="20" aria-hidden="true" />
              <input
                ref="searchInput"
                v-model="query"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls="command-palette-results"
                :aria-activedescendant="activeDescendant"
                autocomplete="off"
                spellcheck="false"
                placeholder="搜索操作、对话或提示词…"
                @keydown="handleSearchKeydown"
              >
              <button
                v-if="query"
                class="command-palette-clear"
                type="button"
                aria-label="清除搜索"
                @click="clearQuery"
              >
                <X :size="16" />
              </button>
              <button
                v-else
                class="command-palette-escape"
                type="button"
                aria-label="关闭命令中心"
                @click="emit('close')"
              >
                Esc
              </button>
            </div>
            <h2 id="command-palette-title" class="command-palette-visually-hidden">命令中心</h2>
          </header>

          <div
            id="command-palette-results"
            class="command-palette-results"
            role="listbox"
            aria-label="命令搜索结果"
          >
            <template v-if="commandItems.length">
              <section v-for="section in sections" :key="section.id" class="command-palette-section">
                <div class="command-palette-section-heading" aria-hidden="true">
                  <span>{{ section.label }}</span>
                  <small>{{ section.items.length }}</small>
                </div>
                <button
                  v-for="item in section.items"
                  :id="`command-option-${item.id}`"
                  :key="item.id"
                  :ref="(element) => setOptionRef(element, item.id)"
                  class="command-palette-option"
                  :class="[{ active: activeItem?.id === item.id }, `is-${item.kind}`]"
                  :style="staggerStyle(commandItems.indexOf(item))"
                  type="button"
                  role="option"
                  tabindex="-1"
                  :aria-selected="activeItem?.id === item.id"
                  @mouseenter="activeIndex = commandItems.indexOf(item)"
                  @mousedown.prevent
                  @click="activateItem(item)"
                >
                  <span class="command-palette-icon" aria-hidden="true">
                    <component :is="item.icon" :size="18" :stroke-width="1.8" />
                  </span>
                  <span class="command-palette-option-copy">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                  <span class="command-palette-enter" aria-hidden="true">
                    <CornerDownLeft :size="14" />
                  </span>
                </button>
              </section>
            </template>

            <div v-else class="command-palette-empty" role="status">
              <span><Search :size="22" /></span>
              <strong>没有找到相关内容</strong>
              <p>试试会话标题、提示词分类或功能名称</p>
            </div>
          </div>

          <footer class="command-palette-footer">
            <span class="command-palette-brand"><Command :size="14" /> 命令中心</span>
            <span><kbd><span aria-hidden="true">↑</span><span class="command-palette-visually-hidden">上箭头</span></kbd><kbd><span aria-hidden="true">↓</span><span class="command-palette-visually-hidden">下箭头</span></kbd> 导航</span>
            <span><kbd><CornerDownLeft :size="11" aria-hidden="true" /></kbd> 选择</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
