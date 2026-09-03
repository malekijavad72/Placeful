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

const API_BASE_URL = "http://127.0.0.1:8000/api";

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
const sidebarStory = document.getElementById("sidebar-story");
const sidebarEmotion = document.getElementById("sidebar-emotion");

const sidebarLikeBtn = document.getElementById("sidebar-like-btn");
const sidebarLikeIcon = document.getElementById("sidebar-like-icon");
const sidebarLikeText = document.getElementById("sidebar-like-text");
const sidebarLikeCount = document.getElementById("sidebar-like-count");
const sidebarLikeMessage = document.getElementById("sidebar-like-message");

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
// AUTH HELPERS
// ----------------------------------------------------------

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function isLoggedIn() {
  return Boolean(getAccessToken());
}

async function authenticatedFetch(url, options) {
  options = options || {};
  const token = getAccessToken();

  if (!token) {
    throw new Error("You must be signed in.");
  }

  const headers = Object.assign({}, options.headers || {}, {
    Authorization: "Bearer " + token
  });

  return fetch(url, Object.assign({}, options, { headers: headers }));
}

// ----------------------------------------------------------
// LOAD EXPERIENCES
// ----------------------------------------------------------

async function loadExperiences() {
  try {
    if (experiencesError) {
      experiencesError.style.display = "none";
    }

    const response = await fetch(API_BASE_URL + "/experiences/?offset=0&limit=100");

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

// ----------------------------------------------------------
// SIDEBAR OPEN / CLOSE
// ----------------------------------------------------------

function openSidebar() {
  if (!sidebar) {
    return;
  }

  sidebar.classList.add("open");
  sidebar.setAttribute("aria-hidden", "false");
  document.body.classList.add("sidebar-open");

  if (sidebarBackdrop) {
    sidebarBackdrop.hidden = false;
  }

  map.updateSize();
}

function closeSidebar() {
  if (!sidebar) {
    return;
  }

  sidebar.classList.remove("open");
  sidebar.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sidebar-open");

  if (sidebarBackdrop) {
    sidebarBackdrop.hidden = true;
  }

  currentPopupExperienceId = null;
  currentCommentsExperienceId = null;
  vectorLayer.changed();
  map.updateSize();
}

function openExperienceSidebar(feature) {
  const experienceId = feature.get("id");
  const title = feature.get("title");
  const story = feature.get("story");
  const emotion = feature.get("emotion");
  const emotionName = feature.get("emotion_name");

  currentPopupExperienceId = experienceId;
  currentCommentsExperienceId = experienceId;

  if (sidebarTitle) {
    sidebarTitle.textContent = title || "Untitled Experience";
  }

  if (sidebarStory) {
    sidebarStory.textContent = story || "No story available.";
  }

  if (sidebarEmotion) {
    const config = emotionConfig[emotion];
    if (config) {
      sidebarEmotion.textContent = config.emoji + " " + (emotionName || config.label);
      sidebarEmotion.hidden = false;
    } else if (emotionName || emotion) {
      sidebarEmotion.textContent = emotionName || emotion;
      sidebarEmotion.hidden = false;
    } else {
      sidebarEmotion.textContent = "";
      sidebarEmotion.hidden = true;
    }
  }

  openSidebar();
  updateCommentAuthenticationUI();
  loadComments(experienceId);
  loadLikeInformation(experienceId);
  vectorLayer.changed();
}

if (sidebarClose) {
  sidebarClose.addEventListener("click", closeSidebar);
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", closeSidebar);
}

// ----------------------------------------------------------
// LIKES
// ----------------------------------------------------------

function updateLikeUI(liked, likeCount) {
  if (!sidebarLikeBtn) {
    return;
  }

  sidebarLikeCount.textContent = likeCount;

  if (liked) {
    sidebarLikeBtn.classList.add("liked");
    sidebarLikeIcon.textContent = "♥";
    sidebarLikeText.textContent = "Liked";
    sidebarLikeBtn.setAttribute("aria-label", "Unlike experience");
  } else {
    sidebarLikeBtn.classList.remove("liked");
    sidebarLikeIcon.textContent = "♡";
    sidebarLikeText.textContent = "Like";
    sidebarLikeBtn.setAttribute("aria-label", "Like experience");
  }
}

async function loadLikeCount(experienceId) {
  try {
    const response = await fetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like-count"
    );

    if (!response.ok) {
      throw new Error("Like count request failed: " + response.status);
    }

    const data = await response.json();
    const count = data.like_count != null ? data.like_count : 0;
    sidebarLikeCount.textContent = count;
    return count;
  } catch (error) {
    console.error("Failed to load like count:", error);
    sidebarLikeCount.textContent = "0";
    return 0;
  }
}

async function loadLikeStatus(experienceId) {
  const token = getAccessToken();

  if (!token) {
    updateLikeUI(false, sidebarLikeCount.textContent || 0);
    return false;
  }

  try {
    const response = await fetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like-status",
      {
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    if (response.status === 401) {
      updateLikeUI(false, sidebarLikeCount.textContent || 0);
      return false;
    }

    if (!response.ok) {
      throw new Error("Like status request failed: " + response.status);
    }

    const data = await response.json();
    updateLikeUI(data.liked === true, sidebarLikeCount.textContent || 0);
    return data.liked === true;
  } catch (error) {
    console.error("Failed to load like status:", error);
    return false;
  }
}

async function loadLikeInformation(experienceId) {
  if (sidebarLikeMessage) {
    sidebarLikeMessage.textContent = "";
  }
  if (sidebarLikeCount) {
    sidebarLikeCount.textContent = "…";
  }
  await loadLikeCount(experienceId);
  await loadLikeStatus(experienceId);
}

async function likeExperience(experienceId) {
  const token = getAccessToken();

  if (!token) {
    sidebarLikeMessage.textContent = "Please log in to like experiences.";
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  try {
    sidebarLikeBtn.classList.add("loading");
    sidebarLikeMessage.textContent = "";

    const response = await fetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    if (response.status === 401) {
      sidebarLikeMessage.textContent = "Please log in again.";
      return;
    }

    if (response.status === 409) {
      await loadLikeInformation(experienceId);
      return;
    }

    if (!response.ok) {
      throw new Error("Like request failed: " + response.status);
    }

    await loadLikeInformation(experienceId);
  } catch (error) {
    console.error("Failed to like experience:", error);
    sidebarLikeMessage.textContent = "Unable to like this experience.";
  } finally {
    sidebarLikeBtn.classList.remove("loading");
  }
}

async function unlikeExperience(experienceId) {
  const token = getAccessToken();

  if (!token) {
    sidebarLikeMessage.textContent = "Please log in to manage your likes.";
    return;
  }

  try {
    sidebarLikeBtn.classList.add("loading");
    sidebarLikeMessage.textContent = "";

    const response = await fetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like",
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    if (response.status === 401) {
      sidebarLikeMessage.textContent = "Please log in again.";
      return;
    }

    if (response.status === 404) {
      await loadLikeInformation(experienceId);
      return;
    }

    if (!response.ok) {
      throw new Error("Unlike request failed: " + response.status);
    }

    await loadLikeInformation(experienceId);
  } catch (error) {
    console.error("Failed to unlike experience:", error);
    sidebarLikeMessage.textContent = "Unable to unlike this experience.";
  } finally {
    sidebarLikeBtn.classList.remove("loading");
  }
}

if (sidebarLikeBtn) {
  sidebarLikeBtn.addEventListener("click", async function () {
    if (!currentPopupExperienceId) {
      return;
    }

    if (sidebarLikeBtn.classList.contains("liked")) {
      await unlikeExperience(currentPopupExperienceId);
    } else {
      await likeExperience(currentPopupExperienceId);
    }
  });
}

// ----------------------------------------------------------
// COMMENTS
// ----------------------------------------------------------

function formatCommentDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isCommentOwner(commentUserId) {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.sub) === String(commentUserId);
  } catch (error) {
    return false;
  }
}

function updateCommentAuthenticationUI() {
  if (!commentInput || !submitCommentBtn || !commentLoginMessage) {
    return;
  }

  if (isLoggedIn()) {
    commentInput.disabled = false;
    submitCommentBtn.disabled = false;
    commentInput.placeholder = "Share your thoughts...";
    commentLoginMessage.textContent = "";
  } else {
    commentInput.disabled = true;
    submitCommentBtn.disabled = false;
    commentInput.placeholder = "Sign in to comment";
    commentLoginMessage.textContent = "You need to sign in to comment.";
  }
}

async function loadComments(experienceId) {
  if (!commentsList) {
    return;
  }

  currentCommentsExperienceId = experienceId;
  commentsList.innerHTML = "";

  const loadingElement = document.createElement("div");
  loadingElement.className = "comments-message";
  loadingElement.textContent = "Loading comments...";
  commentsList.appendChild(loadingElement);

  try {
    const response = await fetch(
      API_BASE_URL + "/experiences/" + experienceId + "/comments"
    );

    if (!response.ok) {
      throw new Error("HTTP error: " + response.status);
    }

    const comments = await response.json();
    currentComments = Array.isArray(comments) ? comments : [];

    if (commentsCount) {
      commentsCount.textContent = currentComments.length;
    }

    if (currentComments.length === 0) {
      commentsList.innerHTML = "";
      const emptyElement = document.createElement("div");
      emptyElement.className = "comments-message";
      emptyElement.textContent = "No comments yet. Be the first to comment.";
      commentsList.appendChild(emptyElement);
      return;
    }

    renderComments(currentComments);
  } catch (error) {
    console.error("Failed to load comments:", error);
    commentsList.innerHTML = "";
    const errorElement = document.createElement("div");
    errorElement.className = "comments-message comments-error";
    errorElement.textContent = "Unable to load comments.";
    commentsList.appendChild(errorElement);
  }
}

function renderComments(comments) {
  commentsList.innerHTML = "";

  const rootComments = comments.filter(function (comment) {
    return comment.parent_comment_id === null;
  });

  const repliesMap = {};

  comments.forEach(function (comment) {
    if (comment.parent_comment_id !== null) {
      if (!repliesMap[comment.parent_comment_id]) {
        repliesMap[comment.parent_comment_id] = [];
      }
      repliesMap[comment.parent_comment_id].push(comment);
    }
  });

  rootComments.forEach(function (comment) {
    renderComment(comment, repliesMap, 0);
  });
}

function renderComment(comment, repliesMap, depth) {
  const commentElement = document.createElement("div");
  commentElement.className = "comment-item";
  if (depth > 0) {
    commentElement.classList.add("reply");
  }
  commentElement.dataset.commentId = comment.id;

  const header = document.createElement("div");
  header.className = "comment-header";

  const author = document.createElement("span");
  author.className = "comment-author";
  author.textContent = "User " + String(comment.user_id).substring(0, 8);

  const date = document.createElement("span");
  date.className = "comment-date";

  const createdAt = new Date(comment.created_at);
  const updatedAt = new Date(comment.updated_at);
  const wasEdited =
    !Number.isNaN(createdAt.getTime()) &&
    !Number.isNaN(updatedAt.getTime()) &&
    updatedAt.getTime() - createdAt.getTime() > 1000;

  date.textContent = wasEdited
    ? "Edited · " + formatCommentDate(comment.updated_at)
    : formatCommentDate(comment.created_at);

  header.appendChild(author);
  header.appendChild(date);

  const content = document.createElement("p");
  content.className = "comment-content";
  content.textContent = comment.content;

  const actions = document.createElement("div");
  actions.className = "comment-actions";

  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.className = "comment-action-btn";
  replyButton.textContent = "Reply";
  replyButton.addEventListener("click", function () {
    toggleReplyForm(commentElement, comment.id);
  });
  actions.appendChild(replyButton);

  if (isCommentOwner(comment.user_id)) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "comment-action-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", function () {
      showEditCommentForm(commentElement, comment);
    });
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "comment-action-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function () {
      deleteComment(comment.id);
    });
    actions.appendChild(deleteButton);
  }

  const replyForm = createReplyForm(comment.id);
  const editForm = createEditCommentForm(comment);

  commentElement.appendChild(header);
  commentElement.appendChild(content);
  commentElement.appendChild(actions);
  commentElement.appendChild(replyForm);
  commentElement.appendChild(editForm);
  commentsList.appendChild(commentElement);

  const replies = repliesMap[comment.id] || [];
  replies.forEach(function (reply) {
    renderComment(reply, repliesMap, depth + 1);
  });
}

function createReplyForm(parentCommentId) {
  const wrapper = document.createElement("div");
  wrapper.className = "reply-form";

  const textarea = document.createElement("textarea");
  textarea.className = "reply-input";
  textarea.maxLength = 5000;
  textarea.placeholder = "Write a reply...";

  const actions = document.createElement("div");
  actions.className = "reply-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "reply-cancel-btn";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", function () {
    wrapper.classList.remove("active");
    textarea.value = "";
  });

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "reply-submit-btn";
  submitButton.textContent = "Reply";
  submitButton.addEventListener("click", async function () {
    const content = textarea.value.trim();
    if (!content) {
      textarea.focus();
      return;
    }
    await createComment(content, parentCommentId, submitButton);
  });

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  wrapper.appendChild(textarea);
  wrapper.appendChild(actions);
  return wrapper;
}

function toggleReplyForm(commentElement) {
  if (!isLoggedIn()) {
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  const form = commentElement.querySelector(".reply-form");
  if (!form) {
    return;
  }

  form.classList.toggle("active");
  if (form.classList.contains("active")) {
    const input = form.querySelector(".reply-input");
    if (input) {
      input.focus();
    }
  }
}

function createEditCommentForm(comment) {
  const wrapper = document.createElement("div");
  wrapper.className = "edit-comment-form";

  const textarea = document.createElement("textarea");
  textarea.className = "edit-comment-input";
  textarea.maxLength = 5000;
  textarea.value = comment.content;

  const actions = document.createElement("div");
  actions.className = "edit-comment-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "edit-cancel-btn";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", function () {
    wrapper.classList.remove("active");
    textarea.value = comment.content;
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "edit-save-btn";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", async function () {
    const content = textarea.value.trim();
    if (!content) {
      textarea.focus();
      return;
    }
    await updateComment(comment.id, content, saveButton);
  });

  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);
  wrapper.appendChild(textarea);
  wrapper.appendChild(actions);
  return wrapper;
}

function showEditCommentForm(commentElement, comment) {
  const form = commentElement.querySelector(".edit-comment-form");
  if (!form) {
    return;
  }
  form.classList.add("active");
  const input = form.querySelector(".edit-comment-input");
  if (input) {
    input.value = comment.content;
    input.focus();
  }
}

async function createComment(content, parentCommentId, submitButton) {
  if (!isLoggedIn()) {
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  if (!currentCommentsExperienceId) {
    return;
  }

  const originalText = submitButton ? submitButton.textContent : "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Posting...";
  }

  try {
    const response = await authenticatedFetch(
      API_BASE_URL + "/experiences/" + currentCommentsExperienceId + "/comments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content,
          parent_comment_id: parentCommentId
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "HTTP error: " + response.status);
    }

    await loadComments(currentCommentsExperienceId);

    if (!parentCommentId && commentInput) {
      commentInput.value = "";
    }
  } catch (error) {
    console.error("Failed to create comment:", error);
    alert(error.message || "Unable to post comment.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || "Reply";
    }
  }
}

async function updateComment(commentId, content, saveButton) {
  if (!isLoggedIn()) {
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  const originalText = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const response = await authenticatedFetch(
      API_BASE_URL + "/experiences/comments/" + commentId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "HTTP error: " + response.status);
    }

    await loadComments(currentCommentsExperienceId);
  } catch (error) {
    console.error("Failed to update comment:", error);
    alert(error.message || "Unable to update comment.");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}

async function deleteComment(commentId) {
  if (!isLoggedIn()) {
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  if (!window.confirm("Delete this comment?")) {
    return;
  }

  try {
    const response = await authenticatedFetch(
      API_BASE_URL + "/experiences/comments/" + commentId,
      { method: "DELETE" }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "HTTP error: " + response.status);
    }

    await loadComments(currentCommentsExperienceId);
  } catch (error) {
    console.error("Failed to delete comment:", error);
    alert(error.message || "Unable to delete comment.");
  }
}

if (submitCommentBtn) {
  submitCommentBtn.addEventListener("click", async function () {
    if (!isLoggedIn()) {
      if (typeof openSignInModal === "function") {
        openSignInModal();
      }
      return;
    }

    const content = commentInput ? commentInput.value.trim() : "";
    if (!content) {
      if (commentInput) {
        commentInput.focus();
      }
      return;
    }

    await createComment(content, null, submitCommentBtn);
  });
}

document.addEventListener("DOMContentLoaded", updateCommentAuthenticationUI);

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
    return;
  }

  openExperienceSidebar(feature);
});

// ----------------------------------------------------------
// ADD EXPERIENCE FLOW
// ----------------------------------------------------------

if (addExperienceBtn) {
  addExperienceBtn.addEventListener("click", function () {
    if (!isLoggedIn()) {
      if (typeof openSignInModal === "function") {
        openSignInModal();
      }
      return;
    }

    isSelectingLocation = true;
    addExperienceBtn.textContent = "Click a location on the map";
    map.getTargetElement().style.cursor = "crosshair";
    closeSidebar();
  });
}

function selectExperienceLocation(coordinate) {
  const lonLat = ol.proj.toLonLat(coordinate);
  selectedLongitude = lonLat[0];
  selectedLatitude = lonLat[1];

  isSelectingLocation = false;
  addExperienceBtn.innerHTML =
    '<span class="add-experience-icon">+</span><span>Add experience</span>';
  map.getTargetElement().style.cursor = "";

  experienceFormOverlay.classList.add("active");
}

function closeExperienceFormAndReset() {
  experienceFormOverlay.classList.remove("active");
  experienceForm.reset();
  selectedLongitude = null;
  selectedLatitude = null;
  isSelectingLocation = false;
  addExperienceBtn.innerHTML =
    '<span class="add-experience-icon">+</span><span>Add experience</span>';
  map.getTargetElement().style.cursor = "";
}

if (closeExperienceForm) {
  closeExperienceForm.addEventListener("click", closeExperienceFormAndReset);
}

if (cancelExperienceBtn) {
  cancelExperienceBtn.addEventListener("click", closeExperienceFormAndReset);
}

if (experienceFormOverlay) {
  experienceFormOverlay.addEventListener("click", function (event) {
    if (event.target === experienceFormOverlay) {
      closeExperienceFormAndReset();
    }
  });
}

if (experienceForm) {
  experienceForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const title = document.getElementById("experience-title").value.trim();
    const story = document.getElementById("experience-description").value.trim();
    const emotion = document.getElementById("experience-emotion").value;

    if (!title || !story || !emotion) {
      return;
    }

    if (selectedLongitude === null || selectedLatitude === null) {
      console.error("No location selected.");
      return;
    }

    if (!isLoggedIn()) {
      if (typeof openSignInModal === "function") {
        openSignInModal();
      }
      return;
    }

    const experience = {
      title: title,
      story: story,
      emotion: emotion,
      latitude: selectedLatitude,
      longitude: selectedLongitude
    };

    try {
      const response = await authenticatedFetch(API_BASE_URL + "/experiences/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(experience)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("FastAPI response:", errorText);
        throw new Error("HTTP error: " + response.status);
      }

      closeExperienceFormAndReset();
      await loadExperiences();
    } catch (error) {
      console.error("Failed to create experience:", error);
      alert(error.message || "Could not save this experience.");
    }
  });
}

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
