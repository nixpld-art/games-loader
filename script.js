const games = window.__GAMES__ || [];

const grid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const dropdown = document.getElementById("dropdown");
const gameArea = document.getElementById("gameArea");
const gameFrame = document.getElementById("gameFrame");
const gameTitle = document.getElementById("gameTitle");
const backBtn = document.getElementById("backBtn");
const gallerySection = document.getElementById("gallerySection");
const noResults = document.getElementById("noResults");
const gameCount = document.getElementById("gameCount");

let activeIndex = -1;

gameCount.textContent = `${games.length} games`;

function renderGrid(list) {
  grid.innerHTML = "";
  if (list.length === 0) {
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";
  list.forEach(g => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="g-icon">${g.icon}</div>
      <h3>${g.title}</h3>
      <div class="g-category">${g.category}</div>
    `;
    card.addEventListener("click", () => launchGame(g));
    grid.appendChild(card);
  });
}

function buildDropdown(list) {
  dropdown.innerHTML = "";
  if (!list || list.length === 0) {
    dropdown.classList.remove("active");
    return;
  }
  list.forEach((g, i) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.dataset.index = i;
    item.innerHTML = `
      <span class="d-icon">${g.icon}</span>
      <div class="d-info">
        <div class="d-title">${highlight(g.title, searchInput.value)}</div>
        <div class="d-desc">${g.category} &middot; ${g.desc}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      launchGame(g);
      closeDropdown();
    });
    item.addEventListener("mouseenter", () => {
      activeIndex = i;
      updateActive();
    });
    dropdown.appendChild(item);
  });
  dropdown.classList.add("active");
  activeIndex = -1;
}

function highlight(text, query) {
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return text.replace(re, '<b style="color:#7c5cfc">$1</b>');
}

function closeDropdown() {
  dropdown.classList.remove("active");
  activeIndex = -1;
}

function updateActive() {
  document.querySelectorAll(".dropdown-item").forEach((el, i) => {
    el.classList.toggle("active", i === activeIndex);
  });
}

function filterGames(query) {
  const q = query.toLowerCase().trim();
  if (!q) return games;
  return games.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.category.toLowerCase().includes(q) ||
    g.desc.toLowerCase().includes(q)
  );
}

function handleSearchInput() {
  const val = searchInput.value;
  const results = filterGames(val);
  if (val.length > 0) {
    buildDropdown(results);
  } else {
    closeDropdown();
  }
  renderGrid(results);
}

function launchGame(game) {
  searchInput.value = game.title;
  closeDropdown();
  gallerySection.style.display = "none";
  gameArea.style.display = "block";
  gameTitle.textContent = game.icon + " " + game.title;
  gameFrame.src = "/play/" + game.slug;
}

function goBack() {
  gameArea.style.display = "none";
  gallerySection.style.display = "block";
  gameFrame.src = "";
  searchInput.value = "";
  searchInput.focus();
  renderGrid(games);
}

searchInput.addEventListener("input", handleSearchInput);

searchInput.addEventListener("keydown", (e) => {
  const items = dropdown.querySelectorAll(".dropdown-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    updateActive();
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, -1);
    updateActive();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      items[activeIndex].click();
    } else if (searchInput.value.trim()) {
      const results = filterGames(searchInput.value);
      if (results.length > 0) launchGame(results[0]);
    }
  } else if (e.key === "Escape") {
    closeDropdown();
  }
});

searchBtn.addEventListener("click", () => {
  const val = searchInput.value.trim();
  if (!val) return;
  const results = filterGames(val);
  if (results.length > 0) launchGame(results[0]);
});

backBtn.addEventListener("click", goBack);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) closeDropdown();
});

renderGrid(games);
