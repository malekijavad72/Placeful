// ============================================================
// PLACEFUL — place sidebar
// Depends on: api.js, map.js, experience-sidebar.js (optional)
// ============================================================

const placeSidebar = document.getElementById("place-sidebar");
const placeSidebarClose = document.getElementById("place-sidebar-close");
const placeSidebarTitle = document.getElementById("place-sidebar-title");
const placeSidebarCategory = document.getElementById("place-sidebar-category");
const placeSidebarLocation = document.getElementById("place-sidebar-location");
const placeSidebarExperienceCount = document.getElementById(
  "place-sidebar-experience-count"
);
const placeSidebarExperiences = document.getElementById(
  "place-sidebar-experiences"
);

// ----------------------------------------------------------
// OPEN
// ----------------------------------------------------------

function openPlaceSidebar(placeFeature) {
  if (!placeSidebar || !placeFeature) {
    return;
  }

  const placeId = placeFeature.get("id");
  const name = placeFeature.get("name");
  const category = placeFeature.get("category");
  const address = placeFeature.get("address");
  const city = placeFeature.get("city");
  const country = placeFeature.get("country");
  const experienceCount = placeFeature.get("experience_count");

  placeSidebar.dataset.placeId = String(placeId);

  if (placeSidebarTitle) {
    placeSidebarTitle.textContent = name || "Place";
  }

  if (placeSidebarCategory) {
    if (category) {
      placeSidebarCategory.textContent = category;
      placeSidebarCategory.hidden = false;
    } else {
      placeSidebarCategory.textContent = "";
      placeSidebarCategory.hidden = true;
    }
  }

  if (placeSidebarLocation) {
    const locationParts = [];
    if (address) locationParts.push(address);
    if (city) locationParts.push(city);
    if (country) locationParts.push(country);

    if (locationParts.length) {
      placeSidebarLocation.textContent = locationParts.join(", ");
      placeSidebarLocation.hidden = false;
    } else {
      placeSidebarLocation.textContent = "";
      placeSidebarLocation.hidden = true;
    }
  }

  if (placeSidebarExperienceCount) {
    placeSidebarExperienceCount.textContent = experienceCount || 0;
  }

  placeSidebar.classList.add("open");
  placeSidebar.setAttribute("aria-hidden", "false");

  loadPlaceExperiences(placeId);

  if (typeof map !== "undefined") {
    map.updateSize();
  }
}

// ----------------------------------------------------------
// CLOSE
// ----------------------------------------------------------

function closePlaceSidebar() {
  if (!placeSidebar) {
    return;
  }

  if (placeSidebar.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  placeSidebar.classList.remove("open");
  placeSidebar.setAttribute("aria-hidden", "true");
  delete placeSidebar.dataset.placeId;

  if (typeof map !== "undefined") {
    map.updateSize();
  }
}

// ----------------------------------------------------------
// BUILD ONE EXPERIENCE ROW
// Layout: [avatar]  display name  @username
//                   title
//                   story
// ----------------------------------------------------------

function createPlaceExperienceItem(feature) {
  const item = document.createElement("div");
  item.className = "place-experience-item";
  item.setAttribute("role", "button");
  item.setAttribute("tabindex", "0");

  const displayName = feature.get("display_name") || "Unknown user";
  const profileImageUrl = feature.get("profile_image_url") || "";
  const title = feature.get("title") || "Untitled Experience";
  const story = feature.get("story") || "";
  const userId = feature.get("user_id");
  const username = feature.get("username") || "";

  const content = document.createElement("div");
  content.className = "place-experience-content";

  // Avatar (image or initial)
  const avatar = document.createElement("div");
  avatar.className = "place-experience-avatar";
  avatar.setAttribute("aria-hidden", "true");

  if (profileImageUrl) {
    avatar.style.backgroundImage = 'url("' + profileImageUrl + '")';
    avatar.textContent = "";
  } else {
    avatar.textContent = (displayName.charAt(0) || "?").toUpperCase();
  }

  // Text column
  const textContainer = document.createElement("div");
  textContainer.className = "place-experience-text";

  const authorRow = document.createElement("div");
  authorRow.className = "place-experience-author";

  const displayNameEl = document.createElement("span");
  displayNameEl.className = "place-experience-display-name";
  displayNameEl.textContent = displayName;
  authorRow.appendChild(displayNameEl);

  if (username && userId) {
    const usernameBtn = document.createElement("button");
    usernameBtn.type = "button";
    usernameBtn.className = "place-experience-username";
    usernameBtn.textContent = "@" + username;

    usernameBtn.addEventListener("click", function (event) {
      event.stopPropagation();

      if (placeSidebar && placeSidebar.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      closePlaceSidebar();

      if (typeof openUserProfile === "function") {
        openUserProfile(userId);
      }
    });

    authorRow.appendChild(usernameBtn);
  }

  const titleEl = document.createElement("div");
  titleEl.className = "place-experience-title";
  titleEl.textContent = title;

  textContainer.appendChild(authorRow);
  textContainer.appendChild(titleEl);

  if (story) {
    const storyEl = document.createElement("div");
    storyEl.className = "place-experience-story";
    storyEl.textContent = story;
    textContainer.appendChild(storyEl);
  }

  content.appendChild(avatar);
  content.appendChild(textContainer);
  item.appendChild(content);

  function openThisExperience() {
    if (placeSidebar && placeSidebar.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    closePlaceSidebar();

    if (typeof closeProfileSidebar === "function") {
      closeProfileSidebar();
    }

    const experienceId = feature.get("id");

    if (typeof focusExperienceOnMap === "function" && experienceId) {
      focusExperienceOnMap(experienceId, feature);
      return;
    }

    if (typeof openExperienceSidebar === "function") {
      openExperienceSidebar(feature);
    }
  }

  item.addEventListener("click", openThisExperience);

  item.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openThisExperience();
    }
  });

  return item;
}

// ----------------------------------------------------------
// LOAD PLACE EXPERIENCES
// ----------------------------------------------------------

async function loadPlaceExperiences(placeId) {
  if (!placeSidebarExperiences) {
    return;
  }

  placeSidebarExperiences.innerHTML = "";

  const loading = document.createElement("div");
  loading.className = "comments-message";
  loading.textContent = "Loading experiences...";
  placeSidebarExperiences.appendChild(loading);

  try {
    const response = await apiFetch(
      API_BASE_URL + "/places/" + placeId + "/experiences"
    );

    if (!response.ok) {
      throw new Error("HTTP error: " + response.status);
    }

    const geojson = await response.json();
    const features = new ol.format.GeoJSON().readFeatures(geojson, {
      featureProjection: "EPSG:3857",
    });

    placeSidebarExperiences.innerHTML = "";

    if (!features.length) {
      const empty = document.createElement("div");
      empty.className = "comments-message";
      empty.textContent = "No experiences yet.";
      placeSidebarExperiences.appendChild(empty);
      return;
    }

    features.forEach(function (feature) {
      placeSidebarExperiences.appendChild(
        createPlaceExperienceItem(feature)
      );
    });
  } catch (error) {
    console.error("Failed to load place experiences:", error);

    placeSidebarExperiences.innerHTML = "";

    const errorElement = document.createElement("div");
    errorElement.className = "comments-message comments-error";
    errorElement.textContent = "Unable to load experiences.";
    placeSidebarExperiences.appendChild(errorElement);
  }
}

// ----------------------------------------------------------
// CLOSE BUTTON
// ----------------------------------------------------------

if (placeSidebarClose) {
  placeSidebarClose.addEventListener("click", closePlaceSidebar);
}

// ----------------------------------------------------------
// GLOBAL
// ----------------------------------------------------------

window.openPlaceSidebar = openPlaceSidebar;
window.closePlaceSidebar = closePlaceSidebar;