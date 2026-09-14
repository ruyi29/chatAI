<script setup lang="ts">
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Marked, Renderer } from "marked";
import { computed, onUnmounted, ref } from "vue";

import "./markdown-content.css";

const props = defineProps<{ content: string }>();

interface CodeSnippet {
  code: string;
}

const copiedIndex = ref<number | null>(null);
const copyAnnouncement = ref("");
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

const languageAliases: Record<string, string> = {
  c: "cpp",
  cjs: "javascript",
  h: "cpp",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  vue: "xml",
  yml: "yaml",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLanguage(rawLanguage?: string) {
  const requested = rawLanguage?.trim().split(/\s+/)[0].toLowerCase() ?? "";
  return languageAliases[requested] ?? requested;
}

function highlightCode(code: string, language: string) {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }

  return hljs.highlightAuto(code).value;
}

const rendered = computed(() => {
  const snippets: CodeSnippet[] = [];
  const renderer = new Renderer();

  renderer.checkbox = ({ checked }) =>
    `<span class="md-task-checkbox" role="checkbox" aria-checked="${checked}" aria-disabled="true"></span>`;

  renderer.code = ({ text, lang }) => {
    const index = snippets.push({ code: text }) - 1;
    const language = getLanguage(lang);
    const languageLabel = language || "代码";
    const copied = copiedIndex.value === index;
    const highlighted = highlightCode(text, language);

    return `<div class="md-code-block">
      <div class="md-code-header">
        <span class="md-code-language">${escapeHtml(languageLabel)}</span>
        <button class="md-code-copy${copied ? " is-copied" : ""}" type="button" data-code-index="${index}" aria-label="${copied ? "代码已复制" : "复制代码"}">
          ${copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre><code class="hljs${language ? ` language-${escapeHtml(language)}` : ""}">${highlighted}</code></pre>
    </div>`;
  };

  const markdown = new Marked({
    async: false,
    breaks: true,
    gfm: true,
    renderer,
  });
  const unsafeHtml = markdown.parse(props.content, { async: false });
  const html = DOMPurify.sanitize(unsafeHtml, {
    ADD_ATTR: ["aria-label", "data-code-index", "type"],
    FORBID_ATTR: ["style"],
    FORBID_TAGS: ["embed", "form", "iframe", "input", "object", "select", "style", "textarea"],
    USE_PROFILES: { html: true },
  });

  return { html, snippets };
});

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("Copy command was rejected");
}

async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopy(text);
}

async function handleMarkdownClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("button[data-code-index]");
  if (!button) return;

  const index = Number(button.dataset.codeIndex);
  const snippet = rendered.value.snippets[index];
  if (!snippet || !Number.isInteger(index)) return;

  try {
    await writeToClipboard(snippet.code);
    copiedIndex.value = index;
    copyAnnouncement.value = "代码已复制到剪贴板";
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      copiedIndex.value = null;
      copyAnnouncement.value = "";
    }, 1800);
  } catch {
    copyAnnouncement.value = "复制失败，请手动选择代码";
  }
}

onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer);
});
</script>

<template>
  <div class="md-renderer" @click="handleMarkdownClick" v-html="rendered.html" />
  <span class="md-copy-announcement" role="status" aria-live="polite">{{ copyAnnouncement }}</span>
</template>
