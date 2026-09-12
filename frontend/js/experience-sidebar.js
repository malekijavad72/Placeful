// ============================================================
// PLACEFUL — experience sidebar (detail, media, likes, comments)
// Depends on: api.js, map.js (map, vectorSource, vectorLayer, emotionConfig)
// ============================================================

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

  closeMediaViewer();
  currentMediaItems = [];
  currentMediaIndex = 0;

  currentPopupExperienceId = null;
  currentCommentsExperienceId = null;
  vectorLayer.changed();
  map.updateSize();
}


function focusExperienceOnMap(experienceId) {
  if (!experienceId) return;

  const features = vectorSource.getFeatures();
  let target = null;
  for (let i = 0; i < features.length; i++) {
    if (String(features[i].get("id")) === String(experienceId)) {
      target = features[i];
      break;
    }
  }

  if (!target) return;

  if (typeof closeProfileSidebar === "function") {
    closeProfileSidebar();
  }

  // Ensure location-selection mode is not stuck
  isSelectingLocation = false;

  const geometry = target.getGeometry();
  if (geometry) {
    map.getView().fit(geometry.getExtent(), {
      padding: [100, 100, 100, 100],
      maxZoom: 16,
      duration: 400,
      callback: function () {
        unlockMainMap();
      }
    });
  }

  openExperienceSidebar(target);
  unlockMainMap();

  // Extra unlock after layout settles (sidebar open)
  setTimeout(unlockMainMap, 100);
  setTimeout(unlockMainMap, 500);
}

window.focusExperienceOnMap = focusExperienceOnMap;

function openExperienceSidebar(feature) {
  const experienceId = feature.get("id");
  const title = feature.get("title");
  const story = feature.get("story");
  const emotion = feature.get("emotion");
  const emotionName = feature.get("emotion_name");
  const userId = feature.get("user_id");
  const username = feature.get("username");
  const displayName = feature.get("display_name");
  const isAnonymous = feature.get("is_anonymous");

  currentPopupExperienceId = experienceId;
  currentCommentsExperienceId = experienceId;
  window.currentExperienceAuthorId = userId || null;

  if (sidebarTitle) {
    sidebarTitle.textContent = title || "Untitled Experience";
  }

  if (sidebarPlace) {
    const placeName = feature.get("place_name");
    const placeCategory = feature.get("place_category");
    const placeCity = feature.get("place_city");
    const placeId = feature.get("place_id");

    if (placeName) {
      sidebarPlace.textContent = "📍 " + placeName;
      sidebarPlace.hidden = false;
      sidebarPlace.dataset.placeId = placeId ? String(placeId) : "";
    } else {
      sidebarPlace.textContent = "";
      sidebarPlace.hidden = true;
      delete sidebarPlace.dataset.placeId;
    }
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

  const profileImageUrl = feature.get("profile_image_url");
  const createdAt = feature.get("created_at");
  const updatedAt = feature.get("updated_at");

  if (sidebarCreator) {
    if (!isAnonymous && userId) {
      const name = displayName || username || "User";
      sidebarCreatorName.textContent = name;
      sidebarCreatorUsername.textContent = username ? "@" + username : "";
      sidebarCreator.dataset.userId = String(userId);
      sidebarCreator.hidden = false;

      if (profileImageUrl) {
        sidebarCreatorAvatar.style.backgroundImage = 'url("' + profileImageUrl + '")';
        sidebarCreatorAvatar.textContent = "";
      } else {
        sidebarCreatorAvatar.style.backgroundImage = "";
        sidebarCreatorAvatar.textContent = (name.charAt(0) || "?").toUpperCase();
      }
    } else {
      sidebarCreator.hidden = true;
      delete sidebarCreator.dataset.userId;
      sidebarCreatorName.textContent = "";
      sidebarCreatorUsername.textContent = "";
      sidebarCreatorAvatar.style.backgroundImage = "";
      sidebarCreatorAvatar.textContent = "?";
    }
  }

  if (sidebarDate) {
    const created = createdAt ? new Date(createdAt) : null;
    const updated = updatedAt ? new Date(updatedAt) : null;
    const validCreated = created && !Number.isNaN(created.getTime());
    const validUpdated = updated && !Number.isNaN(updated.getTime());
    const wasEdited =
      validCreated &&
      validUpdated &&
      updated.getTime() - created.getTime() > 1000;

    function fmt(d) {
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    if (wasEdited) {
      sidebarDate.textContent = "Edited · " + fmt(updated);
      sidebarDate.hidden = false;
    } else if (validCreated) {
      sidebarDate.textContent = fmt(created);
      sidebarDate.hidden = false;
    } else {
      sidebarDate.textContent = "";
      sidebarDate.hidden = true;
    }
  }

  openSidebar();
  updateCommentAuthenticationUI();
  loadComments(experienceId);
  loadLikeInformation(experienceId);
  loadSidebarMedia(experienceId);
  vectorLayer.changed();
}

if (sidebarClose) {
  sidebarClose.addEventListener("click", closeSidebar);
}

if (sidebarCreator) {
  sidebarCreator.addEventListener("click", function () {
    const userId = sidebarCreator.dataset.userId;
    if (!userId) return;
    if (typeof openUserProfile === "function") {
      openUserProfile(userId);
    }
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", closeSidebar);
}

// ----------------------------------------------------------
// MEDIA CAROUSEL + LARGE VIEWER
// ----------------------------------------------------------

function mediaSrc(item) {
  const path = item && (item.url || item.storage_key);
  return mediaUrl(path);
}

function updateMediaUI() {
  if (!currentMediaItems.length) {
    if (sidebarMedia) sidebarMedia.hidden = true;
    closeMediaViewer();
    return;
  }

  if (currentMediaIndex < 0) currentMediaIndex = 0;
  if (currentMediaIndex >= currentMediaItems.length) {
    currentMediaIndex = currentMediaItems.length - 1;
  }

  const item = currentMediaItems[currentMediaIndex];
  const src = mediaSrc(item);
  const label = (currentMediaIndex + 1) + " / " + currentMediaItems.length;

  if (sidebarMedia) sidebarMedia.hidden = false;
  if (sidebarMediaImage) {
    sidebarMediaImage.src = src;
    sidebarMediaImage.alt = item.original_filename || "Experience photo";
  }
  if (sidebarMediaCounter) sidebarMediaCounter.textContent = label;

  const many = currentMediaItems.length > 1;
  if (sidebarMediaPrev) sidebarMediaPrev.style.visibility = many ? "visible" : "hidden";
  if (sidebarMediaNext) sidebarMediaNext.style.visibility = many ? "visible" : "hidden";

  if (mediaViewer && !mediaViewer.hidden) {
    if (mediaViewerImage) mediaViewerImage.src = src;
    if (mediaViewerCounter) mediaViewerCounter.textContent = label;
  }
}

function showPrevMedia() {
  if (currentMediaItems.length < 2) return;
  currentMediaIndex =
    (currentMediaIndex - 1 + currentMediaItems.length) % currentMediaItems.length;
  updateMediaUI();
}

function showNextMedia() {
  if (currentMediaItems.length < 2) return;
  currentMediaIndex = (currentMediaIndex + 1) % currentMediaItems.length;
  updateMediaUI();
}

function openMediaViewer() {
  if (!mediaViewer || !currentMediaItems.length) return;
  mediaViewer.hidden = false;
  mediaViewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("media-viewer-open");
  updateMediaUI();
}

function closeMediaViewer() {
  if (!mediaViewer) return;
  mediaViewer.hidden = true;
  mediaViewer.setAttribute("aria-hidden", "true");
  document.getElementById("media-viewer-close");
}

async function loadSidebarMedia(experienceId) {
  currentMediaItems = [];
  currentMediaIndex = 0;
  if (sidebarMedia) {
    sidebarMedia.hidden = true;
  }
  closeMediaViewer();

  try {
    const response = await apiFetch(
      API_BASE_URL + "/experiences/" + experienceId + "/media"
    );
    if (!response.ok) return;
    const items = await response.json();
    currentMediaItems = Array.isArray(items) ? items : [];
    currentMediaIndex = 0;
    updateMediaUI();
  } catch (error) {
    console.error("Failed to load media:", error);
  }
}

if (sidebarMediaPrev) sidebarMediaPrev.addEventListener("click", showPrevMedia);
if (sidebarMediaNext) sidebarMediaNext.addEventListener("click", showNextMedia);
if (sidebarMediaExpand) sidebarMediaExpand.addEventListener("click", openMediaViewer);
if (sidebarMediaImage) {
  sidebarMediaImage.addEventListener("click", openMediaViewer);
}
if (mediaViewerClose) mediaViewerClose.addEventListener("click", closeMediaViewer);
if (mediaViewerPrev) mediaViewerPrev.addEventListener("click", showPrevMedia);
if (mediaViewerNext) mediaViewerNext.addEventListener("click", showNextMedia);



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
    const response = await apiFetch(
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
  if (!isLoggedIn()) {
    updateLikeUI(false, sidebarLikeCount.textContent || 0);
    return false;
  }

  try {
    const response = await apiFetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like-status"
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
  if (!isLoggedIn()) {
    sidebarLikeMessage.textContent = "Please log in to like experiences.";
    if (typeof openSignInModal === "function") {
      openSignInModal();
    }
    return;
  }

  try {
    sidebarLikeBtn.classList.add("loading");
    sidebarLikeMessage.textContent = "";

    const response = await authenticatedFetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like",
      { method: "POST" }
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
  if (!isLoggedIn()) {
    sidebarLikeMessage.textContent = "Please log in to manage your likes.";
    return;
  }

  try {
    sidebarLikeBtn.classList.add("loading");
    sidebarLikeMessage.textContent = "";

    const response = await authenticatedFetch(
      API_BASE_URL + "/experiences/" + experienceId + "/like",
      { method: "DELETE" }
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
  const myId = getCurrentUserId();
  if (!myId) {
    return false;
  }
  return String(myId) === String(commentUserId);
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
    const response = await apiFetch(
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

