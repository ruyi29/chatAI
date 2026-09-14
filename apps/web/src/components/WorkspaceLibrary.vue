<script setup lang="ts">
import {
  Check,
  Cloud,
  CloudOff,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Library,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import "./WorkspaceLibrary.css";

export type WorkspaceLibraryTab = "groups" | "prompts";

export interface ConversationGroupLibraryItem {
  id: string;
  name: string;
  conversationCount: number;
  updatedAt?: string;
  color?: string;
  isSystem?: boolean;
}

export interface CloudPromptLibraryItem {
  id: string;
  title: string;
  content: string;
  description?: string;
  category?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface PromptLibraryDraft {
  title: string;
  content: string;
  description?: string;
  category?: string;
}

const props = withDefaults(defineProps<{
  groups: ConversationGroupLibraryItem[];
  prompts: CloudPromptLibraryItem[];
  activeGroupId?: string | null;
  totalConversationCount?: number;
  initialTab?: WorkspaceLibraryTab;
  loading?: boolean;
  syncing?: boolean;
  busyId?: string | null;
  syncError?: string;
}>(), {
  activeGroupId: null,
  initialTab: "groups",
  loading: false,
  syncing: false,
  busyId: null,
  syncError: ""
});

const emit = defineEmits<{
  close: [];
  "select-group": [id: string | null];
  "create-group": [name: string];
  "rename-group": [payload: { id: string; name: string }];
  "delete-group": [id: string];
  "create-prompt": [draft: PromptLibraryDraft];
  "update-prompt": [payload: PromptLibraryDraft & { id: string }];
  "delete-prompt": [id: string];
  "use-prompt": [prompt: CloudPromptLibraryItem];
  sync: [];
}>();

const activeTab = ref<WorkspaceLibraryTab>(props.initialTab);
const query = ref("");
const isCreatingGroup = ref(false);
const newGroupName = ref("");
const editingGroupId = ref<string | null>(null);
const groupNameDraft = ref("");
const promptEditorOpen = ref(false);
const editingPromptId = ref<string | null>(null);
const promptTitle = ref("");
const promptCategory = ref("");
const promptDescription = ref("");
const promptContent = ref("");
const pendingDelete = ref<{ type: "group" | "prompt"; id: string } | null>(null);

const filteredGroups = computed(() => {
  const value = query.value.trim().toLocaleLowerCase();
  return value
    ? props.groups.filter((group) => group.name.toLocaleLowerCase().includes(value))
    : props.groups;
});

const filteredPrompts = computed(() => {
  const value = query.value.trim().toLocaleLowerCase();
  if (!value) return props.prompts;
  return props.prompts.filter((prompt) =>
    [prompt.title, prompt.description, prompt.category, prompt.content]
      .some((field) => field?.toLocaleLowerCase().includes(value))
  );
});

const promptEditorValid = computed(() => Boolean(promptTitle.value.trim() && promptContent.value.trim()));
const displayedConversationTotal = computed(() =>
  props.totalConversationCount ?? props.groups.reduce((total, group) => total + group.conversationCount, 0)
);

watch(() => props.initialTab, (tab) => {
  activeTab.value = tab;
});

watch(activeTab, () => {
  query.value = "";
  cancelGroupEditor();
  closePromptEditor();
  pendingDelete.value = null;
});

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
}

function startGroupCreation() {
  editingGroupId.value = null;
  isCreatingGroup.value = true;
  newGroupName.value = "";
}

function submitGroupCreation() {
  const name = newGroupName.value.trim();
  if (!name) return;
  emit("create-group", name);
  isCreatingGroup.value = false;
  newGroupName.value = "";
}

function startGroupRename(group: ConversationGroupLibraryItem) {
  isCreatingGroup.value = false;
  editingGroupId.value = group.id;
  groupNameDraft.value = group.name;
}

function submitGroupRename() {
  const id = editingGroupId.value;
  const name = groupNameDraft.value.trim();
  if (!id || !name) return;
  emit("rename-group", { id, name });
  editingGroupId.value = null;
}

function cancelGroupEditor() {
  isCreatingGroup.value = false;
  editingGroupId.value = null;
  newGroupName.value = "";
  groupNameDraft.value = "";
}

function openPromptCreator() {
  editingPromptId.value = null;
  promptTitle.value = "";
  promptCategory.value = "";
  promptDescription.value = "";
  promptContent.value = "";
  promptEditorOpen.value = true;
}

function openPromptEditor(prompt: CloudPromptLibraryItem) {
  editingPromptId.value = prompt.id;
  promptTitle.value = prompt.title;
  promptCategory.value = prompt.category || "";
  promptDescription.value = prompt.description || "";
  promptContent.value = prompt.content;
  promptEditorOpen.value = true;
}

function closePromptEditor() {
  promptEditorOpen.value = false;
  editingPromptId.value = null;
}

function submitPrompt() {
  if (!promptEditorValid.value) return;
  const draft: PromptLibraryDraft = {
    title: promptTitle.value.trim(),
    content: promptContent.value.trim(),
    description: promptDescription.value.trim() || undefined,
    category: promptCategory.value.trim() || undefined
  };
  if (editingPromptId.value) {
    emit("update-prompt", { id: editingPromptId.value, ...draft });
  } else {
    emit("create-prompt", draft);
  }
  closePromptEditor();
}

function requestDelete(type: "group" | "prompt", id: string) {
  pendingDelete.value = pendingDelete.value?.type === type && pendingDelete.value.id === id
    ? null
    : { type, id };
}

function confirmDelete() {
  if (!pendingDelete.value) return;
  if (pendingDelete.value.type === "group") emit("delete-group", pendingDelete.value.id);
  else emit("delete-prompt", pendingDelete.value.id);
  pendingDelete.value = null;
}
</script>

<template>
  <section class="workspace-library" aria-label="工作区资料库">
    <header class="workspace-library__header">
      <div class="workspace-library__title">
        <span class="workspace-library__mark"><Library :size="18" /></span>
        <div>
          <p>WORKSPACE</p>
          <h2>工作区资料库</h2>
        </div>
      </div>
      <button type="button" class="workspace-library__icon-button" aria-label="关闭资料库" @click="emit('close')">
        <X :size="18" />
      </button>
    </header>

    <nav class="workspace-library__tabs" aria-label="资料库分类">
      <button type="button" :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">
        <FolderTree :size="15" />会话分组
        <span>{{ groups.length }}</span>
      </button>
      <button type="button" :class="{ active: activeTab === 'prompts' }" @click="activeTab = 'prompts'">
        <Sparkles :size="15" />云端提示词
        <span>{{ prompts.length }}</span>
      </button>
    </nav>

    <div class="workspace-library__toolbar">
      <label class="workspace-library__search">
        <Search :size="15" />
        <span class="visually-hidden">搜索{{ activeTab === 'groups' ? '分组' : '提示词' }}</span>
        <input v-model="query" type="search" :placeholder="activeTab === 'groups' ? '搜索会话分组' : '搜索标题、分类或内容'" />
        <button v-if="query" type="button" aria-label="清除搜索" @click="query = ''"><X :size="13" /></button>
      </label>
      <button v-if="activeTab === 'groups'" type="button" class="workspace-library__primary" @click="startGroupCreation">
        <FolderPlus :size="15" />新分组
      </button>
      <button v-else type="button" class="workspace-library__primary" @click="openPromptCreator">
        <Plus :size="15" />新提示词
      </button>
    </div>

    <div v-if="activeTab === 'prompts'" class="workspace-library__sync" :class="{ error: syncError }">
      <div>
        <CloudOff v-if="syncError" :size="14" />
        <Cloud v-else :size="14" />
        <span>{{ syncError || (syncing ? '正在同步云端数据…' : '提示词已启用云端同步') }}</span>
      </div>
      <button type="button" :disabled="syncing" @click="emit('sync')">
        <LoaderCircle v-if="syncing" :size="13" class="workspace-library__spin" />
        <RefreshCw v-else :size="13" />
        {{ syncing ? '同步中' : '立即同步' }}
      </button>
    </div>

    <div class="workspace-library__content">
      <div v-if="loading" class="workspace-library__state" role="status">
        <LoaderCircle :size="20" class="workspace-library__spin" />
        <span>正在载入资料库…</span>
      </div>

      <template v-else-if="activeTab === 'groups'">
        <form v-if="isCreatingGroup" class="workspace-library__inline-form" @submit.prevent="submitGroupCreation">
          <span class="workspace-library__folder-dot"><FolderOpen :size="15" /></span>
          <input v-model="newGroupName" autofocus maxlength="40" placeholder="输入分组名称" @keydown.esc="cancelGroupEditor" />
          <button type="submit" :disabled="!newGroupName.trim()" aria-label="创建分组"><Check :size="15" /></button>
          <button type="button" aria-label="取消" @click="cancelGroupEditor"><X :size="15" /></button>
        </form>

        <div class="workspace-library__group-list">
          <button
            type="button"
            class="workspace-library__all-group"
            :class="{ active: activeGroupId === null }"
            @click="emit('select-group', null)"
          >
            <span class="workspace-library__folder-dot"><Library :size="15" /></span>
            <span><strong>全部会话</strong><small>查看所有未归档会话</small></span>
            <b>{{ displayedConversationTotal }}</b>
          </button>

          <article v-for="group in filteredGroups" :key="group.id" class="workspace-library__group" :class="{ active: activeGroupId === group.id }">
            <template v-if="editingGroupId === group.id">
              <form class="workspace-library__inline-form embedded" @submit.prevent="submitGroupRename">
                <span class="workspace-library__folder-dot" :style="group.color ? { color: group.color } : undefined"><FolderOpen :size="15" /></span>
                <input v-model="groupNameDraft" autofocus maxlength="40" @keydown.esc="cancelGroupEditor" />
                <button type="submit" :disabled="!groupNameDraft.trim()" aria-label="保存名称"><Check :size="15" /></button>
                <button type="button" aria-label="取消" @click="cancelGroupEditor"><X :size="15" /></button>
              </form>
            </template>
            <template v-else>
              <button type="button" class="workspace-library__group-main" @click="emit('select-group', group.id)">
                <span class="workspace-library__folder-dot" :style="group.color ? { color: group.color } : undefined"><FolderOpen :size="15" /></span>
                <span>
                  <strong>{{ group.name }}</strong>
                  <small>{{ group.conversationCount }} 个会话<span v-if="formatDate(group.updatedAt)"> · {{ formatDate(group.updatedAt) }}</span></small>
                </span>
              </button>
              <div v-if="!group.isSystem" class="workspace-library__row-actions">
                <button type="button" aria-label="重命名分组" @click="startGroupRename(group)"><Pencil :size="14" /></button>
                <button type="button" class="danger" aria-label="删除分组" @click="requestDelete('group', group.id)"><Trash2 :size="14" /></button>
              </div>
              <LoaderCircle v-if="busyId === group.id" :size="15" class="workspace-library__spin" />
            </template>
          </article>
        </div>

        <div v-if="!filteredGroups.length && !isCreatingGroup" class="workspace-library__empty">
          <span><FolderTree :size="22" /></span>
          <strong>{{ query ? '没有匹配的分组' : '用分组整理你的会话' }}</strong>
          <p>{{ query ? '试试其他关键词。' : '按项目、客户或主题归纳会话，查找内容更轻松。' }}</p>
          <button v-if="!query" type="button" @click="startGroupCreation"><Plus :size="14" />创建第一个分组</button>
        </div>
      </template>

      <template v-else>
        <form v-if="promptEditorOpen" class="workspace-library__prompt-editor" @submit.prevent="submitPrompt">
          <div class="workspace-library__editor-heading">
            <div><Sparkles :size="15" /><strong>{{ editingPromptId ? '编辑提示词' : '创建云端提示词' }}</strong></div>
            <button type="button" aria-label="关闭编辑器" @click="closePromptEditor"><X :size="16" /></button>
          </div>
          <div class="workspace-library__field-row">
            <label>名称<input v-model="promptTitle" maxlength="60" placeholder="例如：周报整理助手" /></label>
            <label>分类<input v-model="promptCategory" maxlength="24" placeholder="例如：效率" /></label>
          </div>
          <label>用途说明<input v-model="promptDescription" maxlength="120" placeholder="简要说明适合什么场景（可选）" /></label>
          <label>提示词内容<textarea v-model="promptContent" rows="6" maxlength="12000" placeholder="写下角色、任务、输入要求和输出格式…" /></label>
          <div class="workspace-library__editor-footer">
            <span>{{ promptContent.length.toLocaleString() }} / 12,000</span>
            <div>
              <button type="button" class="workspace-library__secondary" @click="closePromptEditor">取消</button>
              <button type="submit" class="workspace-library__primary" :disabled="!promptEditorValid">
                <Check :size="14" />{{ editingPromptId ? '保存修改' : '创建并同步' }}
              </button>
            </div>
          </div>
        </form>

        <div class="workspace-library__prompt-grid">
          <article v-for="prompt in filteredPrompts" :key="prompt.id" class="workspace-library__prompt-card">
            <div class="workspace-library__prompt-top">
              <span>{{ prompt.category || '我的提示词' }}</span>
              <i :class="{ unsynced: prompt.isSynced === false }">
                <CloudOff v-if="prompt.isSynced === false" :size="12" />
                <Cloud v-else :size="12" />
                {{ prompt.isSynced === false ? '待同步' : '已同步' }}
              </i>
            </div>
            <strong>{{ prompt.title }}</strong>
            <p>{{ prompt.description || prompt.content }}</p>
            <small v-if="formatDate(prompt.updatedAt)">更新于 {{ formatDate(prompt.updatedAt) }}</small>
            <footer>
              <button type="button" class="workspace-library__use" @click="emit('use-prompt', prompt)"><Sparkles :size="13" />使用</button>
              <button type="button" aria-label="编辑提示词" @click="openPromptEditor(prompt)"><Pencil :size="13" /></button>
              <button type="button" class="danger" aria-label="删除提示词" @click="requestDelete('prompt', prompt.id)"><Trash2 :size="13" /></button>
              <LoaderCircle v-if="busyId === prompt.id" :size="14" class="workspace-library__spin" />
            </footer>
          </article>
        </div>

        <div v-if="!filteredPrompts.length && !promptEditorOpen" class="workspace-library__empty">
          <span><Sparkles :size="22" /></span>
          <strong>{{ query ? '没有匹配的提示词' : '建立你的提示词资料库' }}</strong>
          <p>{{ query ? '试试搜索标题、分类或提示词正文。' : '创建一次，多设备同步并随时复用。' }}</p>
          <button v-if="!query" type="button" @click="openPromptCreator"><Plus :size="14" />创建第一个提示词</button>
        </div>
      </template>
    </div>

    <div v-if="pendingDelete" class="workspace-library__confirm" role="alert">
      <div>
        <Trash2 :size="16" />
        <span><strong>确认删除？</strong><small>{{ pendingDelete.type === 'group' ? '分组内的会话将回到未分组。' : '删除后将同步到所有设备。' }}</small></span>
      </div>
      <button type="button" @click="pendingDelete = null">取消</button>
      <button type="button" class="danger" @click="confirmDelete">确认删除</button>
    </div>
  </section>
</template>
