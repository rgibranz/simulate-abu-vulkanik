import { reactive } from 'vue'

export function useLayers() {
  return reactive({ lowAsh: true, highAsh: true, ashfall: true, vaac: true, vaacForecast: false, wind: false, windLevel: 2, windModel: 'best', provinces: true, places: true, pm10: true })
}
