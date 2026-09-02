// ============================================================
// PLACES PROJECT
// COMPLETE MAP.JS
// ============================================================


// ============================================================
// 1. CREATE THE MAP
// ============================================================

const map = new ol.Map({

    target: "full-map",

    layers: [

        new ol.layer.Tile({

            source: new ol.source.OSM()

        })

    ],

    view: new ol.View({

        center: ol.proj.fromLonLat([
            45.0783,
            37.5497
        ]),

        zoom: 12

    })

});


// ============================================================
// 2. EMOTION CONFIGURATION
// ============================================================

const emotionConfig = {

    happy: {
        emoji: "😊"
    },

    sad: {
        emoji: "😢"
    },

    peaceful: {
        emoji: "😌"
    },

    excited: {
        emoji: "🤩"
    },

    nostalgic: {
        emoji: "🥹"
    },

    love: {
        emoji: "❤️"
    }

};


// ============================================================
// 3. CURRENT EMOTION FILTER
// ============================================================

let activeEmotionFilter = "all";


// ============================================================
// 4. CREATE VECTOR SOURCE
// ============================================================

const vectorSource =
    new ol.source.Vector();


// ============================================================
// 5. CREATE VECTOR LAYER
// ============================================================

const vectorLayer =
    new ol.layer.Vector({

        source: vectorSource,

        style: function (feature) {

            const emotion =
                feature.get("emotion");


            // ------------------------------------------------
            // If "All" is selected
            // ------------------------------------------------

            if (
                activeEmotionFilter === "all"
            ) {

                return getExperienceStyle(
                    feature
                );

            }


            // ------------------------------------------------
            // If feature matches selected emotion
            // ------------------------------------------------

            if (
                emotion ===
                activeEmotionFilter
            ) {

                return getExperienceStyle(
                    feature
                );

            }


            // ------------------------------------------------
            // Hide feature
            // ------------------------------------------------

            return null;

        }

    });


// ============================================================
// 6. ADD VECTOR LAYER TO MAP
// ============================================================

map.addLayer(
    vectorLayer
);


// ============================================================
// 7. EXPERIENCE STYLE
// ============================================================

function getExperienceStyle(
    feature
) {

    const emotion =
        feature.get("emotion");


    // --------------------------------------------------------
    // Default emoji
    // --------------------------------------------------------

    let emoji = "📍";


    // --------------------------------------------------------
    // Get emotion emoji
    // --------------------------------------------------------

    if (
        emotion &&
        emotionConfig[emotion]
    ) {

        emoji =
            emotionConfig[emotion].emoji;

    }


    // --------------------------------------------------------
    // Return style
    // --------------------------------------------------------

    return new ol.style.Style({

        text: new ol.style.Text({

            text: emoji,

            font: "24px Arial",

            textAlign: "center",

            textBaseline: "middle"

        })

    });

}


// ============================================================
// 8. LOAD EXPERIENCES
// ============================================================
const experiencesError =
    document.getElementById(
        "experiences-error"
    );


async function loadExperiences() {

    try {   

        experiencesError.style.display = "none";

        // ----------------------------------------------------
        // GET API
        // ----------------------------------------------------

        const response =
            await fetch(
                "http://127.0.0.1:8000/api/experiences/"
            );


        // ----------------------------------------------------
        // Check response
        // ----------------------------------------------------

        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "FastAPI response:",
                errorText
            );

            throw new Error(
                `HTTP error: ${response.status}`
            );

        }


        // ----------------------------------------------------
        // Read GeoJSON
        // ----------------------------------------------------

        const geojson =
            await response.json();


        // ----------------------------------------------------
        // Convert GeoJSON → OpenLayers
        // ----------------------------------------------------

        const features =
            new ol.format.GeoJSON().readFeatures(
                geojson,
                {
                    featureProjection:
                        "EPSG:3857"
                }
            );


        // ----------------------------------------------------
        // Clear old features
        // ----------------------------------------------------

        vectorSource.clear();


        // ----------------------------------------------------
        // Add new features
        // ----------------------------------------------------

        vectorSource.addFeatures(
            features
        );


        // ----------------------------------------------------
        // Redraw layer
        // ----------------------------------------------------

        vectorLayer.changed();


        // ----------------------------------------------------
        // Console information
        // ----------------------------------------------------

        features.forEach(
            function (feature) {

                console.log(
                    "Experience:",
                    feature.get("title")
                );

                console.log(
                    "Emotion:",
                    feature.get("emotion")
                );

            }
        );


        console.log(
            "Experiences loaded:",
            features.length
        );

    }

    catch (error) {

        console.error(
            "Failed to load experiences:",
            error
        );
        experiencesError.style.display = "block";

    }

}


// ============================================================
// 9. LOAD EXPERIENCES
// ============================================================

loadExperiences();



// ============================================================
// 10. POPUP ELEMENTS
// ============================================================

const popup =
    document.getElementById(
        "popup"
    );


const popupTitle =
    document.getElementById(
        "popup-title"
    );


const popupStory =
    document.getElementById(
        "popup-story"
    );


const popupClose =
    document.getElementById(
        "popup-close"
    );

const popupLikeBtn =
    document.getElementById(
        "popup-like-btn"
    );


const popupLikeIcon =
    document.getElementById(
        "popup-like-icon"
    );


const popupLikeText =
    document.getElementById(
        "popup-like-text"
    );


const popupLikeCount =
    document.getElementById(
        "popup-like-count"
    );


const popupLikeMessage =
    document.getElementById(
        "popup-like-message"
    );


// ============================================================
// 11. LOCATION SELECTION STATE
// ============================================================

let isSelectingLocation =
    false;


let selectedLongitude =
    null;


let selectedLatitude =
    null;

// ============================================================
// CURRENT EXPERIENCE IN POPUP
// ============================================================

let currentPopupExperienceId =
    null;


// ============================================================
// LIKE API
// ============================================================

const API_BASE_URL =
    "http://127.0.0.1:8000/api";


// ============================================================
// GET AUTH TOKEN
// ============================================================

function getAccessToken() {

    return localStorage.getItem(
        "access_token"
    );

}


// ============================================================
// UPDATE LIKE UI
// ============================================================

function updateLikeUI(
    liked,
    likeCount
) {

    popupLikeCount.textContent =
        likeCount;


    if (liked) {

        popupLikeBtn.classList.add(
            "liked"
        );

        popupLikeIcon.textContent =
            "♥";

        popupLikeText.textContent =
            "Liked";

        popupLikeBtn.setAttribute(
            "aria-label",
            "Unlike experience"
        );

    }
    else {

        popupLikeBtn.classList.remove(
            "liked"
        );

        popupLikeIcon.textContent =
            "♡";

        popupLikeText.textContent =
            "Like";

        popupLikeBtn.setAttribute(
            "aria-label",
            "Like experience"
        );

    }

}


// ============================================================
// GET LIKE COUNT
// ============================================================

async function loadLikeCount(
    experienceId
) {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/experiences/${experienceId}/like-count`
            );


        if (!response.ok) {

            throw new Error(
                `Like count request failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        popupLikeCount.textContent =
            data.like_count ?? 0;


        return data.like_count ?? 0;

    }
    catch (error) {

        console.error(
            "Failed to load like count:",
            error
        );

        popupLikeCount.textContent =
            "0";

        return 0;

    }

}


// ============================================================
// GET LIKE STATUS
// ============================================================

async function loadLikeStatus(
    experienceId
) {

    const token =
        getAccessToken();


    // --------------------------------------------------------
    // User is not logged in
    // --------------------------------------------------------

    if (!token) {

        updateLikeUI(
            false,
            popupLikeCount.textContent || 0
        );

        return false;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/experiences/${experienceId}/like-status`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (
            response.status === 401
        ) {

            updateLikeUI(
                false,
                popupLikeCount.textContent || 0
            );

            return false;

        }


        if (!response.ok) {

            throw new Error(
                `Like status request failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        updateLikeUI(
            data.liked === true,
            popupLikeCount.textContent || 0
        );


        return data.liked === true;

    }
    catch (error) {

        console.error(
            "Failed to load like status:",
            error
        );

        return false;

    }

}


// ============================================================
// LOAD LIKE INFORMATION
// ============================================================

async function loadLikeInformation(
    experienceId
) {

    popupLikeMessage.textContent =
        "";

    popupLikeCount.textContent =
        "...";


    await loadLikeCount(
        experienceId
    );


    await loadLikeStatus(
        experienceId
    );

}


// ============================================================
// LIKE EXPERIENCE
// ============================================================

async function likeExperience(
    experienceId
) {

    const token =
        getAccessToken();


    if (!token) {

        popupLikeMessage.textContent =
            "Please log in to like experiences.";

        return;

    }


    try {

        popupLikeBtn.classList.add(
            "loading"
        );

        popupLikeMessage.textContent =
            "";


        const response =
            await fetch(
                `${API_BASE_URL}/experiences/${experienceId}/like`,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (
            response.status === 401
        ) {

            popupLikeMessage.textContent =
                "Please log in again.";

            return;

        }


        if (
            response.status === 409
        ) {

            // Already liked.
            // Refresh the real state.

            await loadLikeInformation(
                experienceId
            );

            return;

        }


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Like API response:",
                errorText
            );

            throw new Error(
                `Like request failed: ${response.status}`
            );

        }


        // ----------------------------------------------------
        // Refresh count and state
        // ----------------------------------------------------

        await loadLikeInformation(
            experienceId
        );

    }
    catch (error) {

        console.error(
            "Failed to like experience:",
            error
        );

        popupLikeMessage.textContent =
            "Unable to like this experience.";

    }
    finally {

        popupLikeBtn.classList.remove(
            "loading"
        );

    }

}


// ============================================================
// UNLIKE EXPERIENCE
// ============================================================

async function unlikeExperience(
    experienceId
) {

    const token =
        getAccessToken();


    if (!token) {

        popupLikeMessage.textContent =
            "Please log in to manage your likes.";

        return;

    }


    try {

        popupLikeBtn.classList.add(
            "loading"
        );

        popupLikeMessage.textContent =
            "";


        const response =
            await fetch(
                `${API_BASE_URL}/experiences/${experienceId}/like`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (
            response.status === 401
        ) {

            popupLikeMessage.textContent =
                "Please log in again.";

            return;

        }


        if (
            response.status === 404
        ) {

            // Already unliked.
            // Refresh actual state.

            await loadLikeInformation(
                experienceId
            );

            return;

        }


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Unlike API response:",
                errorText
            );

            throw new Error(
                `Unlike request failed: ${response.status}`
            );

        }


        // ----------------------------------------------------
        // Refresh count and state
        // ----------------------------------------------------

        await loadLikeInformation(
            experienceId
        );

    }
    catch (error) {

        console.error(
            "Failed to unlike experience:",
            error
        );

        popupLikeMessage.textContent =
            "Unable to unlike this experience.";

    }
    finally {

        popupLikeBtn.classList.remove(
            "loading"
        );

    }

}
// ============================================================
// 12. MAP CLICK
// ============================================================

// ============================================================
// COMMENTS
// ============================================================

// Current experience whose comments are displayed
let currentCommentsExperienceId = null;
let currentComments = [];


// ============================================================
// COMMENT DOM ELEMENTS
// ============================================================

const commentsList =
    document.getElementById("comments-list");

const commentsCount =
    document.getElementById("comments-count");

const commentsLoading =
    document.getElementById("comments-loading");

const commentInput =
    document.getElementById("comment-input");

const submitCommentBtn =
    document.getElementById("submit-comment-btn");

const commentLoginMessage =
    document.getElementById("comment-login-message");


// ============================================================
// GET COMMENTS
// ============================================================

async function loadComments(experienceId) {

    if (!commentsList) {
        return;
    }

    currentCommentsExperienceId =
        experienceId;


    // --------------------------------------------------------
    // Show loading state
    // --------------------------------------------------------

    commentsList.innerHTML = "";

    const loadingElement =
        document.createElement("div");

    loadingElement.className =
        "comments-message";

    loadingElement.textContent =
        "Loading comments...";

    commentsList.appendChild(
        loadingElement
    );


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/experiences/${experienceId}/comments`
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Comments API response:",
                errorText
            );

            throw new Error(
                `HTTP error: ${response.status}`
            );
        }


        const comments =
            await response.json();

        currentComments =
            Array.isArray(comments)
                ? comments
                : [];
        // ----------------------------------------------------
        // Update count
        // ----------------------------------------------------

        if (commentsCount) {

            commentsCount.textContent =
                comments.length;
        }


        // ----------------------------------------------------
        // Empty state
        // ----------------------------------------------------

        if (comments.length === 0) {

            commentsList.innerHTML = "";

            const emptyElement =
                document.createElement("div");

            emptyElement.className =
                "comments-message";

            emptyElement.textContent =
                "No comments yet. Be the first to comment.";

            commentsList.appendChild(
                emptyElement
            );

            return;
        }


        // ----------------------------------------------------
        // Build comment tree
        // ----------------------------------------------------

        renderComments(comments);

    }

    catch (error) {

        console.error(
            "Failed to load comments:",
            error
        );


        commentsList.innerHTML = "";

        const errorElement =
            document.createElement("div");

        errorElement.className =
            "comments-message comments-error";

        errorElement.textContent =
            "Unable to load comments.";

        commentsList.appendChild(
            errorElement
        );

    }

}

// ============================================================
// RENDER COMMENTS
// ============================================================

function renderComments(comments) {

    commentsList.innerHTML = "";

    // --------------------------------------------------------
    // Separate root comments and replies
    // --------------------------------------------------------

    const rootComments =
        comments.filter(
            function (comment) {

                return (
                    comment.parent_comment_id === null
                );

            }
        );


    // --------------------------------------------------------
    // Build reply map
    // --------------------------------------------------------

    const repliesMap = {};


    comments.forEach(
        function (comment) {

            if (
                comment.parent_comment_id !== null
            ) {

                if (
                    !repliesMap[
                        comment.parent_comment_id
                    ]
                ) {

                    repliesMap[
                        comment.parent_comment_id
                    ] = [];

                }


                repliesMap[
                    comment.parent_comment_id
                ].push(
                    comment
                );

            }

        }
    );


    // --------------------------------------------------------
    // Render each root comment
    // --------------------------------------------------------

    rootComments.forEach(
        function (comment) {

            renderComment(
                comment,
                repliesMap,
                0
            );

        }
    );

}


// ============================================================
// RENDER ONE COMMENT
// ============================================================

function renderComment(
    comment,
    repliesMap,
    depth
) {

    const commentElement =
        document.createElement("div");


    commentElement.className =
        "comment-item";


    if (depth > 0) {

        commentElement.classList.add(
            "reply"
        );

    }


    commentElement.dataset.commentId =
        comment.id;

    // --------------------------------------------------------
    // Header
    // --------------------------------------------------------

    const header =
        document.createElement("div");

    header.className =
        "comment-header";


    const author =
        document.createElement("span");

    author.className =
        "comment-author";

    author.textContent =
        `User ${comment.user_id.substring(0, 8)}`;


    const date =
        document.createElement("span");

    date.className =
        "comment-date";

    const createdAt =
        new Date(comment.created_at);

    const updatedAt =
        new Date(comment.updated_at);

    const hasValidCreatedAt =
        !Number.isNaN(
            createdAt.getTime()
        );

    const hasValidUpdatedAt =
        !Number.isNaN(
            updatedAt.getTime()
        );

    // The backend currently returns both timestamps.
    // We use a small tolerance because created_at and
    // updated_at can differ by milliseconds when a comment
    // is first created.
    const wasEdited =
        hasValidCreatedAt &&
        hasValidUpdatedAt &&
        (
            updatedAt.getTime() -
            createdAt.getTime()
        ) > 1000;

    if (wasEdited) {

        date.textContent =
            `Edited · ${formatCommentDate(
                comment.updated_at
            )}`;

    }
    else {

        date.textContent =
            formatCommentDate(
                comment.created_at
            );

    }


    header.appendChild(author);
    header.appendChild(date);


    // --------------------------------------------------------
    // Content
    // --------------------------------------------------------

    const content =
        document.createElement("p");

    content.className =
        "comment-content";

    content.textContent =
        comment.content;


    // --------------------------------------------------------
    // Actions
    // --------------------------------------------------------

    const actions =
        document.createElement("div");

    actions.className =
        "comment-actions";


    // Reply
    const replyButton =
        document.createElement("button");

    replyButton.type =
        "button";

    replyButton.className =
        "comment-action-btn";

    replyButton.textContent =
        "Reply";


    replyButton.addEventListener(
        "click",
        function () {

            toggleReplyForm(
                commentElement,
                comment.id
            );

        }
    );


    actions.appendChild(
        replyButton
    );


    // --------------------------------------------------------
    // Edit/Delete only for owner
    // --------------------------------------------------------

    if (
        isCommentOwner(comment.user_id)
    ) {

        const editButton =
            document.createElement("button");

        editButton.type =
            "button";

        editButton.className =
            "comment-action-btn";

        editButton.textContent =
            "Edit";


        editButton.addEventListener(
            "click",
            function () {

                showEditCommentForm(
                    commentElement,
                    comment
                );

            }
        );


        actions.appendChild(
            editButton
        );


        const deleteButton =
            document.createElement("button");

        deleteButton.type =
            "button";

        deleteButton.className =
            "comment-action-btn";

        deleteButton.textContent =
            "Delete";


        deleteButton.addEventListener(
            "click",
            function () {

                deleteComment(
                    comment.id
                );

            }
        );


        actions.appendChild(
            deleteButton
        );

    }


    // --------------------------------------------------------
    // Reply form
    // --------------------------------------------------------

    const replyForm =
        createReplyForm(
            comment.id
        );


    // --------------------------------------------------------
    // Edit form
    // --------------------------------------------------------

    const editForm =
        createEditCommentForm(
            comment
        );


    // --------------------------------------------------------
    // Assemble comment
    // --------------------------------------------------------

    commentElement.appendChild(
        header
    );

    commentElement.appendChild(
        content
    );

    commentElement.appendChild(
        actions
    );

    commentElement.appendChild(
        replyForm
    );

    commentElement.appendChild(
        editForm
    );


    commentsList.appendChild(
        commentElement
    );


    // --------------------------------------------------------
    // Render replies recursively
    // --------------------------------------------------------

    const replies =
        repliesMap[comment.id] || [];


    replies.forEach(
        function (reply) {

            renderComment(
                reply,
                repliesMap,
                depth + 1
            );

        }
    );

}


// ============================================================
// CHECK COMMENT OWNERSHIP
// ============================================================

function isCommentOwner(
    commentUserId
) {

    /*
     * At the moment the backend CommentResponse
     * returns user_id but not username.
     *
     * We decode the JWT only to compare the
     * current user's ID.
     */

    const token =
        typeof getAccessToken === "function"
            ? getAccessToken()
            : null;


    if (!token) {
        return false;
    }


    try {

        const payload =
            JSON.parse(
                atob(
                    token.split(".")[1]
                )
            );


        return (
            String(payload.sub) ===
            String(commentUserId)
        );

    }

    catch (error) {

        console.error(
            "Unable to determine comment ownership:",
            error
        );

        return false;
    }

}


// ============================================================
// FORMAT COMMENT DATE
// ============================================================

function formatCommentDate(
    dateString
) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(dateString);


    if (Number.isNaN(
        date.getTime()
    )) {

        return "";
    }


    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// ============================================================
// CREATE REPLY FORM
// ============================================================

function createReplyForm(
    parentCommentId
) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "reply-form";


    const textarea =
        document.createElement("textarea");

    textarea.className =
        "reply-input";

    textarea.maxLength =
        5000;

    textarea.placeholder =
        "Write a reply...";


    const actions =
        document.createElement("div");

    actions.className =
        "reply-actions";


    const cancelButton =
        document.createElement("button");

    cancelButton.type =
        "button";

    cancelButton.className =
        "reply-cancel-btn";

    cancelButton.textContent =
        "Cancel";


    cancelButton.addEventListener(
        "click",
        function () {

            wrapper.classList.remove(
                "active"
            );

            textarea.value = "";

        }
    );


    const submitButton =
        document.createElement("button");

    submitButton.type =
        "button";

    submitButton.className =
        "reply-submit-btn";

    submitButton.textContent =
        "Reply";


    submitButton.addEventListener(
        "click",
        async function () {

            const content =
                textarea.value.trim();


            if (!content) {

                textarea.focus();

                return;
            }


            await createComment(
                content,
                parentCommentId,
                submitButton
            );

        }
    );


    actions.appendChild(
        cancelButton
    );

    actions.appendChild(
        submitButton
    );


    wrapper.appendChild(
        textarea
    );

    wrapper.appendChild(
        actions
    );


    return wrapper;
}


// ============================================================
// TOGGLE REPLY FORM
// ============================================================

function toggleReplyForm(
    commentElement,
    commentId
) {

    if (!isLoggedIn()) {

        if (
            typeof openSignInModal ===
            "function"
        ) {

            openSignInModal();

        }

        return;
    }


    const form =
        commentElement.querySelector(
            ".reply-form"
        );


    if (!form) {
        return;
    }


    form.classList.toggle(
        "active"
    );


    if (
        form.classList.contains(
            "active"
        )
    ) {

        const input =
            form.querySelector(
                ".reply-input"
            );

        if (input) {
            input.focus();
        }
    }

}


// ============================================================
// CREATE COMMENT / REPLY
// ============================================================

async function createComment(
    content,
    parentCommentId = null,
    submitButton = null
) {

    if (!isLoggedIn()) {

        if (
            typeof openSignInModal ===
            "function"
        ) {

            openSignInModal();

        }

        return;
    }


    if (!currentCommentsExperienceId) {

        console.error(
            "No experience selected for comment."
        );

        return;
    }


    const originalText =
        submitButton
            ? submitButton.textContent
            : "";


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Posting...";
    }


    try {

        const response =
            await authenticatedFetch(
                `${API_BASE_URL}/experiences/${currentCommentsExperienceId}/comments`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        content:
                            content,

                        parent_comment_id:
                            parentCommentId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                `HTTP error: ${response.status}`
            );
        }


        console.log(
            "Comment created:",
            data
        );


        // Reload comments so the new
        // comment/reply is shown correctly.
        await loadComments(
            currentCommentsExperienceId
        );


        // Clear main comment input
        if (
            !parentCommentId &&
            commentInput
        ) {

            commentInput.value = "";
        }

    }

    catch (error) {

        console.error(
            "Failed to create comment:",
            error
        );

        alert(
            error.message ||
            "Unable to post comment."
        );

    }

    finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                originalText ||
                "Reply";
        }

    }

}


// ============================================================
// CREATE MAIN COMMENT
// ============================================================

if (submitCommentBtn) {

    submitCommentBtn.addEventListener(
        "click",
        async function () {

            if (!isLoggedIn()) {

                if (
                    typeof openSignInModal ===
                    "function"
                ) {

                    openSignInModal();

                }

                return;
            }


            const content =
                commentInput
                    ? commentInput.value.trim()
                    : "";


            if (!content) {

                if (commentInput) {
                    commentInput.focus();
                }

                return;
            }


            await createComment(
                content,
                null,
                submitCommentBtn
            );

        }
    );

}


// ============================================================
// EDIT COMMENT FORM
// ============================================================

function createEditCommentForm(
    comment
) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "edit-comment-form";


    const textarea =
        document.createElement("textarea");

    textarea.className =
        "edit-comment-input";

    textarea.maxLength =
        5000;

    textarea.value =
        comment.content;


    const actions =
        document.createElement("div");

    actions.className =
        "edit-comment-actions";


    const cancelButton =
        document.createElement("button");

    cancelButton.type =
        "button";

    cancelButton.className =
        "edit-cancel-btn";

    cancelButton.textContent =
        "Cancel";


    cancelButton.addEventListener(
        "click",
        function () {

            wrapper.classList.remove(
                "active"
            );

            textarea.value =
                comment.content;

        }
    );


    const saveButton =
        document.createElement("button");

    saveButton.type =
        "button";

    saveButton.className =
        "edit-save-btn";

    saveButton.textContent =
        "Save";


    saveButton.addEventListener(
        "click",
        async function () {

            const content =
                textarea.value.trim();


            if (!content) {

                textarea.focus();

                return;
            }


            await updateComment(
                comment.id,
                content,
                saveButton
            );

        }
    );


    actions.appendChild(
        cancelButton
    );

    actions.appendChild(
        saveButton
    );


    wrapper.appendChild(
        textarea
    );

    wrapper.appendChild(
        actions
    );


    return wrapper;
}


// ============================================================
// SHOW EDIT FORM
// ============================================================

function showEditCommentForm(
    commentElement,
    comment
) {

    const form =
        commentElement.querySelector(
            ".edit-comment-form"
        );


    if (!form) {
        return;
    }


    form.classList.add(
        "active"
    );


    const input =
        form.querySelector(
            ".edit-comment-input"
        );


    if (input) {

        input.value =
            comment.content;

        input.focus();
    }

}


// ============================================================
// UPDATE COMMENT
// ============================================================

async function updateComment(
    commentId,
    content,
    saveButton
) {

    if (!isLoggedIn()) {

        if (
            typeof openSignInModal ===
            "function"
        ) {

            openSignInModal();

        }

        return;
    }


    const originalText =
        saveButton.textContent;


    saveButton.disabled =
        true;

    saveButton.textContent =
        "Saving...";


    try {

        const response =
            await authenticatedFetch(
                `${API_BASE_URL}/experiences/comments/${commentId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        content:
                            content
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                `HTTP error: ${response.status}`
            );
        }

        await loadComments(
            currentCommentsExperienceId
        );

    }

    catch (error) {

        console.error(
            "Failed to update comment:",
            error
        );

        alert(
            error.message ||
            "Unable to update comment."
        );

    }

    finally {

        saveButton.disabled =
            false;

        saveButton.textContent =
            originalText;
    }

}

// ============================================================
// DELETE COMMENT
// ============================================================

async function deleteComment(
    commentId
) {

    if (!isLoggedIn()) {

        if (
            typeof openSignInModal ===
            "function"
        ) {

            openSignInModal();

        }

        return;
    }


    const confirmed =
        window.confirm(
            "Delete this comment?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await authenticatedFetch(
                `${API_BASE_URL}/experiences/comments/${commentId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                `HTTP error: ${response.status}`
            );

        }


        console.log(
            "Comment deleted:",
            data
        );


        await loadComments(
            currentCommentsExperienceId
        );

    }

    catch (error) {

        console.error(
            "Failed to delete comment:",
            error
        );

        alert(
            error.message ||
            "Unable to delete comment."
        );

    }

}

// ============================================================
// COMMENT LOGIN STATE
// ============================================================

function updateCommentAuthenticationUI() {

    if (
        !commentInput ||
        !submitCommentBtn ||
        !commentLoginMessage
    ) {

        return;
    }


    if (isLoggedIn()) {

        commentInput.disabled =
            false;

        submitCommentBtn.disabled =
            false;

        commentInput.placeholder =
            "Share your thoughts...";

        commentLoginMessage.textContent =
            "";

    } else {

        commentInput.disabled =
            true;

        submitCommentBtn.disabled =
            false;

        commentInput.placeholder =
            "Sign in to comment";

        commentLoginMessage.textContent =
            "You need to sign in to comment.";

    }

}


// ============================================================
// UPDATE COMMENT UI WHEN AUTH STATE CHANGES
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    updateCommentAuthenticationUI
);

map.getViewport().addEventListener(
    "click",
    function () {
        console.log("MAP HTML CLICK RECEIVED");
    }
);

map.on(
    "singleclick",
    function (event) {


        // ----------------------------------------------------
        // Selecting location for new experience
        // ----------------------------------------------------

        if (
            isSelectingLocation
        ) {

            selectExperienceLocation(
                event.coordinate
            );

            return;

        }


        // ----------------------------------------------------
        // Find feature
        // ----------------------------------------------------

        const feature =
            map.forEachFeatureAtPixel(
                event.pixel,
                function (feature) {

                    return feature;

                }
            );


        // ----------------------------------------------------
        // Nothing clicked
        // ----------------------------------------------------

        if (!feature) {

            popup.style.display =
                "none";

            return;

        }


        // ----------------------------------------------------
        // Get information
        // ----------------------------------------------------

        const title =
            feature.get("title");


        const story =
            feature.get("story");


        const emotion =
            feature.get("emotion");

        const experienceId =
            feature.get("id");
        // ----------------------------------------------------
        // Update popup
        // ----------------------------------------------------

        popupTitle.textContent =
            title ||
            "Untitled Experience";


        popupStory.textContent =
            story ||
            "No story available.";

        currentCommentsExperienceId =
            currentPopupExperienceId;

        loadComments(
            currentCommentsExperienceId
        );

        updateCommentAuthenticationUI();

        // ----------------------------------------------------
        // Save current experience
        // ----------------------------------------------------

        currentPopupExperienceId =
            experienceId;

        


        // ----------------------------------------------------
        // Load like information
        // ----------------------------------------------------

        if (experienceId) {

            loadLikeInformation(
                experienceId
            );

        }
        // ----------------------------------------------------
        // Position popup
        // ----------------------------------------------------

        const coordinate =
            event.coordinate;


        const pixel =
            map.getPixelFromCoordinate(
                coordinate
            );


        popup.style.left =
            `${pixel[0] + 15}px`;


        popup.style.top =
            `${pixel[1] - 15}px`;


        // ----------------------------------------------------
        // Show popup
        // ----------------------------------------------------

        popup.style.display =
            "block";


        // ----------------------------------------------------
        // Console
        // ----------------------------------------------------

        console.log(
            "Clicked experience:"
        );


        console.log({

            title: title,

            story: story,

            emotion: emotion

        });

    }
);


// ============================================================
// 13. CLOSE POPUP
// ============================================================

popupClose.addEventListener(
    "click",
    function () {

        popup.style.display =
            "none";

    }
);

// ============================================================
// LIKE BUTTON
// ============================================================

popupLikeBtn.addEventListener(
    "click",
    async function () {

        if (
            !currentPopupExperienceId
        ) {

            return;

        }


        const isLiked =
            popupLikeBtn.classList.contains(
                "liked"
            );


        if (isLiked) {

            await unlikeExperience(
                currentPopupExperienceId
            );

        }
        else {

            await likeExperience(
                currentPopupExperienceId
            );

        }

    }
);


// ============================================================
// 14. FORM ELEMENTS
// ============================================================

const addExperienceBtn =
    document.getElementById(
        "add-experience-btn"
    );


const experienceFormOverlay =
    document.getElementById(
        "experience-form-overlay"
    );


const closeExperienceForm =
    document.getElementById(
        "close-experience-form"
    );


const cancelExperienceBtn =
    document.getElementById(
        "cancel-experience"
    );


const experienceForm =
    document.getElementById(
        "experience-form"
    );


// ============================================================
// 15. START LOCATION SELECTION
// ============================================================

addExperienceBtn.addEventListener(
    "click",
    function () {


        // ----------------------------------------------------
        // Start location selection
        // ----------------------------------------------------

        isSelectingLocation =
            true;


        // ----------------------------------------------------
        // Button text
        // ----------------------------------------------------

        addExperienceBtn.textContent =
            "Click a location on the map";


        // ----------------------------------------------------
        // Cursor
        // ----------------------------------------------------

        map.getTargetElement().style.cursor =
            "crosshair";


        // ----------------------------------------------------
        // Close popup
        // ----------------------------------------------------

        popup.style.display =
            "none";


        console.log(
            "Location selection started."
        );


        console.log(
            "Click a location on the map."
        );

    }
);


// ============================================================
// 16. SELECT LOCATION
// ============================================================

function selectExperienceLocation(
    coordinate
) {


    // --------------------------------------------------------
    // Convert coordinate
    // --------------------------------------------------------

    const lonLat =
        ol.proj.toLonLat(
            coordinate
        );


    // --------------------------------------------------------
    // Save longitude
    // --------------------------------------------------------

    selectedLongitude =
        lonLat[0];


    // --------------------------------------------------------
    // Save latitude
    // --------------------------------------------------------

    selectedLatitude =
        lonLat[1];


    // --------------------------------------------------------
    // Console
    // --------------------------------------------------------

    console.log(
        "Selected location:"
    );


    console.log({

        longitude:
            selectedLongitude,

        latitude:
            selectedLatitude

    });


    // --------------------------------------------------------
    // Stop selection
    // --------------------------------------------------------

    isSelectingLocation =
        false;


    // --------------------------------------------------------
    // Restore button
    // --------------------------------------------------------

    addExperienceBtn.textContent =
        "+ Add Experience";


    // --------------------------------------------------------
    // Restore cursor
    // --------------------------------------------------------

    map.getTargetElement().style.cursor =
        "";


    // --------------------------------------------------------
    // Open form
    // --------------------------------------------------------

    experienceFormOverlay.classList.add(
        "active"
    );

}


// ============================================================
// 17. CLOSE FORM
// ============================================================

closeExperienceForm.addEventListener(
    "click",
    function () {

        closeExperienceFormAndReset();

    }
);


// ============================================================
// 18. CANCEL FORM
// ============================================================

cancelExperienceBtn.addEventListener(
    "click",
    function () {

        closeExperienceFormAndReset();

    }
);


// ============================================================
// 19. CLICK OUTSIDE FORM
// ============================================================

experienceFormOverlay.addEventListener(
    "click",
    function (event) {

        if (
            event.target ===
            experienceFormOverlay
        ) {

            closeExperienceFormAndReset();

        }

    }
);


// ============================================================
// 20. CLOSE FORM AND RESET
// ============================================================

function closeExperienceFormAndReset() {


    // --------------------------------------------------------
    // Hide form
    // --------------------------------------------------------

    experienceFormOverlay.classList.remove(
        "active"
    );


    // --------------------------------------------------------
    // Reset form
    // --------------------------------------------------------

    experienceForm.reset();


    // --------------------------------------------------------
    // Clear coordinates
    // --------------------------------------------------------

    selectedLongitude =
        null;


    selectedLatitude =
        null;


    // --------------------------------------------------------
    // Stop location selection
    // --------------------------------------------------------

    isSelectingLocation =
        false;


    // --------------------------------------------------------
    // Restore button
    // --------------------------------------------------------

    addExperienceBtn.textContent =
        "+ Add Experience";


    // --------------------------------------------------------
    // Restore cursor
    // --------------------------------------------------------

    map.getTargetElement().style.cursor =
        "";

}


// ============================================================
// 21. SUBMIT EXPERIENCE
// ============================================================

experienceForm.addEventListener(
    "submit",
    async function (event) {


        // ----------------------------------------------------
        // Prevent normal submission
        // ----------------------------------------------------

        event.preventDefault();


        // ----------------------------------------------------
        // Get title
        // ----------------------------------------------------

        const title =
            document.getElementById(
                "experience-title"
            ).value.trim();


        // ----------------------------------------------------
        // Get story
        // ----------------------------------------------------

        const story =
            document.getElementById(
                "experience-description"
            ).value.trim();


        // ----------------------------------------------------
        // Get emotion
        // ----------------------------------------------------

        const emotion =
            document.getElementById(
                "experience-emotion"
            ).value;


        // ----------------------------------------------------
        // Check location
        // ----------------------------------------------------

        if (
            selectedLongitude === null ||
            selectedLatitude === null
        ) {

            console.error(
                "No location selected."
            );

            return;

        }


        // ====================================================
        // EXPERIENCE OBJECT
        // ====================================================

        const experience = {

            title:
                title,

            story:
                story,

            emotion:
                emotion,

            latitude:
                selectedLatitude,

            longitude:
                selectedLongitude

        };


        // ----------------------------------------------------
        // Console
        // ----------------------------------------------------

        console.log(
            "Sending experience to API:"
        );


        console.log(
            experience
        );


        console.log(
            "Selected emotion:",
            emotion
        );


        // ====================================================
        // SEND TO API
        // ====================================================

        try {

            const response =
                await authenticatedFetch(
                    "http://127.0.0.1:8000/api/experiences/",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(
                                experience
                            )

                    }
                );


            // ------------------------------------------------
            // Check response
            // ------------------------------------------------

            if (!response.ok) {

                const errorText =
                    await response.text();


                console.error(
                    "FastAPI response:",
                    errorText
                );


                throw new Error(
                    `HTTP error: ${response.status}`
                );

            }


            // ------------------------------------------------
            // Read response
            // ------------------------------------------------

            const result =
                await response.json();


            // ------------------------------------------------
            // Success
            // ------------------------------------------------

            console.log(
                "Experience created successfully:"
            );


            console.log(
                result
            );


            // ------------------------------------------------
            // Close form
            // ------------------------------------------------

            closeExperienceFormAndReset();


            // ------------------------------------------------
            // Reload experiences
            // ------------------------------------------------

            await loadExperiences();

        }

        catch (error) {

            console.error(
                "Failed to create experience:",
                error
            );

        }

    }
);


// ============================================================
// 22. EMOTION LEGEND ELEMENTS
// ============================================================

const legendItems =
    document.querySelectorAll(
        ".legend-item"
    );


const legendToggle =
    document.getElementById(
        "legend-toggle"
    );


const legendContent =
    document.getElementById(
        "legend-content"
    );


// ============================================================
// 23. EMOTION FILTER
// ============================================================

legendItems.forEach(
    function (item) {

        item.addEventListener(
            "click",
            function () {


                // ------------------------------------------------
                // Get clicked emotion
                // ------------------------------------------------

                const clickedEmotion =
                    item.dataset.emotion;


                // =================================================
                // CLICK ALL
                // =================================================

                if (
                    clickedEmotion ===
                    "all"
                ) {

                    activeEmotionFilter =
                        "all";

                }


                // =================================================
                // CLICK SAME EMOTION TWICE
                // =================================================

                else if (
                    activeEmotionFilter ===
                    clickedEmotion
                ) {

                    activeEmotionFilter =
                        "all";

                }


                // =================================================
                // CLICK DIFFERENT EMOTION
                // =================================================

                else {

                    activeEmotionFilter =
                        clickedEmotion;

                }


                // =================================================
                // REMOVE ACTIVE CLASS
                // =================================================

                legendItems.forEach(
                    function (legendItem) {

                        legendItem.classList.remove(
                            "active"
                        );

                    }
                );


                // =================================================
                // ACTIVATE CURRENT FILTER
                // =================================================

                legendItems.forEach(
                    function (legendItem) {

                        if (
                            legendItem.dataset.emotion ===
                            activeEmotionFilter
                        ) {

                            legendItem.classList.add(
                                "active"
                            );

                        }

                    }
                );


                // =================================================
                // REDRAW MAP
                // =================================================

                vectorLayer.changed();


                // =================================================
                // CLOSE POPUP
                // =================================================

                popup.style.display =
                    "none";


                // =================================================
                // CONSOLE
                // =================================================

                console.log(
                    "Active emotion filter:",
                    activeEmotionFilter
                );

            }
        );

    }
);


// ============================================================
// 24. LEGEND TOGGLE
// ============================================================

if (
    legendToggle &&
    legendContent
) {

    legendToggle.addEventListener(
        "click",
        function (event) {


            // ------------------------------------------------
            // Prevent event propagation
            // ------------------------------------------------

            event.stopPropagation();


            // ------------------------------------------------
            // Toggle hidden state
            // ------------------------------------------------

            legendContent.classList.toggle(
                "hidden"
            );


            // ------------------------------------------------
            // Determine state
            // ------------------------------------------------

            const isHidden =
                legendContent.classList.contains(
                    "hidden"
                );


            // ------------------------------------------------
            // Update button
            // ------------------------------------------------

            if (
                isHidden
            ) {

                legendToggle.textContent =
                    "+";


                legendToggle.setAttribute(
                    "aria-label",
                    "Show emotion legend"
                );

            }

            else {

                legendToggle.textContent =
                    "−";


                legendToggle.setAttribute(
                    "aria-label",
                    "Hide emotion legend"
                );

            }


            // ------------------------------------------------
            // Console
            // ------------------------------------------------

            console.log(
                "Emotion legend hidden:",
                isHidden
            );

        }
    );

}