// ============================================================
// PLACEFUL — map core (OpenLayers map, pins, filters)
// Depends on: api.js, ol
// ============================================================

// ============================================================
// PLACEFUL — map + experience sidebar
// ============================================================

const map = new ol.Map({
  target: "full-map",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([45.0783, 37.5497]),
    zoom: 12
  })
});

setTimeout(function () {
  map.updateSize();
}, 0);

window.addEventListener("resize", function () {
  map.updateSize();
});

const emotionConfig = {
  happy: { emoji: "😊", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  peaceful: { emoji: "😌", label: "Peaceful" },
  excited: { emoji: "🤩", label: "Excited" },
  nostalgic: { emoji: "🥹", label: "Nostalgic" },
  love: { emoji: "❤️", label: "Love" }
};

let activeEmotionFilter = "all";
let hoveredExperience = null;
let isSelectingLocation = false;
let selectedLongitude = null;
let selectedLatitude = null;
let currentPopupExperienceId = null;
let currentCommentsExperienceId = null;
let currentComments = [];

// API_BASE_URL / auth helpers: defined in auth.js (load auth.js first)
const vectorSource = new ol.source.Vector();

const vectorLayer = new ol.layer.Vector({
  source: vectorSource,
  style: function (feature) {
    const emotion = feature.get("emotion");

    if (activeEmotionFilter !== "all" && emotion !== activeEmotionFilter) {
      return null;
    }

    return getExperienceStyle(feature);
  }
});

map.addLayer(vectorLayer);

// ----------------------------------------------------------
// DOM
// ----------------------------------------------------------

const experiencesError = document.getElementById("experiences-error");

const sidebar = document.getElementById("experience-sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarTitle = document.getElementById("sidebar-title");
const sidebarPlace = document.getElementById("sidebar-place");
const sidebarStory = document.getElementById("sidebar-story");
const sidebarEmotion = document.getElementById("sidebar-emotion");
const sidebarCreator = document.getElementById("sidebar-creator");
const sidebarCreatorAvatar = document.getElementById("sidebar-creator-avatar");
const sidebarCreatorName = document.getElementById("sidebar-creator-name");
const sidebarCreatorUsername = document.getElementById("sidebar-creator-username");
const sidebarDate = document.getElementById("sidebar-date");

const sidebarLikeBtn = document.getElementById("sidebar-like-btn");
const sidebarLikeIcon = document.getElementById("sidebar-like-icon");
const sidebarLikeText = document.getElementById("sidebar-like-text");
const sidebarLikeCount = document.getElementById("sidebar-like-count");
const sidebarLikeMessage = document.getElementById("sidebar-like-message");
const sidebarMedia = document.getElementById("sidebar-media");
const sidebarMediaImage = document.getElementById("sidebar-media-image");
const sidebarMediaPrev = document.getElementById("sidebar-media-prev");
const sidebarMediaNext = document.getElementById("sidebar-media-next");
const sidebarMediaCounter = document.getElementById("sidebar-media-counter");
const sidebarMediaExpand = document.getElementById("sidebar-media-expand");
const experienceMediaInput = document.getElementById("experience-media");
const mediaViewer = document.getElementById("media-viewer");
const mediaViewerImage = document.getElementById("media-viewer-image");
const mediaViewerCounter = document.getElementById("media-viewer-counter");
const mediaViewerClose = document.getElementById("media-viewer-close");
const mediaViewerPrev = document.getElementById("media-viewer-prev");
const mediaViewerNext = document.getElementById("media-viewer-next");

let currentMediaItems = [];
let currentMediaIndex = 0;


const commentsList = document.getElementById("comments-list");
const commentsCount = document.getElementById("comments-count");
const commentInput = document.getElementById("comment-input");
const submitCommentBtn = document.getElementById("submit-comment-btn");
const commentLoginMessage = document.getElementById("comment-login-message");

const addExperienceBtn = document.getElementById("add-experience-btn");
const experienceFormOverlay = document.getElementById("experience-form-overlay");
const closeExperienceForm = document.getElementById("close-experience-form");
const cancelExperienceBtn = document.getElementById("cancel-experience");
const experienceForm = document.getElementById("experience-form");

// ----------------------------------------------------------
// STYLE
// ----------------------------------------------------------

function getExperienceStyle(feature) {
  const emotion = feature.get("emotion");
  let emoji = "📍";

  if (emotion && emotionConfig[emotion]) {
    emoji = emotionConfig[emotion].emoji;
  }

  const isHovered = feature === hoveredExperience;
  const isSelected = feature.get("id") === currentPopupExperienceId;
  const fontSize = isHovered || isSelected ? 32 : 24;

  return new ol.style.Style({
    text: new ol.style.Text({
      text: emoji,
      font: fontSize + "px Arial",
      textAlign: "center",
      textBaseline: "middle",
      stroke: new ol.style.Stroke({
        color: "rgba(255,255,255,0.9)",
        width: isHovered || isSelected ? 4 : 2
      })
    })
  });
}

// ----------------------------------------------------------
// LOAD EXPERIENCES  (auth helpers live in api.js)
// ----------------------------------------------------------


function updateAddExperienceButton() {
  const btn = document.getElementById("add-experience-btn");
  if (!btn) return;
  // Only signed-in users can create experiences
  btn.style.display = isLoggedIn() ? "" : "none";
}

async function loadExperiences() {
  try {
    if (experiencesError) {
      experiencesError.style.display = "none";
    }

    // Public experiences are visible to everyone (including guests).
    // When logged in, apiFetch sends the token so private/followers show for the owner.
    const response = await apiFetch(
      API_BASE_URL + "/experiences/?offset=0&limit=100"
    );

    if (!response.ok) {
      throw new Error("HTTP error: " + response.status);
    }

    const geojson = await response.json();
    const features = new ol.format.GeoJSON().readFeatures(geojson, {
      featureProjection: "EPSG:3857"
    });

    vectorSource.clear();
    vectorSource.addFeatures(features);
    vectorLayer.changed();
  } catch (error) {
    console.error("Failed to load experiences:", error);
    if (experiencesError) {
      experiencesError.style.display = "block";
    }
  }
}

loadExperiences();
updateAddExperienceButton();

function unlockMainMap() {
  const target = map.getTargetElement();
  if (target) {
    target.style.pointerEvents = "auto";
    target.style.cursor = "";
  }
  map.getInteractions().forEach(function (interaction) {
    interaction.setActive(true);
  });
  map.updateSize();
}

// ----------------------------------------------------------
// MAP INTERACTIONS
// ----------------------------------------------------------

map.on("pointermove", function (event) {
  if (isSelectingLocation) {
    map.getTargetElement().style.cursor = "crosshair";
    if (hoveredExperience !== null) {
      hoveredExperience = null;
      vectorLayer.changed();
    }
    return;
  }

  const feature = map.forEachFeatureAtPixel(event.pixel, function (f) {
    return f;
  });

  map.getTargetElement().style.cursor = feature ? "pointer" : "";

  if (feature === hoveredExperience) {
    return;
  }

  hoveredExperience = feature || null;
  vectorLayer.changed();
});

map.on("singleclick", function (event) {
  if (isSelectingLocation) {
    selectExperienceLocation(event.coordinate);
    return;
  }

  const feature = map.forEachFeatureAtPixel(event.pixel, function (f) {
    return f;
  });

  if (!feature) {
    closeSidebar();
    if (typeof closeProfileSidebar === "function") {
      closeProfileSidebar();
    }
    return;
  }

  // Profile sits above experience sidebar — close it first
  if (typeof closeProfileSidebar === "function") {
    closeProfileSidebar();
  }

  if (typeof openExperienceSidebar === "function") {
    openExperienceSidebar(feature);
  }
  if (typeof unlockMainMap === "function") {
    unlockMainMap();
  }
});

// ----------------------------------------------------------
// EMOTION FILTER
// ----------------------------------------------------------

const legendItems = document.querySelectorAll(".legend-item");
const legendToggle = document.getElementById("legend-toggle");
const legendContent = document.getElementById("legend-content");

legendItems.forEach(function (item) {
  item.addEventListener("click", function () {
    const clickedEmotion = item.dataset.emotion;

    if (clickedEmotion === "all" || activeEmotionFilter === clickedEmotion) {
      activeEmotionFilter = "all";
    } else {
      activeEmotionFilter = clickedEmotion;
    }

    legendItems.forEach(function (legendItem) {
      legendItem.classList.toggle(
        "active",
        legendItem.dataset.emotion === activeEmotionFilter
      );
    });

    vectorLayer.changed();
    closeSidebar();
  });
});

if (legendToggle && legendContent) {
  legendToggle.addEventListener("click", function (event) {
    event.stopPropagation();
    legendContent.classList.toggle("hidden");
    const isHidden = legendContent.classList.contains("hidden");
    legendToggle.textContent = isHidden ? "+" : "−";
    legendToggle.setAttribute(
      "aria-label",
      isHidden ? "Show emotion legend" : "Hide emotion legend"
    );
  });
}

// ----------------------------------------------------------
// GLOBAL KEYS / RESIZE
// ----------------------------------------------------------

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  if (mediaViewer && !mediaViewer.hidden) {
    closeMediaViewer();
    return;
  }

  if (experienceFormOverlay && experienceFormOverlay.classList.contains("active")) {
    closeExperienceFormAndReset();
    return;
  }

  if (isSelectingLocation) {
    isSelectingLocation = false;
    addExperienceBtn.innerHTML =
      '<span class="add-experience-icon">+</span><span>Add experience</span>';
    map.getTargetElement().style.cursor = "";
    return;
  }

  closeSidebar();
});

window.addEventListener("resize", function () {
  map.updateSize();
});
