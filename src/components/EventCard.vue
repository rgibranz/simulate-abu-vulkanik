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
      <time class="when">{{ formatWib(Date.parse(current.timeUtc)) }}</time>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
      <a :href="current.sourceUrl" target="_blank" rel="noopener">Baca sumbernya</a>
    </article>
  </transition>
</template>

<style scoped>
.card { position: absolute; left: 16px; top: 96px; z-index: 1000; width: min(340px, calc(100vw - 32px)); padding: 12px 16px 12px 14px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--ash); border-radius: 4px; color: var(--bone); backdrop-filter: blur(8px); }
.card.eruption { border-left-color: var(--ember); } .card.ashfall { border-left-color: var(--ashfall); } .card.aviation { border-left-color: #ffd166; } .card.advisory { border-left-color: var(--sky); }
.when { display: block; font-size: 12px; color: var(--ash); font-variant-numeric: tabular-nums; }
h3 { margin: 3px 0 6px; font-size: 16px; font-weight: 600; line-height: 1.25; }
p { margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: var(--bone); max-width: 44ch; }
a { font-size: 12px; color: var(--sky); text-decoration: none; border-bottom: 1px solid rgba(127, 209, 255, 0.4); }
a:hover { border-bottom-color: var(--sky); }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 767px) { .card { top: 60px; } }
</style>
