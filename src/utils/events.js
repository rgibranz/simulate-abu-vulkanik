const tOf = (e) => Date.parse(e.timeUtc)

export function latestEventAt(events, tMs) {
  let best = null
  for (const e of events) if (tOf(e) <= tMs && (!best || tOf(e) > tOf(best))) best = e
  return best
}

export function locatedEventsUpTo(events, tMs) {
  return events.filter(e => e.location && tOf(e) <= tMs).sort((a, b) => tOf(a) - tOf(b))
}
