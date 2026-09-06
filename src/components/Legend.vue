<script setup>
</script>

<template>
  <section class="legend">
    <h4>Cara membaca peta</h4>
    <div class="row"><span class="ramp alt"></span><span>Ketinggian abu, 0 km sampai 16 km</span></div>
    <div class="row"><span class="ramp dep"></span><span>Endapan abu, relatif skala log</span></div>
    <div class="row"><span class="line low"></span><span>Awan VAAC sampai FL200</span></div>
    <div class="row"><span class="line high"></span><span>Awan VAAC sampai FL500</span></div>
    <div class="row"><span class="dot ashfall"></span><span>Laporan hujan abu</span><span class="dot aviation gap"></span><span>Bandara ditutup</span></div>
    <p class="note">Jumlah partikel hanya ilustrasi, bukan massa abu. Angin berasal dari model cuaca, bukan pengamatan.</p>
  </section>
</template>

<style scoped>
.legend h4 { margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--bone); }
.row { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--bone); padding: 2px 0; }
.ramp { flex: none; width: 56px; height: 8px; border-radius: 2px; }
.ramp.alt { background: linear-gradient(90deg, rgb(96, 74, 54), rgb(190, 205, 222)); }
.ramp.dep { background: linear-gradient(90deg, rgba(214, 150, 48, 0.15), rgba(214, 150, 48, 0.85)); }
.line { flex: none; width: 56px; height: 0; border-top: 2px dashed; }
.line.low { border-color: #ffa53c; } .line.high { border-color: #ff4d4d; }
.dot { flex: none; width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }
.dot.gap { margin-left: 8px; }
.dot.ashfall { border-color: var(--ashfall); background: rgba(214, 150, 48, 0.35); } .dot.aviation { border-color: #ffd166; background: rgba(255, 209, 102, 0.35); }
.note { margin: 8px 0 0; font-size: 11.5px; color: var(--ash); line-height: 1.45; max-width: 36ch; }
</style>
