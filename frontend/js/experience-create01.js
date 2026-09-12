// ============================================================
// PLACEFUL — create experience (clean flow)
// Depends on: api.js, map.js (map, isSelectingLocation, selectedLatitude/Longitude), auth.js
// ============================================================

const elLocationLabel = document.getElementById("selected-location-label");
const elPlaceLabel = document.getElementById("selected-place-label");
const elFormStatus = document.getElementById("experience-form-status");
const elStepLabel = document.getElementById("experience-form-step-label");
const elStepBack = document.getElementById("experience-step-back");
const elStepNext = document.getElementById("experience-step-next");
const elSubmitBtn = document.getElementById("experience-submit-btn");
const elStep1 = document.getElementById("experience-step-1");
const elStep2 = document.getElementById("experience-step-2");
const elStep3 = document.getElementById("experience-step-3");
const elStep4 = document.getElementById("experience-step-4");
const elPlaceList = document.getElementById("place-candidate-list");
const elPlaceStatus = document.getElementById("place-selection-status");
const elPlaceSearchInput = document.getElementById("place-search-input");
const elPlaceSearchBtn = document.getElementById("place-search-btn");
const elPlaceSkipBtn = document.getElementById("place-skip-btn");
const elMediaInput = document.getElementById("experience-media");
const elCloseForm = document.getElementById("close-experience-form");
const elCancelForm = document.getElementById("cancel-experience");
const elAddBtn = document.getElementById("add-experience-btn");
const elFormOverlay = document.getElementById("experience-form-overlay");
const elExperienceForm = document.getElementById("experience-form");

let experienceFormStep = 1;
let selectedPlaceId = null;
let selectedPlace = null;
let placeBusy = false;

function setStatus(message, isError) {
  if (!elFormStatus) return;
  elFormStatus.textContent = message || "";
  elFormStatus.classList.toggle("form-status-error", Boolean(isError && message));
}

function setPlaceStatus(message) {
  if (elPlaceStatus) elPlaceStatus.textContent = message || "";
}

function updateStepUI() {
  if (elStep1) elStep1.hidden = experienceFormStep !== 1;
  if (elStep2) elStep2.hidden = experienceFormStep !== 2;
  if (elStep3) elStep3.hidden = experienceFormStep !== 3;
  if (elStep4) elStep4.hidden = experienceFormStep !== 4;

  if (elStepLabel) {
    const labels = {
      1: "Step 1 of 4 — Place",
      2: "Step 2 of 4 — Story",
      3: "Step 3 of 4 — Visibility",
      4: "Step 4 of 4 — Identity"
    };
    elStepLabel.textContent = labels[experienceFormStep] || "";
  }

  if (elStepBack) elStepBack.hidden = experienceFormStep === 1;
  if (elStepNext) elStepNext.hidden = experienceFormStep === 4;
  if (elSubmitBtn) elSubmitBtn.hidden = experienceFormStep !== 4;
}

function updateLocationLabel() {
  if (!elLocationLabel) return;
  if (selectedLatitude == null || selectedLongitude == null) {
    elLocationLabel.textContent = "";
    return;
  }
  elLocationLabel.textContent =
    "Location: " +
    Number(selectedLatitude).toFixed(5) +
    ", " +
    Number(selectedLongitude).toFixed(5);
}

function updatePlaceLabel() {
  if (!elPlaceLabel) return;
  if (selectedPlace && selectedPlace.name) {
    elPlaceLabel.textContent = "Place: " + selectedPlace.name;
    elPlaceLabel.hidden = false;
  } else {
    elPlaceLabel.textContent = "";
    elPlaceLabel.hidden = true;
  }
}

function formatDistance(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return "";
  const m = Number(meters);
  if (m < 1000) return Math.round(m) + " m";
  return (m / 1000).toFixed(1) + " km";
}

function restoreAddButton() {
  if (!elAddBtn) return;
  elAddBtn.innerHTML =
    '<span class="add-experience-icon">+</span><span>Add experience</span>';
}

async function identifyPlaces(lat, lon) {
  const url =
    API_BASE_URL +
    "/places/identify?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon);
  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Could not find nearby places.");
  const data = await response.json();
  return Array.isArray(data.candidates) ? data.candidates : [];
}

async function searchPlaces(query, lat, lon) {
  const url =
    API_BASE_URL +
    "/places/search?q=" +
    encodeURIComponent(query) +
    "&latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon);
  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Place search failed.");
  const data = await response.json();
  if (Array.isArray(data.candidates)) return data.candidates;
  if (Array.isArray(data)) return data;
  return [];
}

async function createOrReusePlace(candidate) {
  const response = await authenticatedFetch(API_BASE_URL + "/places/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: candidate.name || "Unnamed place",
      description: null,
      category: candidate.category || null,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      address: candidate.address || null,
      city: candidate.city || null,
      country: candidate.country || null,
      osm_type: candidate.osm_type || null,
      osm_id: candidate.osm_id != null ? String(candidate.osm_id) : null
    })
  });
  if (!response.ok) {
    console.error("Place create failed:", await response.text());
    throw new Error("Could not save place.");
  }
  return response.json();
}

function clearPlaceList() {
  if (elPlaceList) elPlaceList.innerHTML = "";
}

function renderPlaceCandidates(candidates) {
  clearPlaceList();
  if (!elPlaceList) return;

  if (!candidates.length) {
    const empty = document.createElement("p");
    empty.className = "step-help";
    empty.textContent =
      "No places found nearby. Search or continue without a place.";
    elPlaceList.appendChild(empty);
    return;
  }

  candidates.forEach(function (candidate) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-card place-candidate-card";

    const name = candidate.name || "Unnamed place";
    const meta = [candidate.category, formatDistance(candidate.distance)]
      .filter(Boolean)
      .join(" · ");

    const strong = document.createElement("strong");
    strong.textContent = name;
    const small = document.createElement("small");
    small.textContent = meta;
    const span = document.createElement("span");
    span.appendChild(strong);
    span.appendChild(small);
    btn.appendChild(span);

    btn.addEventListener("click", async function () {
      if (placeBusy) return;
      placeBusy = true;
      setStatus("Saving place…");
      try {
        const place = await createOrReusePlace(candidate);
        selectedPlace = place;
        selectedPlaceId = place.id;
        updatePlaceLabel();
        setStatus("");
        experienceFormStep = 2;
        updateStepUI();
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Could not save place.", true);
      } finally {
        placeBusy = false;
      }
    });

    elPlaceList.appendChild(btn);
  });
}

async function loadNearbyPlaces() {
  if (selectedLatitude == null || selectedLongitude == null) return;
  setPlaceStatus("Looking for nearby places…");
  clearPlaceList();
  try {
    const candidates = await identifyPlaces(selectedLatitude, selectedLongitude);
    setPlaceStatus(
      candidates.length
        ? "Choose a place, search, or continue without one."
        : "No nearby places found."
    );
    renderPlaceCandidates(candidates);
  } catch (error) {
    console.error(error);
    setPlaceStatus(error.message || "Could not load places.");
    clearPlaceList();
  }
}

function openExperienceForm() {
  if (!elFormOverlay) {
    console.error("experience-form-overlay not found");
    return;
  }
  elFormOverlay.classList.add("active");
  experienceFormStep = 1;
  updateStepUI();
  updateLocationLabel();
  updatePlaceLabel();
  setStatus("");
  loadNearbyPlaces();
}

function closeExperienceFormAndReset() {
  if (elFormOverlay) elFormOverlay.classList.remove("active");
  if (elExperienceForm) elExperienceForm.reset();

  selectedPlaceId = null;
  selectedPlace = null;
  selectedLatitude = null;
  selectedLongitude = null;
  isSelectingLocation = false;
  placeBusy = false;
  experienceFormStep = 1;

  clearPlaceList();
  setPlaceStatus("");
  setStatus("");
  updateStepUI();
  updateLocationLabel();
  updatePlaceLabel();
  restoreAddButton();

  try {
    if (typeof map !== "undefined" && map.getTargetElement()) {
      map.getTargetElement().style.cursor = "";
    }
  } catch (e) {}

  if (typeof unlockMainMap === "function") unlockMainMap();
  if (typeof updateAddExperienceButton === "function") {
    updateAddExperienceButton();
  }
}

function selectExperienceLocation(coordinate) {
  const lonLat = ol.proj.toLonLat(coordinate);
  selectedLongitude = lonLat[0];
  selectedLatitude = lonLat[1];

  isSelectingLocation = false;
  selectedPlaceId = null;
  selectedPlace = null;

  restoreAddButton();
  try {
    if (typeof map !== "undefined" && map.getTargetElement()) {
      map.getTargetElement().style.cursor = "";
    }
  } catch (e) {}

  updateLocationLabel();
  updatePlaceLabel();
  openExperienceForm();
}

window.selectExperienceLocation = selectExperienceLocation;
window.closeExperienceFormAndReset = closeExperienceFormAndReset;

// ---- Add experience ----
if (elAddBtn) {
  elAddBtn.addEventListener("click", function () {
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
      if (typeof openSignInModal === "function") openSignInModal();
      return;
    }

    isSelectingLocation = true;
    selectedPlaceId = null;
    selectedPlace = null;
    selectedLatitude = null;
    selectedLongitude = null;

    updateLocationLabel();
    updatePlaceLabel();
    setStatus("");

    elAddBtn.textContent = "Click a location on the map";
    try {
      if (typeof map !== "undefined" && map.getTargetElement()) {
        map.getTargetElement().style.cursor = "crosshair";
      }
    } catch (e) {}

    if (typeof closeSidebar === "function") closeSidebar();
  });
} else {
  console.error("add-experience-btn not found in DOM");
}

// ---- Place search / skip ----
if (elPlaceSearchBtn) {
  elPlaceSearchBtn.addEventListener("click", async function () {
    const q = elPlaceSearchInput ? elPlaceSearchInput.value.trim() : "";
    if (!q) {
      setPlaceStatus("Type a place name to search.");
      return;
    }
    if (selectedLatitude == null || selectedLongitude == null) return;

    setPlaceStatus("Searching…");
    try {
      const candidates = await searchPlaces(
        q,
        selectedLatitude,
        selectedLongitude
      );
      setPlaceStatus(
        candidates.length
          ? "Search results — pick one or continue without a place."
          : "No results."
      );
      renderPlaceCandidates(candidates);
    } catch (error) {
      console.error(error);
      setPlaceStatus(error.message || "Search failed.");
    }
  });
}

if (elPlaceSearchInput) {
  elPlaceSearchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (elPlaceSearchBtn) elPlaceSearchBtn.click();
    }
  });
}

if (elPlaceSkipBtn) {
  elPlaceSkipBtn.addEventListener("click", function () {
    selectedPlaceId = null;
    selectedPlace = null;
    updatePlaceLabel();
    experienceFormStep = 2;
    updateStepUI();
  });
}

// ---- Next / Back ----
if (elStepNext) {
  elStepNext.addEventListener("click", function () {
    setStatus("");

    if (experienceFormStep === 1) {
      experienceFormStep = 2;
      updateStepUI();
      return;
    }

    if (experienceFormStep === 2) {
      const title = (
        document.getElementById("experience-title") || {}
      ).value;
      const story = (
        document.getElementById("experience-description") || {}
      ).value;
      const emotion = (
        document.getElementById("experience-emotion") || {}
      ).value;

      if (!(title || "").trim() || !(story || "").trim() || !emotion) {
        setStatus("Please fill in title, story, and emotion.", true);
        return;
      }

      experienceFormStep = 3;
      updateStepUI();
      return;
    }

    if (experienceFormStep === 3) {
      experienceFormStep = 4;
      updateStepUI();
    }
  });
}

if (elStepBack) {
  elStepBack.addEventListener("click", function () {
    setStatus("");
    if (experienceFormStep > 1) {
      experienceFormStep -= 1;
      updateStepUI();
    }
  });
}

if (elCloseForm) {
  elCloseForm.addEventListener("click", closeExperienceFormAndReset);
}
if (elCancelForm) {
  elCancelForm.addEventListener("click", closeExperienceFormAndReset);
}
if (elFormOverlay) {
  elFormOverlay.addEventListener("click", function (event) {
    if (event.target === elFormOverlay) closeExperienceFormAndReset();
  });
}

// ---- Submit ----
if (elExperienceForm) {
  elExperienceForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("");

    if (experienceFormStep !== 4) {
      setStatus("Please complete all steps first.", true);
      return;
    }
    if (selectedLatitude == null || selectedLongitude == null) {
      setStatus("Please select a location on the map first.", true);
      return;
    }
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
      if (typeof openSignInModal === "function") openSignInModal();
      return;
    }

    const title = (
      document.getElementById("experience-title").value || ""
    ).trim();
    const story = (
      document.getElementById("experience-description").value || ""
    ).trim();
    const emotion = document.getElementById("experience-emotion").value || "";
    const visibilityEl = document.querySelector(
      'input[name="visibility"]:checked'
    );
    const anonymousEl = document.querySelector(
      'input[name="is_anonymous"]:checked'
    );

    if (!title || !story || !emotion) {
      setStatus("Please fill in title, story, and emotion.", true);
      experienceFormStep = 2;
      updateStepUI();
      return;
    }

    const payload = {
      place_id: selectedPlaceId,
      title: title,
      story: story,
      emotion: emotion,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      visibility: visibilityEl ? visibilityEl.value : "public",
      is_anonymous: anonymousEl ? anonymousEl.value === "true" : false
    };

    if (elSubmitBtn) elSubmitBtn.disabled = true;
    setStatus("Saving experience…");

    try {
      const response = await authenticatedFetch(
        API_BASE_URL + "/experiences/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        console.error("Experience create failed:", await response.text());
        throw new Error("Could not save this experience.");
      }

      const result = await response.json();
      const createdId = result && result.id;
      const files =
        elMediaInput && elMediaInput.files
          ? Array.from(elMediaInput.files)
          : [];

      if (createdId && files.length) {
        for (let i = 0; i < files.length; i++) {
          const formData = new FormData();
          formData.append("file", files[i]);
          try {
            await authenticatedFetch(
              API_BASE_URL + "/experiences/" + createdId + "/media",
              { method: "POST", body: formData }
            );
          } catch (uploadError) {
            console.error(uploadError);
          }
        }
      }

      closeExperienceFormAndReset();
      if (typeof loadExperiences === "function") {
        await loadExperiences();
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not save this experience.", true);
    } finally {
      if (elSubmitBtn) elSubmitBtn.disabled = false;
    }
  });
}

updateStepUI();
