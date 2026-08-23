(() => {
  const statusRank = {
    available: 0,
    pending: 1,
    hold: 2,
    sold: 3
  };

  let scheduled = false;

  function sortInventoryRows() {
    const list = document.getElementById('inventoryList');
    if (!list) return;

    const rows = [...list.querySelectorAll('.inventory-row')];
    if (rows.length < 2) return;

    const ranked = rows.map((row, index) => {
      const badge = row.querySelector('.badge');
      const status = String(badge?.textContent || 'Available').trim().toLowerCase();
      return {
        row,
        index,
        rank: statusRank[status] ?? 99
      };
    });

    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);

    const alreadySorted = ranked.every((item, index) => item.row === rows[index]);
    if (alreadySorted) return;

    const fragment = document.createDocumentFragment();
    ranked.forEach(item => fragment.appendChild(item.row));
    list.appendChild(fragment);
  }

  function scheduleSort() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sortInventoryRows();
    });
  }

  function start() {
    const list = document.getElementById('inventoryList');
    if (!list) return;

    sortInventoryRows();
    new MutationObserver(scheduleSort).observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
