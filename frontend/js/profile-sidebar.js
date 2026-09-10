// ============================================================
// PLACEFUL — profile sidebar (same page as map)
// ============================================================

const profileSidebar = document.getElementById("profile-sidebar");
const profileSidebarClose = document.getElementById("profile-sidebar-close");
const profileLoading = document.getElementById("profile-sidebar-loading");
const profileError = document.getElementById("profile-sidebar-error");
const profileContent = document.getElementById("profile-sidebar-content");

const psAvatar = document.getElementById("ps-avatar");
const psDisplayName = document.getElementById("ps-display-name");
const psUsername = document.getElementById("ps-username");
const psBio = document.getElementById("ps-bio");
const psExpCount = document.getElementById("ps-exp-count");
const psFollowersCount = document.getElementById("ps-followers-count");
const psFollowingCount = document.getElementById("ps-following-count");
const psExperiencesBtn = document.getElementById("ps-experiences-btn");
const psExperiencesPanel = document.getElementById("ps-experiences-panel");
const psFollowersBtn = document.getElementById("ps-followers-btn");
const psFollowingBtn = document.getElementById("ps-following-btn");
const psFollowBtn = document.getElementById("ps-follow-btn");
const psEditBtn = document.getElementById("ps-edit-btn");
const psEditForm = document.getElementById("ps-edit-form");
const psEditCancel = document.getElementById("ps-edit-cancel");
const psEditStatus = document.getElementById("ps-edit-status");
const psExperienceList = document.getElementById("ps-experience-list");
const psFollowListSection = document.getElementById("ps-follow-list-section");
const psFollowListTitle = document.getElementById("ps-follow-list-title");
const psFollowList = document.getElementById("ps-follow-list");
const myProfileBtn = document.getElementById("my-profile-btn");
const profileMiniMapEl = document.getElementById("profile-mini-map");

// API helpers from api.js: API_BASE_URL, getAccessToken, isLoggedIn,
// getCurrentUserId, authenticatedFetch, apiFetch

let currentProfileUser = null;
let currentProfileFollowing = false;
let profileUserExperiences = [];
let profileMiniMap = null;
let profileMiniSource = null;

function authFetch(path, options) {
  return authenticatedFetch(API_BASE_URL + path, options || {});
}

function openProfileSidebar() {
  if (!profileSidebar) return;
  if (typeof closeSidebar === "function") closeSidebar();
  if (typeof closeMediaViewer === "function") closeMediaViewer();
  profileSidebar.classList.add("open");
  profileSidebar.setAttribute("aria-hidden", "false");
  document.body.classList.add("profile-sidebar-open");
}

function closeProfileSidebar() {
  if (!profileSidebar) return;
  profileSidebar.classList.remove("open");
  profileSidebar.setAttribute("aria-hidden", "true");
  document.body.classList.remove("profile-sidebar-open");
  if (psEditForm) psEditForm.hidden = true;
  if (psFollowListSection) psFollowListSection.hidden = true;
}

function setProfileLoading() {
  if (profileLoading) profileLoading.hidden = false;
  if (profileError) profileError.hidden = true;
  if (profileContent) profileContent.hidden = true;
}

function setProfileError(msg) {
  if (profileLoading) profileLoading.hidden = true;
  if (profileError) {
    profileError.hidden = false;
    profileError.textContent = msg || "Could not load profile.";
  }
  if (profileContent) profileContent.hidden = true;
}

function setProfileReady() {
  if (profileLoading) profileLoading.hidden = true;
  if (profileError) profileError.hidden = true;
  if (profileContent) profileContent.hidden = false;
}

function emotionEmoji(slug) {
  const map = {
    happy: "😊",
    sad: "😢",
    peaceful: "😌",
    excited: "🤩",
    nostalgic: "🥹",
    love: "❤️"
  };
  return map[slug] || "📍";
}

function getExperiencesForUser(userId) {
  const features = [];
  if (typeof vectorSource === "undefined" || !vectorSource) {
    return features;
  }
  vectorSource.getFeatures().forEach(function (feature) {
    const fid = feature.get("user_id");
    if (fid && String(fid) === String(userId) && !feature.get("is_anonymous")) {
      features.push(feature);
    }
  });
  return features;
}


function setProfileTab(tab) {
  const buttons = [psExperiencesBtn, psFollowersBtn, psFollowingBtn];
  buttons.forEach(function (btn) {
    if (btn) btn.classList.remove("active");
  });

  if (tab === "experiences") {
    if (psExperiencesBtn) psExperiencesBtn.classList.add("active");
    if (psExperiencesPanel) psExperiencesPanel.hidden = false;
    if (psFollowListSection) psFollowListSection.hidden = true;
    if (profileMiniMap) {
      setTimeout(function () {
        profileMiniMap.updateSize();
        updateMiniMap(profileUserExperiences);
      }, 50);
    }
  } else {
    if (tab === "followers" && psFollowersBtn) psFollowersBtn.classList.add("active");
    if (tab === "following" && psFollowingBtn) psFollowingBtn.classList.add("active");
    if (psExperiencesPanel) psExperiencesPanel.hidden = true;
    if (psFollowListSection) psFollowListSection.hidden = false;
  }
}

function renderExperienceList(features) {
  if (!psExperienceList) return;
  psExperienceList.innerHTML = "";

  if (!features.length) {
    const empty = document.createElement("div");
    empty.className = "comments-message";
    empty.textContent = "No public experiences yet.";
    psExperienceList.appendChild(empty);
    return;
  }

  features.forEach(function (feature) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ps-experience-item";

    const emotion = feature.get("emotion");
    const title = feature.get("title") || "Untitled";
    const story = feature.get("story") || "";
    const preview = story.length > 90 ? story.slice(0, 90) + "…" : story;

    btn.innerHTML =
      '<span class="ps-exp-emoji">' +
      emotionEmoji(emotion) +
      '</span><span class="ps-exp-text"><strong>' +
      title +
      "</strong><span>" +
      preview +
      "</span></span>";

    btn.addEventListener("click", function () {
      const id = feature.get("id");
      if (typeof focusExperienceOnMap === "function") {
        focusExperienceOnMap(id);
      }
    });

    psExperienceList.appendChild(btn);
  });
}

function ensureMiniMap() {
  if (!profileMiniMapEl || typeof ol === "undefined") return;

  if (!profileMiniMap) {
    profileMiniSource = new ol.source.Vector();
    profileMiniMap = new ol.Map({
      target: profileMiniMapEl,
      layers: [
        new ol.layer.Tile({ source: new ol.source.OSM() }),
        new ol.layer.Vector({
          source: profileMiniSource,
          style: function (feature) {
            const emotion = feature.get("emotion");
            const emoji = emotionEmoji(emotion);
            return new ol.style.Style({
              text: new ol.style.Text({
                text: emoji,
                font: "20px Arial",
                textAlign: "center",
                textBaseline: "middle",
                stroke: new ol.style.Stroke({
                  color: "rgba(255,255,255,0.9)",
                  width: 2
                })
              })
            });
          }
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([45.0783, 37.5497]),
        zoom: 11
      }),
      controls: []
    });

    profileMiniMap.on("singleclick", function (event) {
      const feature = profileMiniMap.forEachFeatureAtPixel(
        event.pixel,
        function (f) {
          return f;
        }
      );
      if (feature && typeof focusExperienceOnMap === "function") {
        focusExperienceOnMap(feature.get("id"));
      }
    });
  }

  // refresh size after becoming visible
  setTimeout(function () {
    if (profileMiniMap) profileMiniMap.updateSize();
  }, 50);
}

function updateMiniMap(features) {
  ensureMiniMap();
  if (!profileMiniSource || !profileMiniMap) return;

  profileMiniSource.clear();

  const clones = features.map(function (feature) {
    return feature.clone();
  });
  profileMiniSource.addFeatures(clones);

  // Size must be correct before fit, or extent calculation looks wrong
  profileMiniMap.updateSize();

  if (clones.length > 0) {
    const extent = profileMiniSource.getExtent();
    if (extent && extent.every(function (v) { return isFinite(v); })) {
      profileMiniMap.getView().fit(extent, {
        padding: [28, 28, 28, 28],
        maxZoom: clones.length === 1 ? 15 : 13,
        minZoom: 2,
        duration: 250,
        nearest: true
      });
    }
  }

  setTimeout(function () {
    profileMiniMap.updateSize();
    if (clones.length > 0) {
      const extent = profileMiniSource.getExtent();
      if (extent && extent.every(function (v) { return isFinite(v); })) {
        profileMiniMap.getView().fit(extent, {
          padding: [28, 28, 28, 28],
          maxZoom: clones.length === 1 ? 15 : 13,
          duration: 0
        });
      }
    }
  }, 120);
}

function renderProfileUser(user) {
  currentProfileUser = user;
  const myId = getCurrentUserId();
  const isSelf = myId && String(user.id) === String(myId);
  const name = user.display_name || user.username || "User";

  psDisplayName.textContent = name;
  psUsername.textContent = user.username ? "@" + user.username : "";
  psBio.textContent = user.bio || "";

  if (user.profile_image_url) {
    psAvatar.style.backgroundImage = 'url("' + user.profile_image_url + '")';
    psAvatar.textContent = "";
  } else {
    psAvatar.style.backgroundImage = "";
    psAvatar.textContent = (name.charAt(0) || "P").toUpperCase();
  }

  if (psEditBtn) psEditBtn.hidden = !isSelf;
  if (psFollowBtn) {
    psFollowBtn.hidden = !isLoggedIn() || Boolean(isSelf);
  }
  if (psEditForm) psEditForm.hidden = true;
  if (psFollowListSection) psFollowListSection.hidden = true;
}

async function loadFollowCounts(userId) {
  try {
    const [followersRes, followingRes] = await Promise.all([
      apiFetch(API_BASE_URL + "/users/" + userId + "/followers"),
      apiFetch(API_BASE_URL + "/users/" + userId + "/following")
    ]);
    const followers = followersRes.ok ? await followersRes.json() : [];
    const following = followingRes.ok ? await followingRes.json() : [];
    psFollowersCount.textContent = Array.isArray(followers) ? followers.length : "—";
    psFollowingCount.textContent = Array.isArray(following) ? following.length : "—";
  } catch (e) {
    psFollowersCount.textContent = "—";
    psFollowingCount.textContent = "—";
  }
}

async function loadFollowButton(userId) {
  if (!psFollowBtn || psFollowBtn.hidden) return;
  try {
    const res = await authFetch("/users/" + userId + "/follow-status");
    if (!res.ok) return;
    const data = await res.json();
    currentProfileFollowing = Boolean(data.following);
    psFollowBtn.textContent = currentProfileFollowing ? "Following" : "Follow";
    psFollowBtn.classList.toggle("auth-btn-primary", !currentProfileFollowing);
  } catch (e) {
    psFollowBtn.textContent = "Follow";
  }
}

async function openUserProfile(userId) {
  if (!userId) return;
  openProfileSidebar();
  setProfileLoading();

  try {
    let user;
    const myId = getCurrentUserId();
    if (myId && String(userId) === String(myId) && isLoggedIn()) {
      const res = await authFetch("/users/me");
      if (!res.ok) throw new Error("Could not load profile");
      user = await res.json();
    } else {
      const res = await apiFetch(API_BASE_URL + "/users/" + userId);
      if (!res.ok) throw new Error("User not found");
      user = await res.json();
    }

    renderProfileUser(user);

    profileUserExperiences = getExperiencesForUser(user.id);
    psExpCount.textContent = String(profileUserExperiences.length);
    renderExperienceList(profileUserExperiences);
    updateMiniMap(profileUserExperiences);

    await loadFollowCounts(user.id);
    await loadFollowButton(user.id);
    setProfileTab("experiences");
    setProfileReady();
  } catch (error) {
    console.error(error);
    setProfileError(error.message || "Could not load profile.");
  }
}

async function openMyProfile() {
  if (!isLoggedIn()) {
    if (typeof openSignInModal === "function") openSignInModal();
    return;
  }
  const id = getCurrentUserId();
  if (id) {
    await openUserProfile(id);
  }
}

async function renderFollowList(kind) {
  if (!currentProfileUser) return;
  const userId = currentProfileUser.id;
  try {
    const res = await apiFetch(
      API_BASE_URL +
        "/users/" +
        userId +
        (kind === "followers" ? "/followers" : "/following")
    );
    if (!res.ok) throw new Error("Could not load list");
    const users = await res.json();
    psFollowListSection.hidden = false;
    psFollowListTitle.textContent = kind === "followers" ? "Followers" : "Following";
    psFollowList.innerHTML = "";

    if (!users.length) {
      psFollowList.innerHTML =
        '<div class="comments-message">No users yet.</div>';
      return;
    }

    users.forEach(function (user) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ps-follow-row";
      const label = user.display_name || user.username || "User";
      const initial = (label.charAt(0) || "?").toUpperCase();
      const img = user.profile_image_url
        ? '<span class="ps-follow-avatar" style="background-image:url(\'' + user.profile_image_url + '\')"></span>'
        : '<span class="ps-follow-avatar">' + initial + "</span>";
      row.innerHTML =
        img +
        '<span class="ps-follow-meta"><strong>' +
        label +
        '</strong><span>@' +
        (user.username || "") +
        "</span></span>";
      row.addEventListener("click", function () {
        openUserProfile(user.id);
      });
      psFollowList.appendChild(row);
    });
  } catch (error) {
    alert(error.message || "Could not load list");
  }
}

if (profileSidebarClose) {
  profileSidebarClose.addEventListener("click", closeProfileSidebar);
}

if (myProfileBtn) {
  myProfileBtn.addEventListener("click", openMyProfile);
}

if (psFollowBtn) {
  psFollowBtn.addEventListener("click", async function () {
    if (!currentProfileUser || !isLoggedIn()) return;
    try {
      if (currentProfileFollowing) {
        await authFetch("/users/" + currentProfileUser.id + "/follow", {
          method: "DELETE"
        });
      } else {
        await authFetch("/users/" + currentProfileUser.id + "/follow", {
          method: "POST"
        });
      }
      await loadFollowButton(currentProfileUser.id);
      await loadFollowCounts(currentProfileUser.id);
    } catch (error) {
      alert(error.message || "Follow action failed");
    }
  });
}

if (psExperiencesBtn) {
  psExperiencesBtn.addEventListener("click", function () {
    setProfileTab("experiences");
  });
}

if (psFollowersBtn) {
  psFollowersBtn.addEventListener("click", async function () {
    setProfileTab("followers");
    await renderFollowList("followers");
  });
}

if (psFollowingBtn) {
  psFollowingBtn.addEventListener("click", async function () {
    setProfileTab("following");
    await renderFollowList("following");
  });
}

if (psEditBtn) {
  psEditBtn.addEventListener("click", function () {
    if (!currentProfileUser) return;
    psEditForm.hidden = false;
    document.getElementById("ps-edit-display-name").value =
      currentProfileUser.display_name || "";
    document.getElementById("ps-edit-bio").value = currentProfileUser.bio || "";
    document.getElementById("ps-edit-image").value =
      currentProfileUser.profile_image_url || "";
    psEditStatus.textContent = "";
  });
}

if (psEditCancel) {
  psEditCancel.addEventListener("click", function () {
    psEditForm.hidden = true;
  });
}

if (psEditForm) {
  psEditForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = {
      display_name:
        document.getElementById("ps-edit-display-name").value.trim() || null,
      bio: document.getElementById("ps-edit-bio").value.trim() || null,
      profile_image_url:
        document.getElementById("ps-edit-image").value.trim() || null
    };
    psEditStatus.textContent = "Saving…";
    try {
      const res = await authFetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Save failed"
        );
      }
      renderProfileUser(data);
      psEditForm.hidden = true;
      psEditStatus.textContent = "";
      if (data.username) {
        localStorage.setItem("logged_in_username", data.username);
      }
      if (typeof updateAuthenticationUI === "function") {
        updateAuthenticationUI();
      }
    } catch (error) {
      psEditStatus.textContent = error.message || "Save failed";
    }
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && profileSidebar && profileSidebar.classList.contains("open")) {
    closeProfileSidebar();
  }
});

window.openUserProfile = openUserProfile;
window.openMyProfile = openMyProfile;
window.closeProfileSidebar = closeProfileSidebar;
