// ============================================================
// PLACEFUL — place sidebar
// Depends on: api.js, map.js
// ============================================================

const placeSidebar =
    document.getElementById("place-sidebar");

const placeSidebarClose =
    document.getElementById("place-sidebar-close");

const placeSidebarTitle =
    document.getElementById("place-sidebar-title");

const placeSidebarCategory =
    document.getElementById("place-sidebar-category");

const placeSidebarLocation =
    document.getElementById("place-sidebar-location");

const placeSidebarExperienceCount =
    document.getElementById(
        "place-sidebar-experience-count"
    );

const placeSidebarExperiences =
    document.getElementById(
        "place-sidebar-experiences"
    );


// ----------------------------------------------------------
// OPEN
// ----------------------------------------------------------

function openPlaceSidebar(placeFeature) {

    if (!placeSidebar || !placeFeature) {
        return;
    }

    const placeId =
        placeFeature.get("id");

    const name =
        placeFeature.get("name");

    const category =
        placeFeature.get("category");

    const address =
        placeFeature.get("address");

    const city =
        placeFeature.get("city");

    const country =
        placeFeature.get("country");

    const experienceCount =
        placeFeature.get("experience_count");


    placeSidebar.dataset.placeId =
        String(placeId);


    if (placeSidebarTitle) {
        placeSidebarTitle.textContent =
            name || "Place";
    }


    if (placeSidebarCategory) {

        if (category) {

            placeSidebarCategory.textContent =
                category;

            placeSidebarCategory.hidden =
                false;

        } else {

            placeSidebarCategory.textContent =
                "";

            placeSidebarCategory.hidden =
                true;
        }
    }


    if (placeSidebarLocation) {

        const locationParts = [];

        if (address) {
            locationParts.push(address);
        }

        if (city) {
            locationParts.push(city);
        }

        if (country) {
            locationParts.push(country);
        }

        if (locationParts.length) {

            placeSidebarLocation.textContent =
                locationParts.join(", ");

            placeSidebarLocation.hidden =
                false;

        } else {

            placeSidebarLocation.textContent =
                "";

            placeSidebarLocation.hidden =
                true;
        }
    }


    if (placeSidebarExperienceCount) {

        placeSidebarExperienceCount.textContent =
            experienceCount || 0;
    }


    placeSidebar.classList.add("open");

    placeSidebar.setAttribute(
        "aria-hidden",
        "false"
    );


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

    // Avoid aria-hidden on an ancestor of the focused element
    if (placeSidebar.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    placeSidebar.classList.remove("open");

    placeSidebar.setAttribute(
        "aria-hidden",
        "true"
    );

    delete placeSidebar.dataset.placeId;

    if (typeof map !== "undefined") {
        map.updateSize();
    }
}


// ----------------------------------------------------------
// LOAD PLACE EXPERIENCES
// ----------------------------------------------------------

async function loadPlaceExperiences(placeId) {

    if (!placeSidebarExperiences) {
        return;
    }

    placeSidebarExperiences.innerHTML = "";

    const loading =
        document.createElement("div");

    loading.className =
        "comments-message";

    loading.textContent =
        "Loading experiences...";

    placeSidebarExperiences.appendChild(
        loading
    );


    try {

        const response = await apiFetch(
            API_BASE_URL +
            "/places/" +
            placeId +
            "/experiences"
        );


        if (!response.ok) {
            throw new Error(
                "HTTP error: " +
                response.status
            );
        }


        const geojson =
            await response.json();


        const features =
            new ol.format.GeoJSON().readFeatures(
                geojson,
                {
                    featureProjection:
                        "EPSG:3857"
                }
            );


        placeSidebarExperiences.innerHTML = "";


        if (!features.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "comments-message";

            empty.textContent =
                "No experiences yet.";

            placeSidebarExperiences.appendChild(
                empty
            );

            return;
        }


        features.forEach(
            function (feature) {

                const item =
                    document.createElement("div");

                item.className =
                    "place-experience-item";

                item.setAttribute(
                    "role",
                    "button"
                );

                item.setAttribute(
                    "tabindex",
                    "0"
                );


                const displayName =
                    feature.get("display_name") ||
                    "Unknown user";

                const profileImageUrl =
                    feature.get("profile_image_url") ||
                    "";

                const title =
                    feature.get("title") ||
                    "Untitled Experience";

                const story =
                    feature.get("story") ||
                    "";


                const content =
                    document.createElement("div");

                content.className =
                    "place-experience-content";


                const profileImage =
                    document.createElement("img");

                profileImage.className =
                    "place-experience-avatar";

                profileImage.alt =
                    displayName;

                if (profileImageUrl) {

                    profileImage.src =
                        profileImageUrl;

                } else {

                    profileImage.hidden =
                        true;
                }


                const textContainer =
                    document.createElement("div");

                textContainer.className =
                    "place-experience-text";

                const userId =
                    feature.get("user_id");

                const username =
                    feature.get("username") ||
                    "";



                const authorRow =
                    document.createElement("div");

                authorRow.className =
                    "place-experience-author";



                if (username && userId) {

                    const usernameElement =
                        document.createElement("button");

                    usernameElement.type =
                        "button";

                    usernameElement.className =
                        "place-experience-username";

                    usernameElement.textContent =
                        "@" + username;


                    usernameElement.addEventListener(
                        "click",
                        function (event) {

                            event.stopPropagation();

                            closePlaceSidebar();

                            if (
                                typeof openUserProfile ===
                                "function"
                            ) {
                                openUserProfile(
                                    userId
                                );
                            }
                        }
                    );


                    authorRow.appendChild(
                        usernameElement
                    );
                }



if (username && userId) {

    const separator =
        document.createElement("span");

    separator.className =
        "place-experience-author-separator";

    separator.textContent =
        " · ";

    authorRow.appendChild(
        separator
    );
}



const displayNameElement =
    document.createElement("span");

displayNameElement.className =
    "place-experience-display-name";

displayNameElement.textContent =
    displayName;


authorRow.appendChild(
    displayNameElement
);



const titleElement =
    document.createElement("div");

titleElement.className =
    "place-experience-title";

titleElement.textContent =
    title;



const storyElement =
    document.createElement("div");

storyElement.className =
    "place-experience-story";

storyElement.textContent =
    story;



textContainer.appendChild(
    authorRow
);

textContainer.appendChild(
    titleElement
);

if (story) {

    textContainer.appendChild(
        storyElement
    );
}


                content.appendChild(
                    profileImage
                );

                content.appendChild(
                    textContainer
                );

                item.appendChild(
                    content
                );


                item.addEventListener(
                    "click",
                    function () {

                        closePlaceSidebar();

                        if (
                            typeof closeProfileSidebar ===
                            "function"
                        ) {
                            closeProfileSidebar();
                        }


                        if (
                            typeof openExperienceSidebar ===
                            "function"
                        ) {
                            openExperienceSidebar(
                                feature
                            );
                        }
                    }
                );

                item.addEventListener(
                    "keydown",
                    function (event) {

                        if (
                            event.key === "Enter" ||
                            event.key === " "
                        ) {

                            event.preventDefault();

                            item.click();
                        }
                    }
                );


                placeSidebarExperiences.appendChild(
                    item
                );

            }
        );

    } catch (error) {

        console.error(
            "Failed to load place experiences:",
            error
        );


        placeSidebarExperiences.innerHTML = "";

        const errorElement =
            document.createElement("div");

        errorElement.className =
            "comments-message comments-error";

        errorElement.textContent =
            "Unable to load experiences.";

        placeSidebarExperiences.appendChild(
            errorElement
        );
    }
}


// ----------------------------------------------------------
// CLOSE BUTTON
// ----------------------------------------------------------

if (placeSidebarClose) {

    placeSidebarClose.addEventListener(
        "click",
        closePlaceSidebar
    );
}


// ----------------------------------------------------------
// GLOBAL
// ----------------------------------------------------------

window.openPlaceSidebar =
    openPlaceSidebar;

window.closePlaceSidebar =
    closePlaceSidebar;