export function visibleItems(notices, events, { audience, campus, query, sourceMode, matchMode, today, matchNotice }) {
  const resident = audience === 'resident';
  const items = resident ? events : [...events, ...notices];
  return items.filter((item) => {
    const local = item.kind === 'local-event';
    const inRegion = local ? (campus === 'all' || item.region === campus)
      : (campus === 'all' || item.campuses.includes('전체') || item.campuses.includes(campus));
    const inDate = !local || item.endAt >= today;
    const inSource = resident || sourceMode === 'all' || (sourceMode === 'local' ? local : !local);
    const inQuery = !query || `${item.title} ${item.body || ''}`.toLocaleLowerCase().includes(query);
    const inMatch = resident || matchMode === 'all' || (!local && matchNotice(item).category === matchMode);
    return inRegion && inDate && inSource && inQuery && inMatch;
  }).sort((a, b) => {
    if (a.kind === 'local-event' && b.kind === 'local-event') return a.startAt.localeCompare(b.startAt);
    if (a.kind === 'local-event') return -1;
    if (b.kind === 'local-event') return 1;
    return b.postedAt.localeCompare(a.postedAt);
  });
}
