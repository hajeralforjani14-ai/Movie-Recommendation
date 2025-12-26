/* CONFIG */
const TMDB_API_KEY = "b8814406ab462cf0919bd9323fff86ca";
let LANG = "ar-EG";
let REGION = "EG";

/* DOM عناصر */
const dropdown = document.getElementById("dropdown");
const menuBtn = document.getElementById("menuBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");
const langSelect = document.getElementById("langSelect");
const regionSelect = document.getElementById("regionSelect");

const tabs = document.querySelectorAll(".tab");
const cardsEl = document.getElementById("cards");
const emptyStateEl = document.getElementById("emptyState");
const clearAllBtn = document.getElementById("clearAll");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

const filtersBtn = document.getElementById("filtersBtn");
const filtersPanel = document.getElementById("filtersPanel");
const closeFilters = document.getElementById("closeFilters");
const applyFilters = document.getElementById("applyFilters");
const resetFilters = document.getElementById("resetFilters");
const genreSelect = document.getElementById("genreSelect");
const yearFrom = document.getElementById("yearFrom");
const yearTo = document.getElementById("yearTo");
const minRating = document.getElementById("minRating");
const sortSelect = document.getElementById("sortSelect");

const watchlistBtn = document.getElementById("watchlistBtn");
const watchlistDrawer = document.getElementById("watchlistDrawer");
const closeDrawer = document.getElementById("closeDrawer");
const watchlistItems = document.getElementById("watchlistItems");

const themeToggle = document.getElementById("themeToggle");
  
/* STATE */
let currentTab = "all";
let currentResults = [];
let watchlist = JSON.parse(localStorage.getItem("hf_watchlist") || "[]");

let filters = {
  genre: null,
  yearFrom: null,
  yearTo: null,
  minRating: null,
  sort: "popularity.desc",
};

/* UI TOGGLES */
menuBtn.addEventListener("click", () => {
  dropdown.classList.toggle("hidden");
  settingsPanel.classList.add("hidden");
});
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  dropdown.classList.add("hidden");
});
closeSettings.addEventListener("click", () => settingsPanel.classList.add("hidden"));

langSelect.addEventListener("change", (e) => {
  LANG = e.target.value;
  loadInitial();
});
regionSelect.addEventListener("change", (e) => {
  REGION = e.target.value;
  loadInitial();
});

window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
  }
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");

  if (document.body.classList.contains("light-mode")) {
    localStorage.setItem("theme", "light");
  } else {
    localStorage.setItem("theme", "dark");
  }
});




/* TABS */
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    searchInput.value = "";
    applyCurrentTab();
  });
});

/* SEARCH */
searchBtn.addEventListener("click", () => {
  const q = searchInput.value.trim();
  if (!q) { applyCurrentTab(); return; }
  searchAll(q);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

/* FILTERS */
filtersBtn.addEventListener("click", () => {
  filtersPanel.classList.toggle("hidden");
});
closeFilters.addEventListener("click", () => filtersPanel.classList.add("hidden"));

resetFilters.addEventListener("click", () => {
  filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, sort: "popularity.desc" };
  genreSelect.value = "";
  yearFrom.value = "";
  yearTo.value = "";
  minRating.value = "";
  sortSelect.value = "popularity.desc";
  applyCurrentTab();
});

applyFilters.addEventListener("click", () => {
  filters.genre = genreSelect.value || null;
  filters.yearFrom = yearFrom.value ? Number(yearFrom.value) : null;
  filters.yearTo = yearTo.value ? Number(yearTo.value) : null;
  filters.minRating = minRating.value ? Number(minRating.value) : null;
  filters.sort = sortSelect.value;
  filtersPanel.classList.add("hidden");
  applyCurrentTab();
});

/* WATCHLIST DRAWER */
watchlistBtn.addEventListener("click", () => {
  renderWatchlist();
  watchlistDrawer.classList.remove("hidden");
});
closeDrawer.addEventListener("click", () => watchlistDrawer.classList.add("hidden"));

clearAllBtn.addEventListener("click", () => {
  searchInput.value = "";
  resetFilters.click();
});

/* API HELPERS */
const TMDB_IMG = (path, size = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", LANG);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB error: " + res.status);
  return res.json();
}

/* GENRES */
async function loadGenres() {
  const movie = await tmdb("genre/movie/list");
  const tv = await tmdb("genre/tv/list");

  const merged = [
    { id: "", name: "بدون | None" },
    ...movie.genres.map(g => ({ id: g.id, name:` فيلم: ${g.name}` })),
    ...tv.genres.map(g => ({ id: "tv_" + g.id, name:` مسلسل: ${g.name}` })),
  ];

  genreSelect.innerHTML =
    merged.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
}

/* FETCHERS */
async function loadTrending() {
  const dataMovie = await tmdb("trending/movie/week");
  const dataTV = await tmdb("trending/tv/week");

  let combined = [];

  if (currentTab === "all" || currentTab === "kids") {
    combined = [
      ...dataMovie.results.map(x => ({ ...x, media_type: "movie" })),
      ...dataTV.results.map(x => ({ ...x, media_type: "tv" })),
    ];
  } else if (currentTab === "movie") {
    combined = dataMovie.results.map(x => ({ ...x, media_type: "movie" }));
  } else if (currentTab === "tv") {
    combined = dataTV.results.map(x => ({ ...x, media_type: "tv" }));
  }

  if (currentTab === "kids") {
    const kidsGenres = [16, 10751];
    combined = combined.filter(x =>
      (x.genre_ids || []).some(id => kidsGenres.includes(id))
    );
  }

  currentResults = combined;
  applyFilterLogic();
}

async function discoverMovies() {
  const params = {
    sort_by: filters.sort || "popularity.desc",
    include_adult: false,
    page: 1,
  };

  if (filters.genre && !filters.genre.startsWith("tv_"))
    params.with_genres = filters.genre;

  if (filters.yearFrom) params["primary_release_date.gte"] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params["primary_release_date.lte"] = `${filters.yearTo}-12-31`;

  const data = await tmdb("discover/movie", params);
  currentResults = data.results.map(x => ({ ...x, media_type: "movie" }));
  applyFilterLogic(true);
}

async function discoverTV() {
  const params = {
    sort_by: filters.sort,
    include_adult: false,
    page: 1,
  };

  if (filters.genre && filters.genre.startsWith("tv_"))
    params.with_genres = filters.genre.replace("tv_", "");

  if (filters.yearFrom) params["first_air_date.gte"] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params["first_air_date.lte"] = `${filters.yearTo}-12-31`;

  const data = await tmdb("discover/tv", params);
  currentResults = data.results.map(x => ({ ...x, media_type: "tv" }));
  applyFilterLogic(true);
}

async function searchAll(q) {
  const data = await tmdb("search/multi", { query: q, include_adult: false, page: 1 });
  currentResults = data.results.filter(x => ["movie", "tv"].includes(x.media_type));
  applyFilterLogic();
}

/* FILTER APPLICATION */
function applyFilterLogic(discoverMode = false) {
  let items = [...currentResults];

  if (filters.minRating != null)
    items = items.filter(x => (x.vote_average || 0) >= filters.minRating);

  if (!discoverMode && (!filters.sort || filters.sort === "popularity.desc")) {
    items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (filters.sort === "vote_average.desc") {
    items.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  } else if (filters.sort === "release_date.desc") {
    items.sort((a, b) => {
      const da = a.release_date || a.first_air_date || "1970-01-01";
      const db = b.release_date || b.first_air_date || "1970-01-01";
      return new Date(db) - new Date(da);
    });
  }

  renderCards(items);
}

/* RENDER CARDS */
function renderCards(items) {
  cardsEl.innerHTML = "";
  if (!items.length) { emptyStateEl.classList.remove("hidden"); return; }
  emptyStateEl.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const isMovie = item.media_type === "movie";
    const title = isMovie ? item.title : item.name;
    const date = isMovie ? item.release_date : item.first_air_date;
    const poster = TMDB_IMG(item.poster_path);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "—";
    const key = `${item.media_type}:${item.id}`;

    const card = document.createElement("article");
    card.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const front = document.createElement("div");
    front.className = "card-front";

    const img = document.createElement("img");
    img.className = "poster";
    img.src = poster;
    img.alt = title;

    const bodyFront = document.createElement("div");
    bodyFront.className = "card-body";

    const h = document.createElement("div");
    h.className = "title";
    h.textContent = title;

    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = `${isMovie ? "فيلم" : "مسلسل"} | ${date || "—"} | ⭐ ${rating}`;

    bodyFront.appendChild(h);
    bodyFront.appendChild(m);
    front.appendChild(img);
    front.appendChild(bodyFront);

    const back = document.createElement("div");
    back.className = "card-back";

    const hBack = document.createElement("h3");
    hBack.textContent = title;

    const infoBack = document.createElement("p");
    infoBack.textContent = `${isMovie ? "فيلم" : "مسلسل"} | ⭐ ${rating} | ${date || "—"}`;

    const overviewBack = document.createElement("p");
    overviewBack.textContent = item.overview || "لا يوجد وصف";

    const rowBack = document.createElement("div");
    rowBack.className = "actions-row";

    const saveBack = document.createElement("button");
    saveBack.className = "save-btn";
    saveBack.dataset.key = key;
    if (watchlist.some(w => w.key === key)) {
      saveBack.textContent = "إزالة | Remove";
      saveBack.classList.add("active");
    } else {
      saveBack.textContent = "حفظ | Save";
    }

    saveBack.addEventListener("click", () => {
      const idx = watchlist.findIndex(w => w.key === key);
      if (idx >= 0) {
        watchlist.splice(idx, 1);
        saveBack.textContent = "حفظ | Save";
        saveBack.classList.remove("active");
      } else {
        watchlist.push({ key, id: item.id, media_type: item.media_type, title, poster });
        saveBack.textContent = "إزالة | Remove";
        saveBack.classList.add("active");
      }
      localStorage.setItem("hf_watchlist", JSON.stringify(watchlist));
      renderWatchlist();
    });

    const moreBack = document.createElement("button");
    moreBack.className = "save-btn";
    moreBack.textContent = "تفاصيل | Details";

    moreBack.addEventListener("click", async () => {
      showDetailsModal(item);
    });

    rowBack.appendChild(saveBack);
    rowBack.appendChild(moreBack);

    back.appendChild(hBack);
    back.appendChild(infoBack);
    back.appendChild(overviewBack);
    back.appendChild(rowBack);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    fragment.appendChild(card);
  });

  cardsEl.appendChild(fragment);
}

/* DETAILS MODAL */
async function showDetailsModal(item) {
  const modal = document.getElementById("movieModal");
  const closeModal = document.getElementById("closeModal");

  modal.style.display = "flex";

  try {
    const [details, credits, videos, images] = await Promise.all([
      tmdb(`${item.media_type}/${item.id}`),
      tmdb(`${item.media_type}/${item.id}/credits`),
      tmdb(`${item.media_type}/${item.id}/videos`, { language: "en-US" }),
      tmdb(`${item.media_type}/${item.id}/images`, { include_image_language: "null,en" }),
    ]);

    document.getElementById("modalPoster").src = details.poster_path ? TMDB_IMG(details.poster_path) : "default.jpg";
    document.getElementById("modalTitle").textContent = details.title || details.name;
    document.getElementById("modalTagline").textContent = details.tagline || "";
    document.getElementById("modalRate").textContent = details.vote_average ? details.vote_average.toFixed(1) : "—";
    document.getElementById("modalDate").textContent = details.release_date || details.first_air_date;
    document.getElementById("modalOverview").textContent = details.overview || "";

    const gallery = document.getElementById("modalGallery");
    gallery.innerHTML = "";
    let pics = images.backdrops.length ? images.backdrops : images.posters;
    pics.slice(0, 6).forEach(img => {
      const pic = document.createElement("img");
      pic.src = TMDB_IMG(img.file_path);
      pic.className = "gallery-img";
      gallery.appendChild(pic);
    });

    const castBox = document.getElementById("modalCast");
    castBox.innerHTML = "";
    credits.cast.slice(0, 10).forEach(c => {
      const actor = document.createElement("div");
      actor.className = "actor";
      actor.innerHTML = `<img src="${c.profile_path ? TMDB_IMG(c.profile_path) : 'default-profile.jpg'}" alt="${c.name}" />
                         <div class="name">${c.name}</div>`;
      castBox.appendChild(actor);
    });

    const trailerBox = document.getElementById("modalTrailer");
    trailerBox.src = "";
    let trailer = videos.results.find(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
    trailerBox.src = trailer ? `https://www.youtube.com/embed/${trailer.key}` : "";

  } catch (err) {
    console.error(err);
    alert("خطأ في جلب تفاصيل الفيلم. تحقق من الكونسول.");
  }

  closeModal.onclick = () => {
    modal.style.display = "none";
    document.getElementById("modalTrailer").src = "";
  };
  window.onclick = e => {
    if (e.target === modal) {
      modal.style.display = "none";
      document.getElementById("modalTrailer").src = "";
    }
  };
}

/* WATCHLIST */
function renderWatchlist() {
  watchlistItems.innerHTML = "";

  if (!watchlist.length) {
    watchlistItems.innerHTML = '<p style="color:var(--muted)">لا توجد عناصر محفوظة.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  watchlist.forEach(w => {
    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "poster";
    img.src = w.poster;
    img.alt = w.title;

    const body = document.createElement("div");
    body.className = "card-body";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = w.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = w.media_type === "movie" ? "فيلم" : "مسلسل";

    const row = document.createElement("div");
    row.className = "actions-row";

    const remove = document.createElement("button");
    remove.className = "save-btn";
    remove.textContent = "حذف | Remove";

    remove.addEventListener("click", () => {
      watchlist = watchlist.filter(x => x.key !== w.key);
      localStorage.setItem("hf_watchlist", JSON.stringify(watchlist));
      renderWatchlist();

      const cardBtn = document.querySelector(`.card .save-btn[data-key='${w.key}']`);
      if (cardBtn) {
        cardBtn.textContent = "حفظ | Save";
        cardBtn.classList.remove("active");
      }
    });

    row.appendChild(remove);
    body.appendChild(t);
    body.appendChild(meta);
    body.appendChild(row);

    card.appendChild(img);
    card.appendChild(body);
    fragment.appendChild(card);
  });

  watchlistItems.appendChild(fragment);
}

/* FLOW */
async function applyCurrentTab() {
  const q = searchInput.value.trim();
  if (q) return searchAll(q);

  if (currentTab === "movie") return discoverMovies();
  if (currentTab === "tv") return discoverTV();

  return loadTrending();
}

async function loadInitial() {
  await loadGenres();
  await applyCurrentTab();
}

/* START */
loadInitial();
