// ============================================================
// PLACEFUL — map core (OpenLayers map, pins, filters)
// Depends on: api.js, ol
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

const vectorSource = new ol.source.Vector();
const filteredSource = new ol.source.Vector();
const placeSource = new ol.source.Vector();

const HEATMAP_MAX_ZOOM = 9;
const CLUSTER_MAX_ZOOM = 13;
const PLACE_MEDIUM_ZOOM = 11;
const PLACE_HIGH_ZOOM = 13;

const vectorLayer = new ol.layer.Vector({
  source: filteredSource,
  style: getExperienceStyle,
  zIndex: 30
});

const placeLayer = new ol.layer.Vector({
  source: placeSource,
  style: getPlaceStyle,
  zIndex: 25
});

const clusterSource = new ol.source.Cluster({
  distance: 45,
  minDistance: 20,
  source: filteredSource
});

const clusterStyleCache = {};

const clusterLayer = new ol.layer.Vector({
  source: clusterSource,
  style: function (feature) {
    const features = feature.get("features") || [];
    const size = features.length;

    if (size === 1) {
      return getExperienceStyle(features[0]);
    }

    let style = clusterStyleCache[size];

    if (!style) {
      const radius = Math.min(24, 10 + Math.log(size) * 5);

      style = new ol.style.Style({
        image: new ol.style.Circle({
          radius: radius,
          fill: new ol.style.Fill({
            color: "rgba(196, 92, 62, 0.90)"
          }),
          stroke: new ol.style.Stroke({
            color: "rgba(255, 255, 255, 0.95)",
            width: 2
          })
        }),
        text: new ol.style.Text({
          text: String(size),
          font: "600 12px Arial",
          fill: new ol.style.Fill({
            color: "#ffffff"
          }),
          stroke: new ol.style.Stroke({
            color: "rgba(0, 0, 0, 0.15)",
            width: 2
          })
        })
      });

      clusterStyleCache[size] = style;
    }

    return style;
  },
  zIndex: 20
});

const heatmapLayer = new ol.layer.Heatmap({
  source: filteredSource,
  blur: 28,
  radius: 18,
  weight: function () {
    return 1;
  },
  gradient: [
    "rgba(196, 92, 62, 0)",
    "rgba(196, 92, 62, 0.20)",
    "rgba(196, 92, 62, 0.42)",
    "rgba(196, 92, 62, 0.68)",
    "rgba(168, 75, 50, 0.90)"
  ],
  zIndex: 10
});

map.addLayer(heatmapLayer);
map.addLayer(placeLayer);
map.addLayer(clusterLayer);
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
  const isHovered = feature === hoveredExperience;
  const isSelected = feature.get("id") === currentPopupExperienceId;

  const radius = isSelected ? 9 : isHovered ? 8 : 6;

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius,
      fill: new ol.style.Fill({
        color: isSelected ? "#c45c3e" : "#ffffff"
      }),
      stroke: new ol.style.Stroke({
        color: "#c45c3e",
        width: isSelected || isHovered ? 3 : 2
      })
    })
  });
}

function getPlaceStyle(feature) {
  const experienceCount = Number(feature.get("experience_count") || 0);
  const zoom = map.getView().getZoom();

  if (zoom < PLACE_MEDIUM_ZOOM) {
    if (experienceCount < 5) {
      return null;
    }
  } else if (zoom < PLACE_HIGH_ZOOM) {
    if (experienceCount < 2) {
      return null;
    }
  }

  let radius = 7;
  if (experienceCount >= 10) {
    radius = 11;
  } else if (experienceCount >= 5) {
    radius = 9;
  }

  return new ol.style.Style({
    image: new ol.style.RegularShape({
      points: 4,
      radius: radius,
      angle: Math.PI / 4,
      fill: new ol.style.Fill({
        color: "#c45c3e"
      }),
      stroke: new ol.style.Stroke({
        color: "#ffffff",
        width: 2
      })
    })
  });
}

// ----------------------------------------------------------
// LOAD
// ----------------------------------------------------------

function updateAddExperienceButton() {
  const btn = document.getElementById("add-experience-btn");
  if (!btn) return;
  btn.style.display = isLoggedIn() ? "" : "none";
}

function updateFilteredSource() {
  filteredSource.clear();

  const features = vectorSource.getFeatures();
  const filteredFeatures = features.filter(function (feature) {
    if (activeEmotionFilter === "all") {
      return true;
    }
    return feature.get("emotion") === activeEmotionFilter;
  });

  filteredSource.addFeatures(filteredFeatures);
  clusterSource.refresh();
  heatmapLayer.changed();
  clusterLayer.changed();
  vectorLayer.changed();
}

function getMapBboxParams() {
  const extent = map.getView().calculateExtent(map.getSize());
  const bottomLeft = ol.proj.toLonLat([extent[0], extent[1]]);
  const topRight = ol.proj.toLonLat([extent[2], extent[3]]);

  return {
    min_lng: bottomLeft[0],
    min_lat: bottomLeft[1],
    max_lng: topRight[0],
    max_lat: topRight[1]
  };
}

async function loadExperiences() {
  try {
    if (experiencesError) {
      experiencesError.style.display = "none";
    }

    const bbox = getMapBboxParams();
    const params = new URLSearchParams({
      offset: "0",
      limit: "500",
      min_lng: String(bbox.min_lng),
      min_lat: String(bbox.min_lat),
      max_lng: String(bbox.max_lng),
      max_lat: String(bbox.max_lat)
    });

    const response = await apiFetch(
      API_BASE_URL + "/experiences/?" + params.toString()
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
    updateFilteredSource();
  } catch (error) {
    console.error("Failed to load experiences:", error);
    if (experiencesError) {
      experiencesError.style.display = "block";
    }
  }
}

async function loadPlaces() {
  try {
    const response = await apiFetch(
      API_BASE_URL + "/places/with-experiences"
    );

    if (!response.ok) {
      throw new Error("HTTP error: " + response.status);
    }

    const places = await response.json();

    const features = places.map(function (place) {
      return new ol.Feature({
        geometry: new ol.geom.Point(
          ol.proj.fromLonLat([place.longitude, place.latitude])
        ),
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        city: place.city,
        country: place.country,
        experience_count: place.experience_count
      });
    });

    placeSource.clear();
    placeSource.addFeatures(features);
    placeLayer.changed();
  } catch (error) {
    console.error("Failed to load places:", error);
  }
}

function updateMapVisualization() {
  const zoom = map.getView().getZoom();

  if (zoom <= HEATMAP_MAX_ZOOM) {
    heatmapLayer.setVisible(true);
    clusterLayer.setVisible(false);
    vectorLayer.setVisible(false);
    return;
  }

  if (zoom <= CLUSTER_MAX_ZOOM) {
    heatmapLayer.setVisible(false);
    clusterLayer.setVisible(true);
    vectorLayer.setVisible(false);
    return;
  }

  heatmapLayer.setVisible(false);
  clusterLayer.setVisible(false);
  vectorLayer.setVisible(true);
}

map.getView().on("change:resolution", updateMapVisualization);
map.getView().on("change:resolution", function () {
  placeLayer.changed();
});

updateMapVisualization();
loadExperiences();
loadPlaces();
updateAddExperienceButton();

let experiencesReloadTimer = null;

function scheduleLoadExperiences() {
  if (experiencesReloadTimer) {
    clearTimeout(experiencesReloadTimer);
  }
  experiencesReloadTimer = setTimeout(function () {
    loadExperiences();
  }, 300);
}

map.on("moveend", scheduleLoadExperiences);

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
// HIT TEST (shared by hover + click)
// ----------------------------------------------------------

function hitTestMapFeature(pixel) {
  return map.forEachFeatureAtPixel(
    pixel,
    function (f, layer) {
      if (layer === placeLayer) {
        return { type: "place", feature: f };
      }

      if (layer === vectorLayer) {
        return { type: "experience", feature: f };
      }

      if (layer === clusterLayer) {
        const clusteredFeatures = f.get("features") || [];

        if (!clusteredFeatures.length) {
          return null;
        }

        if (clusteredFeatures.length === 1) {
          return {
            type: "experience",
            feature: clusteredFeatures[0]
          };
        }

        return {
          type: "cluster",
          feature: f,
          features: clusteredFeatures
        };
      }

      return null;
    },
    {
      layerFilter: function (layer) {
        return (
          layer === placeLayer ||
          layer === vectorLayer ||
          layer === clusterLayer
        );
      },
      hitTolerance: 8
    }
  );
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
      clusterLayer.changed();
    }
    return;
  }

  const hit = hitTestMapFeature(event.pixel);
  map.getTargetElement().style.cursor = hit ? "pointer" : "";

  if (!hit || hit.type !== "experience") {
    if (hoveredExperience !== null) {
      hoveredExperience = null;
      vectorLayer.changed();
      clusterLayer.changed();
    }
    return;
  }

  if (hit.feature === hoveredExperience) {
    return;
  }

  hoveredExperience = hit.feature;
  vectorLayer.changed();
  clusterLayer.changed();
});

map.on("singleclick", function (event) {
  if (isSelectingLocation) {
    selectExperienceLocation(event.coordinate);
    return;
  }

  const feature = hitTestMapFeature(event.pixel);

  // Place
  if (feature && feature.type === "place") {
    if (typeof closeSidebar === "function") {
      closeSidebar();
    }
    if (typeof closeProfileSidebar === "function") {
      closeProfileSidebar();
    }
    if (typeof openPlaceSidebar === "function") {
      openPlaceSidebar(feature.feature);
    }
    unlockMainMap();
    return;
  }

  // Cluster → zoom to members
  if (feature && feature.type === "cluster") {
    const extent = ol.extent.createEmpty();
    const members = feature.features || [];

    members.forEach(function (member) {
      const geometry = member.getGeometry();
      if (geometry) {
        ol.extent.extend(extent, geometry.getExtent());
      }
    });

    if (!ol.extent.isEmpty(extent)) {
      map.getView().fit(extent, {
        padding: [80, 80, 80, 80],
        maxZoom: 16,
        duration: 350,
        callback: function () {
          unlockMainMap();
        }
      });
    }
    return;
  }

  // Empty map
  if (!feature) {
    if (typeof closeSidebar === "function") {
      closeSidebar();
    }
    if (typeof closePlaceSidebar === "function") {
      closePlaceSidebar();
    }
    if (typeof closeProfileSidebar === "function") {
      closeProfileSidebar();
    }
    return;
  }

  // Single experience
  if (feature.type === "experience") {
    if (typeof closeProfileSidebar === "function") {
      closeProfileSidebar();
    }
    if (typeof closePlaceSidebar === "function") {
      closePlaceSidebar();
    }
    if (typeof openExperienceSidebar === "function") {
      openExperienceSidebar(feature.feature);
    }
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

    updateFilteredSource();
    if (typeof closeSidebar === "function") {
      closeSidebar();
    }
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

  if (
    experienceFormOverlay &&
    experienceFormOverlay.classList.contains("active")
  ) {
    closeExperienceFormAndReset();
    return;
  }

  if (isSelectingLocation) {
    isSelectingLocation = false;
    if (addExperienceBtn) {
      addExperienceBtn.innerHTML =
        '<span class="add-experience-icon">+</span><span>Add experience</span>';
    }
    map.getTargetElement().style.cursor = "";
    return;
  }

  if (typeof closeSidebar === "function") {
    closeSidebar();
  }
});

window.addEventListener("resize", function () {
  map.updateSize();
});