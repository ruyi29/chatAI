import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles/base.css";
import "./styles/motion.css";
import "./styles/ambient.css";
import "./styles/personalization.css";

createApp(App).use(createPinia()).use(router).mount("#app");
