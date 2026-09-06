import { reactive } from 'vue'

export function useLayers() {
  return reactive({ lowAsh: true, highAsh: true, ashfall: true, vaac: true, wind: false, windLevel: 2, provinces: true, places: true })
}
