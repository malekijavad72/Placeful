// ============================================================
// PLACEFUL — profile page (view + edit)
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000/api";

const profileLoading = document.getElementById("profile-loading");
const profileError = document.getElementById("profile-error");
const profileContent = document.getElementById("profile-content");
const profileAvatar = document.getElementById("profile-avatar");
const profileDisplayName = document.getElementById("profile-display-name");
const profileUsername = document.getElementById("profile-username");
const profileBio = document.getElementById("profile-bio");
const profileEmail = document.getElementById("profile-email");
const profileEditBtn = document.getElementById("profile-edit-btn");
const profileEditForm = document.getElementById("profile-edit-form");
const profileEditCancel = document.getElementById("profile-edit-cancel");
const profileEditStatus = document.getElementById("profile-edit-status");
const editDisplayName = document.getElementById("edit-display-name");
const editBio = document.getElementById("edit-bio");
const editProfileImage = document.getElementById("edit-profile-image");

let currentUser = null;
let isOwnProfile = false;

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function isLoggedIn() {
  return Boolean(getAccessToken());
}

function getCurrentUserId() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ? String(payload.sub) : null;
  } catch (error) {
    return localStorage.getItem("logged_in_user_id");
  }
}

async function apiGet(path) {
  return fetch(API_BASE_URL + path);
}

async function apiAuth(path, options) {
  options = options || {};
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const headers = Object.assign({}, options.headers || {}, {
    Authorization: "Bearer " + token
  });
  return fetch(API_BASE_URL + path, Object.assign({}, options, { headers: headers }));
}

function showLoading() {
  if (profileLoading) profileLoading.hidden = false;
  if (profileError) profileError.hidden = true;
  if (profileContent) profileContent.hidden = true;
}

function showError(message) {
  if (profileLoading) profileLoading.hidden = true;
  if (profileError) {
    profileError.hidden = false;
    profileError.textContent = message || "Could not load this profile.";
  }
  if (profileContent) profileContent.hidden = true;
}

function showContent() {
  if (profileLoading) profileLoading.hidden = true;
  if (profileError) profileError.hidden = true;
  if (profileContent) profileContent.hidden = false;
}

function renderUser(user) {
  currentUser = user;
  const myId = getCurrentUserId();
  isOwnProfile = Boolean(myId && String(user.id) === String(myId));

  const name = user.display_name || user.username || "User";
  profileDisplayName.textContent = name;
  profileUsername.textContent = user.username ? "@" + user.username : "";
  profileBio.textContent = user.bio || "";

  if (isOwnProfile && user.email) {
    profileEmail.hidden = false;
    profileEmail.textContent = user.email;
  } else {
    profileEmail.hidden = true;
    profileEmail.textContent = "";
  }

  if (user.profile_image_url) {
    profileAvatar.style.backgroundImage = 'url("' + user.profile_image_url + '")';
    profileAvatar.textContent = "";
  } else {
    profileAvatar.style.backgroundImage = "";
    profileAvatar.textContent = (name.charAt(0) || "P").toUpperCase();
  }

  if (profileEditBtn) {
    profileEditBtn.hidden = !isOwnProfile;
  }
  if (profileEditForm) {
    profileEditForm.hidden = true;
  }

  document.title = name + " — Placeful";
  showContent();
}

function getProfileTargetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (id) return { type: "id", value: id };
  return { type: "me" };
}

async function loadProfile() {
  showLoading();
  const target = getProfileTargetFromUrl();

  try {
    let user;

    if (target.type === "me") {
      if (!isLoggedIn()) {
        showError("Sign in to view your profile.");
        if (typeof openSignInModal === "function") {
          openSignInModal();
        }
        return;
      }
      const res = await apiAuth("/users/me");
      if (!res.ok) throw new Error("Could not load your profile.");
      user = await res.json();
    } else {
      const res = await apiGet("/users/" + target.value);
      if (res.status === 404) {
        showError("User not found.");
        return;
      }
      if (!res.ok) throw new Error("Could not load this profile.");
      user = await res.json();
    }

    renderUser(user);
  } catch (error) {
    console.error(error);
    showError(error.message || "Could not load this profile.");
  }
}

function openEditForm() {
  if (!currentUser || !isOwnProfile) return;
  profileEditForm.hidden = false;
  editDisplayName.value = currentUser.display_name || "";
  editBio.value = currentUser.bio || "";
  editProfileImage.value = currentUser.profile_image_url || "";
  profileEditStatus.textContent = "";
  profileEditStatus.classList.remove("is-success");
  editDisplayName.focus();
}

function closeEditForm() {
  profileEditForm.hidden = true;
  profileEditStatus.textContent = "";
  profileEditStatus.classList.remove("is-success");
}

async function saveProfile(event) {
  event.preventDefault();
  if (!isOwnProfile) return;

  const payload = {
    display_name: editDisplayName.value.trim() || null,
    bio: editBio.value.trim() || null,
    profile_image_url: editProfileImage.value.trim() || null
  };

  profileEditStatus.textContent = "Saving…";
  profileEditStatus.classList.remove("is-success");

  try {
    const res = await apiAuth("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const detail = data.detail;
      throw new Error(
        typeof detail === "string" ? detail : "Could not update profile."
      );
    }

    renderUser(data);
    profileEditForm.hidden = true;
    profileEditStatus.textContent = "Saved.";
    profileEditStatus.classList.add("is-success");

    if (data.username) {
      localStorage.setItem("logged_in_username", data.username);
    }
    if (typeof updateAuthenticationUI === "function") {
      updateAuthenticationUI();
    }
  } catch (error) {
    profileEditStatus.textContent = error.message || "Save failed.";
    profileEditStatus.classList.remove("is-success");
  }
}

if (profileEditBtn) {
  profileEditBtn.addEventListener("click", openEditForm);
}

if (profileEditCancel) {
  profileEditCancel.addEventListener("click", closeEditForm);
}

if (profileEditForm) {
  profileEditForm.addEventListener("submit", saveProfile);
}

// After login on this page, reload profile
window.addEventListener("placeful-auth-changed", function () {
  loadProfile();
});

document.addEventListener("DOMContentLoaded", loadProfile);
