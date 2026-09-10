// ============================================================
// PLACEFUL — authentication UI (sign in, sign up, header menu)
// Depends on: api.js
// ============================================================

const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");
const userMenu = document.getElementById("user-menu");

const headerAvatarBtn = document.getElementById("header-avatar-btn");
const headerAvatar = document.getElementById("header-avatar");
const accountDropdown = document.getElementById("account-dropdown");
const dropdownAvatar = document.getElementById("dropdown-avatar");
const dropdownDisplayName = document.getElementById("dropdown-display-name");
const dropdownEmail = document.getElementById("dropdown-email");
const dropdownViewProfile = document.getElementById("dropdown-view-profile");
const dropdownNotifications = document.getElementById("dropdown-notifications");
const dropdownNotifCount = document.getElementById("dropdown-notif-count");
const dropdownSignOut = document.getElementById("dropdown-sign-out");

// ----------------------------------------------------------
// SIGN IN MODAL
// ----------------------------------------------------------

function createSignInModal() {
  if (document.getElementById("sign-in-modal")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "sign-in-modal";
  modal.className = "auth-modal-overlay";

  modal.innerHTML =
    '<div class="auth-modal">' +
    '<button id="close-sign-in" class="auth-modal-close" type="button" aria-label="Close">×</button>' +
    "<h2>Sign In</h2>" +
    '<p class="auth-modal-description">Sign in to share and manage your experiences.</p>' +
    '<form id="sign-in-form">' +
    '<div class="auth-form-group">' +
    '<label for="sign-in-username">Username</label>' +
    '<input type="text" id="sign-in-username" name="username" autocomplete="username" required>' +
    "</div>" +
    '<div class="auth-form-group">' +
    '<label for="sign-in-password">Password</label>' +
    '<input type="password" id="sign-in-password" name="password" autocomplete="current-password" required>' +
    "</div>" +
    '<div id="sign-in-error" class="auth-error" style="display: none;"></div>' +
    '<button id="submit-sign-in" class="auth-submit-btn" type="submit">Sign In</button>' +
    "</form>" +
    '<p class="auth-modal-switch">No account? ' +
    '<button type="button" id="switch-to-sign-up" class="auth-link-btn">Sign up</button></p>' +
    "</div>";

  document.body.appendChild(modal);

  document.getElementById("close-sign-in").addEventListener("click", closeSignInModal);
  document.getElementById("sign-in-form").addEventListener("submit", handleSignIn);
  document.getElementById("switch-to-sign-up").addEventListener("click", function () {
    closeSignInModal();
    openSignUpModal();
  });

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeSignInModal();
    }
  });
}

function openSignInModal() {
  createSignInModal();
  const modal = document.getElementById("sign-in-modal");
  if (modal) {
    modal.classList.add("active");
    modal.classList.add("visible");
  }
  const input = document.getElementById("sign-in-username");
  if (input) {
    input.focus();
  }
}

function closeSignInModal() {
  const modal = document.getElementById("sign-in-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.classList.remove("visible");
  }
}

async function handleSignIn(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("sign-in-username");
  const passwordInput = document.getElementById("sign-in-password");
  const errorEl = document.getElementById("sign-in-error");
  const submitBtn = document.getElementById("submit-sign-in");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  errorEl.style.display = "none";
  errorEl.textContent = "";
  submitBtn.disabled = true;

  try {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const response = await fetch(API_BASE_URL + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Incorrect username or password"
      );
    }

    if (!data.access_token) {
      throw new Error("Login response missing access token.");
    }

    setAuthTokens(data.access_token, data.refresh_token, username);

    closeSignInModal();
    updateAuthenticationUI();
    if (typeof loadExperiences === "function") {
      loadExperiences();
    }
    console.log("Successfully signed in.");
  } catch (error) {
    console.error("Sign in error:", error);
    errorEl.textContent = error.message || "Could not sign in.";
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
  }
}

// ----------------------------------------------------------
// SIGN UP MODAL
// ----------------------------------------------------------

function createSignUpModal() {
  if (document.getElementById("sign-up-modal")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "sign-up-modal";
  modal.className = "auth-modal-overlay";

  modal.innerHTML =
    '<div class="auth-modal">' +
    '<button id="close-sign-up" class="auth-modal-close" type="button" aria-label="Close">×</button>' +
    "<h2>Sign Up</h2>" +
    '<p class="auth-modal-description">Create an account to share places and experiences.</p>' +
    '<form id="sign-up-form">' +
    '<div class="auth-form-group">' +
    '<label for="sign-up-username">Username</label>' +
    '<input type="text" id="sign-up-username" name="username" autocomplete="username" required minlength="3" maxlength="50">' +
    "</div>" +
    '<div class="auth-form-group">' +
    '<label for="sign-up-email">Email</label>' +
    '<input type="email" id="sign-up-email" name="email" autocomplete="email" required>' +
    "</div>" +
    '<div class="auth-form-group">' +
    '<label for="sign-up-password">Password (min 8 chars, letter + number)</label>' +
    '<input type="password" id="sign-up-password" name="password" autocomplete="new-password" required minlength="8">' +
    "</div>" +
    '<div id="sign-up-error" class="auth-error" style="display: none;"></div>' +
    '<button id="submit-sign-up" class="auth-submit-btn" type="submit">Create account</button>' +
    "</form>" +
    '<p class="auth-modal-switch">Already have an account? ' +
    '<button type="button" id="switch-to-sign-in" class="auth-link-btn">Sign in</button></p>' +
    "</div>";

  document.body.appendChild(modal);

  document.getElementById("close-sign-up").addEventListener("click", closeSignUpModal);
  document.getElementById("sign-up-form").addEventListener("submit", handleSignUp);
  document.getElementById("switch-to-sign-in").addEventListener("click", function () {
    closeSignUpModal();
    openSignInModal();
  });

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeSignUpModal();
    }
  });
}

function openSignUpModal() {
  createSignUpModal();
  const modal = document.getElementById("sign-up-modal");
  if (modal) {
    modal.classList.add("active");
    modal.classList.add("visible");
  }
  const input = document.getElementById("sign-up-username");
  if (input) {
    input.focus();
  }
}

function closeSignUpModal() {
  const modal = document.getElementById("sign-up-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.classList.remove("visible");
  }
}

async function handleSignUp(event) {
  event.preventDefault();

  const username = document.getElementById("sign-up-username").value.trim();
  const email = document.getElementById("sign-up-email").value.trim();
  const password = document.getElementById("sign-up-password").value;
  const errorEl = document.getElementById("sign-up-error");
  const submitBtn = document.getElementById("submit-sign-up");

  errorEl.style.display = "none";
  errorEl.textContent = "";
  submitBtn.disabled = true;

  try {
    const response = await fetch(API_BASE_URL + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password
      })
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      let message = "Could not create account.";
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0] && data.detail[0].msg) {
        message = data.detail[0].msg;
      }
      throw new Error(message);
    }

    setAuthTokens(data.access_token, data.refresh_token, username);

    closeSignUpModal();
    updateAuthenticationUI();
    if (typeof loadExperiences === "function") {
      loadExperiences();
    }
    console.log("Successfully signed up.");
  } catch (error) {
    console.error("Sign up error:", error);
    errorEl.textContent = error.message || "Could not create account.";
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
  }
}

// ----------------------------------------------------------
// HEADER AVATAR + DROPDOWN
// ----------------------------------------------------------

function setAvatarElement(el, user) {
  if (!el || !user) return;

  const name = user.display_name || user.username || "?";
  const initial = name.charAt(0).toUpperCase();

  if (user.profile_image_url) {
    el.style.backgroundImage = 'url("' + user.profile_image_url + '")';
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.textContent = initial;
  }
}

async function loadHeaderUser() {
  if (!getAccessToken()) return;

  try {
    const response = await authenticatedFetch(API_BASE_URL + "/users/me");
    if (!response.ok) return;

    const user = await response.json();
    window.currentHeaderUser = user;

    setAvatarElement(headerAvatar, user);
    setAvatarElement(dropdownAvatar, user);

    if (dropdownDisplayName) {
      dropdownDisplayName.textContent = user.display_name || user.username || "";
    }
    if (dropdownEmail) {
      dropdownEmail.textContent = user.email || "";
    }
  } catch (error) {
    console.error("Failed to load header user:", error);
  }
}

function closeAccountDropdown() {
  if (!accountDropdown) return;
  accountDropdown.hidden = true;
  if (headerAvatarBtn) {
    headerAvatarBtn.setAttribute("aria-expanded", "false");
  }
}

function toggleAccountDropdown() {
  if (!accountDropdown) {
    console.error("account-dropdown not found in HTML");
    return;
  }
  const willOpen = accountDropdown.hidden;
  accountDropdown.hidden = !willOpen;
  if (headerAvatarBtn) {
    headerAvatarBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }
}

function updateAuthenticationUI() {
  const loggedIn = isLoggedIn();

  if (signInBtn) {
    signInBtn.style.display = loggedIn ? "none" : "";
  }
  if (signUpBtn) {
    signUpBtn.style.display = loggedIn ? "none" : "";
  }
  if (userMenu) {
    userMenu.style.display = loggedIn ? "flex" : "none";
  }

  closeAccountDropdown();

  if (loggedIn) {
    loadHeaderUser();
  }

  if (typeof updateAddExperienceButton === "function") {
    updateAddExperienceButton();
  }
}

// ----------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------

if (signInBtn) {
  signInBtn.addEventListener("click", openSignInModal);
}

if (signUpBtn) {
  signUpBtn.addEventListener("click", openSignUpModal);
}

if (headerAvatarBtn) {
  headerAvatarBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    toggleAccountDropdown();
  });
}

if (dropdownViewProfile) {
  dropdownViewProfile.addEventListener("click", function () {
    closeAccountDropdown();
    if (typeof openMyProfile === "function") {
      openMyProfile();
    }
  });
}

if (dropdownNotifications) {
  dropdownNotifications.addEventListener("click", function () {
    closeAccountDropdown();
    alert("Notifications coming soon.");
  });
}

if (dropdownSignOut) {
  dropdownSignOut.addEventListener("click", function () {
    closeAccountDropdown();
    logout();
    if (typeof loadExperiences === "function") {
      loadExperiences();
    }
  });
}

document.addEventListener("click", function (event) {
  if (userMenu && !userMenu.contains(event.target)) {
    closeAccountDropdown();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAccountDropdown();
    closeSignInModal();
    closeSignUpModal();
  }
});

document.addEventListener("DOMContentLoaded", updateAuthenticationUI);
updateAuthenticationUI();
