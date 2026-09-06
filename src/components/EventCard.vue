<script setup>
import { computed } from 'vue'
import { latestEventAt } from '../utils/events.js'
import { formatWib } from '../utils/formatTime.js'

const props = defineProps({ events: { type: Array, required: true }, currentTimeMs: { type: Number, required: true } })
const current = computed(() => latestEventAt(props.events, props.currentTimeMs))
</script>

<template>
  <transition name="fade">
    <article v-if="current" :key="current.id" class="card" :class="current.kind">
      <div class="when">{{ formatWib(Date.parse(current.timeUtc)) }}</div>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
      <a :href="current.sourceUrl" target="_blank" rel="noopener">Source ↗</a>
    </article>
  </transition>
</template>

<style scoped>
.card { position: absolute; left: 12px; top: 84px; z-index: 1000; width: min(340px, calc(100vw - 24px)); padding: 12px 14px; background: rgba(12, 15, 21, .88); border-left: 3px solid #9aa3b2; border-radius: 6px; color: #e6e9ef; }
.card.eruption { border-color: #ff5a3c; } .card.ashfall { border-color: #d69630; } .card.aviation { border-color: #ffd166; } .card.advisory { border-color: #7fd1ff; }
.when { font-size: 11px; color: #9aa3b2; }
h3 { margin: 4px 0 6px; font-size: 15px; }
p { margin: 0 0 6px; font-size: 13px; line-height: 1.4; }
a { font-size: 12px; color: #7fd1ff; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 767px) { .card { top: 56px; } }
</style>
