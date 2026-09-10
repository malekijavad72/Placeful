// ============================================================
// PLACEFUL — shared API helpers
// Load this file BEFORE auth.js, map.js, profile-sidebar.js
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000/api";
const API_ORIGIN = "http://127.0.0.1:8000";

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
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

function setAuthTokens(accessToken, refreshToken, username) {
  if (accessToken) {
    localStorage.setItem("access_token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }
  if (username) {
    localStorage.setItem("logged_in_username", username);
  }
}

function clearAuthenticationState() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("logged_in_username");
  localStorage.removeItem("logged_in_user_id");
  window.currentHeaderUser = null;

  if (typeof updateAuthenticationUI === "function") {
    updateAuthenticationUI();
  }
}

function logout() {
  clearAuthenticationState();
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token available.");
  }

  const response = await fetch(
    API_BASE_URL +
      "/auth/refresh?refresh_token=" +
      encodeURIComponent(refreshToken),
    { method: "POST" }
  );

  const data = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    clearAuthenticationState();
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to refresh access token."
    );
  }

  setAuthTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

/**
 * Fetch with optional Bearer token.
 * Does not require login. Adds Authorization when a token exists.
 * On 401 with a token, tries one refresh + retry.
 */
async function apiFetch(url, options) {
  options = options || {};
  const headers = Object.assign({}, options.headers || {});
  let token = getAccessToken();

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  let response = await fetch(
    url,
    Object.assign({}, options, { headers: headers })
  );

  if (response.status === 401 && getRefreshToken()) {
    try {
      token = await refreshAccessToken();
      headers.Authorization = "Bearer " + token;
      response = await fetch(
        url,
        Object.assign({}, options, { headers: headers })
      );
    } catch (error) {
      // leave original 401 response
    }
  }

  return response;
}

/**
 * Fetch that requires a logged-in user.
 * Uses access token; on missing token or 401, tries refresh once.
 */
async function authenticatedFetch(url, options) {
  options = options || {};
  let token = getAccessToken();

  if (!token) {
    token = await refreshAccessToken();
  }

  const headers = Object.assign({}, options.headers || {}, {
    Authorization: "Bearer " + token
  });

  let response = await fetch(
    url,
    Object.assign({}, options, { headers: headers })
  );

  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    const retryHeaders = Object.assign({}, options.headers || {}, {
      Authorization: "Bearer " + newAccessToken
    });
    response = await fetch(
      url,
      Object.assign({}, options, { headers: retryHeaders })
    );
  }

  return response;
}

function mediaUrl(path) {
  if (!path) return "";
  const value = String(path);
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return API_ORIGIN + value;
  return API_ORIGIN + "/uploads/" + value;
}
