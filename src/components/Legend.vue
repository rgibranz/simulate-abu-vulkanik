<script setup>
</script>

<template>
  <section class="legend">
    <h4>Legend</h4>
    <div class="row"><span class="ramp alt"></span><span>Ash altitude: 0 km → 16 km</span></div>
    <div class="row"><span class="ramp dep"></span><span>Ashfall (relative, log scale)</span></div>
    <div class="row"><span class="line low"></span><span>VAAC cloud, surface–FL200</span></div>
    <div class="row"><span class="line high"></span><span>VAAC cloud, surface–FL500</span></div>
    <div class="row"><span class="dot ashfall"></span><span>Ashfall report</span> <span class="dot aviation"></span><span>Airport closure</span></div>
    <p class="note">Particle count is illustrative, not mass. Winds are model data (Open-Meteo), not observations.</p>
  </section>
</template>

<style scoped>
.legend h4 { margin: 12px 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #9aa3b2; }
.row { display: flex; gap: 8px; align-items: center; font-size: 12px; padding: 2px 0; }
.ramp { width: 56px; height: 8px; border-radius: 2px; }
.ramp.alt { background: linear-gradient(90deg, rgb(96,74,54), rgb(190,205,222)); }
.ramp.dep { background: linear-gradient(90deg, rgba(214,150,48,.15), rgba(214,150,48,.85)); }
.line { width: 56px; height: 0; border-top: 2px dashed; }
.line.low { border-color: #ffa53c; } .line.high { border-color: #ff4d4d; }
.dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }
.dot.ashfall { border-color: #d69630; background: rgba(214,150,48,.35); } .dot.aviation { border-color: #ffd166; background: rgba(255,209,102,.35); }
.note { margin: 8px 0 0; font-size: 11px; color: #9aa3b2; line-height: 1.4; }
</style>
