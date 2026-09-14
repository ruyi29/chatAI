<script setup lang="ts">
import { Check, LoaderCircle, LogIn, LogOut, UserPlus, X } from "@lucide/vue";
import { ref, watch } from "vue";
import { login, logout, register, type AuthUser } from "../services/api";
import "./account-dialog.css";

const props = defineProps<{ open: boolean; user: AuthUser | null }>();
const emit = defineEmits<{ close: []; changed: [user: AuthUser | null] }>();
const mode = ref<"login" | "register">("login");
const email = ref("");
const password = ref("");
const name = ref("");
const error = ref("");
const busy = ref(false);
watch(() => props.open, (open) => { if (open) error.value = ""; });

async function submit() {
  if (!email.value.trim() || password.value.length < 8 || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const user = mode.value === "login"
      ? await login({ email: email.value.trim(), password: password.value })
      : await register({ email: email.value.trim(), password: password.value, name: name.value.trim() || undefined });
    emit("changed", user);
    emit("close");
    password.value = "";
  } catch (reason) { error.value = reason instanceof Error ? reason.message : "登录失败，请稍后重试。"; }
  finally { busy.value = false; }
}
async function signOut() {
  busy.value = true;
  try { await logout(); emit("changed", null); emit("close"); }
  finally { busy.value = false; }
}
</script>

<template>
  <Transition name="account-fade"><div v-if="open" class="account-overlay" @click.self="emit('close')"><section class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title"><header><span><Check :size="17" /></span><div><p>CHATAI CLOUD</p><h2 id="account-title">{{ user ? '账户与云同步' : mode === 'login' ? '登录 ChatAI' : '创建账户' }}</h2></div><button type="button" aria-label="关闭" @click="emit('close')"><X :size="18" /></button></header><template v-if="user"><div class="account-profile"><span>{{ (user.name || user.email || 'U').slice(0, 1).toUpperCase() }}</span><div><strong>{{ user.name || 'ChatAI 用户' }}</strong><small>{{ user.email }}</small></div></div><div class="account-sync-state"><Check :size="15" /><div><strong>云同步已开启</strong><small>会话、分组、附件和提示词均按账户安全隔离。</small></div></div><button class="account-logout" type="button" :disabled="busy" @click="signOut"><LoaderCircle v-if="busy" class="spin" :size="15" /><LogOut v-else :size="15" />退出登录</button></template><template v-else><div class="account-tabs"><button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button><button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button></div><form @submit.prevent="submit"><label v-if="mode === 'register'">昵称<input v-model="name" autocomplete="name" maxlength="80" placeholder="你的称呼" /></label><label>邮箱<input v-model="email" autocomplete="email" type="email" required placeholder="name@example.com" /></label><label>密码<input v-model="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" type="password" minlength="8" required placeholder="至少 8 位" /></label><p v-if="error" class="account-error">{{ error }}</p><button class="account-submit" type="submit" :disabled="busy || !email.trim() || password.length < 8"><LoaderCircle v-if="busy" class="spin" :size="16" /><LogIn v-else-if="mode === 'login'" :size="16" /><UserPlus v-else :size="16" />{{ busy ? '请稍候' : mode === 'login' ? '登录并同步' : '注册并开始同步' }}</button></form><p class="account-note">未登录时仍可使用本地访客空间；登录后数据将保存在你的云端工作区。</p></template></section></div></Transition>
</template>
