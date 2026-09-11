/* ============================================================
   PLACEFUL — EXPERIENCE CREATION
   ============================================================

   Responsibilities:

   1. Start experience creation
   2. Select exact experience location
   3. Identify nearby OSM places
   4. Search for another nearby OSM place
   5. Let user select a Place
   6. Create/reuse persistent Place
   7. Create a user-defined Placeful Place
   8. Store selected Place ID
   9. Submit Experience with:
        - place_id
        - exact experience location
        - title
        - story
        - emotion
        - visibility
        - anonymity

   Depends on:

   - map.js
   - api.js
   - auth.js

   ============================================================ */


/* ============================================================
   1. DOM ELEMENTS
   ============================================================ */

const selectedLocationLabel =
    document.getElementById(
        "selected-location-label"
    );


const selectedPlaceLabel =
    document.getElementById(
        "selected-place-label"
    );


const experienceFormStatus =
    document.getElementById(
        "experience-form-status"
    );


const experienceStepLabel =
    document.getElementById(
        "experience-form-step-label"
    );


const experienceStepBack =
    document.getElementById(
        "experience-step-back"
    );


const experienceStepNext =
    document.getElementById(
        "experience-step-next"
    );


const experienceSubmitBtn =
    document.getElementById(
        "experience-submit-btn"
    );


const experienceStep1 =
    document.getElementById(
        "experience-step-1"
    );

const experienceStep2 =
    document.getElementById(
        "experience-step-2"
    );

const experienceStep3 =
    document.getElementById(
        "experience-step-3"
    );

const experienceStep4 =
    document.getElementById(
        "experience-step-4"
    );

const placeSelectionStatus =
    document.getElementById(
        "place-selection-status"
    );


/*
   IMPORTANT:

   These elements are already declared
   by map.js.

   We intentionally DO NOT redeclare:

       addExperienceBtn
       experienceFormOverlay
       closeExperienceForm
       cancelExperienceBtn
       experienceForm

   This prevents:

       Identifier has already been declared
*/


/* ============================================================
   2. EXPERIENCE CREATION STATE
   ============================================================ */

let selectedPlaceId =
    null;


let selectedPlace =
    null;


let experienceFormStep =
    1;


/*
   Search state.

   These belong only to the current
   experience being created.
*/

let placeSearchOpen =
    false;


let placeSelectionProcessing =
    false;


/* ============================================================
   3. FORM STATUS
   ============================================================ */

function setExperienceFormStatus(
    message,
    isError = false
) {

    if (!experienceFormStatus) {
        return;
    }


    experienceFormStatus.textContent =
        message || "";


    if (isError) {

        experienceFormStatus.classList.add(
            "comments-error"
        );

    }
    else {

        experienceFormStatus.classList.remove(
            "comments-error"
        );

    }

}

function setPlaceSelectionStatus(
    message
) {

    if (!placeSelectionStatus) {
        return;
    }

    placeSelectionStatus.textContent =
        message;

}


/* ============================================================
   4. UPDATE STEP UI
   ============================================================ */

function updateExperienceFormStep() {

    if (
        !experienceStep1 ||
        !experienceStep2 ||
        !experienceStep3 ||
        !experienceStep4
    ) {

        return;

    }


    experienceStep1.hidden =
        experienceFormStep !== 1;

    experienceStep2.hidden =
        experienceFormStep !== 2;

    experienceStep3.hidden =
        experienceFormStep !== 3;

    experienceStep4.hidden =
        experienceFormStep !== 4;


    /* --------------------------------------------------------
       Step label
       -------------------------------------------------------- */

    if (experienceFormStep === 1) {

        experienceStepLabel.textContent =
            "Step 1 of 4 — Place";

    }

    else if (experienceFormStep === 2) {

        experienceStepLabel.textContent =
            "Step 2 of 4 — Story";

    }

    else if (experienceFormStep === 3) {

        experienceStepLabel.textContent =
            "Step 3 of 4 — Visibility";

    }

    else {

        experienceStepLabel.textContent =
            "Step 4 of 4 — Privacy";

    }


    /* --------------------------------------------------------
       Back button
       -------------------------------------------------------- */

    experienceStepBack.hidden =
        experienceFormStep === 1;


    /* --------------------------------------------------------
       Next / Submit buttons
       -------------------------------------------------------- */

    if (experienceFormStep === 4) {

        experienceStepNext.hidden =
            true;

        experienceSubmitBtn.hidden =
            false;

    }

    else {

        experienceStepNext.hidden =
            false;

        experienceSubmitBtn.hidden =
            true;

    }

}


/* ============================================================
   5. UPDATE LOCATION LABEL
   ============================================================ */

function updateSelectedLocationLabel() {

    if (!selectedLocationLabel) {
        return;
    }


    if (
        selectedLatitude === null ||
        selectedLongitude === null
    ) {

        selectedLocationLabel.textContent =
            "";

        return;

    }


    selectedLocationLabel.textContent =
        "Experience location: " +
        selectedLatitude.toFixed(6) +
        ", " +
        selectedLongitude.toFixed(6);

}


/* ============================================================
   6. UPDATE PLACE LABEL
   ============================================================ */

function updateSelectedPlaceLabel() {

    if (!selectedPlaceLabel) {
        return;
    }


    if (!selectedPlace) {

        selectedPlaceLabel.textContent =
            "";

        selectedPlaceLabel.hidden =
            true;

        return;

    }


    const name =
        selectedPlace.name ||
        "Selected place";


    selectedPlaceLabel.textContent =
        "Place: " + name;


    selectedPlaceLabel.hidden =
        false;

}


/* ============================================================
   7. DISTANCE FORMATTER
   ============================================================ */

function formatPlaceDistance(
    distance
) {

    const numericDistance =
        Number(distance);


    if (
        !Number.isFinite(
            numericDistance
        )
    ) {

        return "";

    }


    if (
        numericDistance < 1000
    ) {

        return (
            Math.round(
                numericDistance
            ) +
            " m away"
        );

    }


    return (
        (
            numericDistance /
            1000
        ).toFixed(1) +
        " km away"
    );

}


/* ============================================================
   8. IDENTIFY PLACES
   ============================================================ */

async function identifyPlacesAtLocation(
    latitude,
    longitude
) {

    const url =
        API_BASE_URL +
        "/places/identify" +
        "?latitude=" +
        encodeURIComponent(
            latitude
        ) +
        "&longitude=" +
        encodeURIComponent(
            longitude
        );


    console.log(
        "Identifying places at:",
        {
            latitude:
                latitude,

            longitude:
                longitude
        }
    );


    const response =
        await fetch(
            url
        );


    if (!response.ok) {

        const errorText =
            await response.text();


        console.error(
            "Place identification failed:",
            errorText
        );


        throw new Error(
            "Unable to identify nearby places."
        );

    }


    const result =
        await response.json();


    console.log(
        "Place identification result:",
        result
    );


    return result;

}


/* ============================================================
   9. SEARCH PLACES
   ============================================================ */

async function searchPlaces(
    searchText
) {

    const text =
        String(
            searchText || ""
        ).trim();


    if (text.length < 2) {

        throw new Error(
            "Please enter at least 2 characters."
        );

    }


    if (
        selectedLatitude === null ||
        selectedLongitude === null
    ) {

        throw new Error(
            "No experience location has been selected."
        );

    }


    const url =
        API_BASE_URL +
        "/places/search" +
        "?q=" +
        encodeURIComponent(
            text
        ) +
        "&latitude=" +
        encodeURIComponent(
            selectedLatitude
        ) +
        "&longitude=" +
        encodeURIComponent(
            selectedLongitude
        );


    console.log(
        "Searching places:",
        {
            query:
                text,

            latitude:
                selectedLatitude,

            longitude:
                selectedLongitude
        }
    );


    const response =
        await fetch(
            url
        );


    if (!response.ok) {

        const errorText =
            await response.text();


        console.error(
            "Place search failed:",
            errorText
        );


        throw new Error(
            "Unable to search for places."
        );

    }


    const result =
        await response.json();


    console.log(
        "Place search result:",
        result
    );


    return result;

}


/* ============================================================
   10. REMOVE PLACE UI
   ============================================================ */

function removePlaceSelectionUI() {

    const existing =
        document.getElementById(
            "place-selection-panel"
        );


    if (existing) {

        existing.remove();

    }


    placeSearchOpen =
        false;

}


/* ============================================================
   11. CREATE PLACE SELECTION UI
   ============================================================ */

function createPlaceSelectionPanel() {

    if (!experienceStep1) {
        return null;
    }


    removePlaceSelectionUI();


    const panel =
        document.createElement(
            "div"
        );


    panel.id =
        "place-selection-panel";


    panel.className =
        "place-selection-panel";


    /*
       Insert the Place UI at the
       beginning of Step 1.
    */

    experienceStep1.insertBefore(
        panel,
        experienceStep1.firstChild
    );


    return panel;

}


/* ============================================================
   12. CREATE PLACE CARD
   ============================================================ */

function createPlaceCandidateCard(
    candidate,
    container
) {

    const card =
        document.createElement(
            "button"
        );


    card.type =
        "button";


    card.className =
        "choice-card";


    card.dataset.osmId =
        candidate.osm_id || "";


    const content =
        document.createElement(
            "span"
        );


    const title =
        document.createElement(
            "strong"
        );


    title.textContent =
        candidate.name ||
        "Unnamed place";


    const details =
        document.createElement(
            "small"
        );


    const parts =
        [];


    if (candidate.category) {

        parts.push(
            candidate.category
        );

    }


    if (candidate.city) {

        parts.push(
            candidate.city
        );

    }


    const distance =
        formatPlaceDistance(
            candidate.distance
        );


    if (distance) {

        parts.push(
            distance
        );

    }


    details.textContent =
        parts.join(
            " · "
        );


    content.appendChild(
        title
    );


    content.appendChild(
        details
    );


    card.appendChild(
        content
    );


    card.addEventListener(
        "click",
        async function () {

            if (
                placeSelectionProcessing
            ) {

                return;

            }


            placeSelectionProcessing =
                true;


            setExperienceFormStatus(
                "Saving selected place..."
            );


            try {

                await selectPlaceCandidate(
                    candidate
                );


                setPlaceSelectionStatus(
                    ""
                );

                experienceFormStep =
                    2;

                updateExperienceFormStep();
            }

            catch (error) {

                console.error(
                    "Failed to select Place:",
                    error
                );


                setExperienceFormStatus(
                    error.message ||
                    "Unable to save the selected place.",
                    true
                );

            }

            finally {

                placeSelectionProcessing =
                    false;

            }

        }
    );


    container.appendChild(
        card
    );

}


/* ============================================================
   13. CURRENT PLACE PANEL
   ============================================================ */

function panelForCurrentPlaceSelection() {

    return document.getElementById(
        "place-selection-panel"
    );

}


/* ============================================================
   14. SHOW PLACE CANDIDATES
   ============================================================ */

function showPlaceCandidates(
    candidates
) {

    const panel =
        createPlaceSelectionPanel();


    if (!panel) {
        return;
    }


    setPlaceSelectionStatus(
        "We found these places near your selected location. You can choose one, search for another place, create a Placeful place, or continue without linking a place."
    );


    /*
       If no candidates were found,
       show the fallback options.
    */

    if (
        !candidates ||
        candidates.length === 0
    ) {

        showNoPlaceResults(
            panel
        );


        return;

    }


    /*
       Candidate list.
    */

    const list =
        document.createElement(
            "div"
        );


    list.className =
        "choice-list";


    candidates.forEach(
        function (candidate) {

            createPlaceCandidateCard(
                candidate,
                list
            );

        }
    );


    panel.appendChild(
        list
    );


    /*
    Keep the two actions below
    the candidate results.
    */

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "place-selection-actions";


    const createButton =
        document.createElement(
            "button"
        );

    createButton.type =
        "button";

    createButton.className =
        "submit-experience-btn";

    createButton.textContent =
        "Create a Placeful place";

    createButton.addEventListener(
        "click",
        function () {

            showCreatePlaceUI();

        }
    );

    actions.appendChild(
        createButton
    );


    const skipButton =
        document.createElement(
            "button"
        );

    skipButton.type =
        "button";

    skipButton.className =
        "cancel-btn";

    skipButton.textContent =
        "Continue without a place";

    skipButton.addEventListener(
        "click",
        function () {

            selectedPlaceId =
                null;

            selectedPlace =
                null;

            updateSelectedPlaceLabel();

            experienceFormStep =
                2;

            setPlaceSelectionStatus(
                ""
            );

            updateExperienceFormStep();

        }
    );

    actions.appendChild(
        skipButton
    );


    panel.appendChild(
        actions
    );

}


/* ============================================================
   15. ADD PLACE ACTIONS
   ============================================================ */

function addPlaceActions(
    panel
) {

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "place-selection-actions";


    const searchButton =
        document.createElement(
            "button"
        );


    searchButton.type =
        "button";


    searchButton.className =
        "cancel-btn";


    searchButton.textContent =
        "Search for another place";


    searchButton.addEventListener(
        "click",
        function () {

            showPlaceSearchUI();

        }
    );


    actions.appendChild(
        searchButton
    );


    const skipButton =
        document.createElement(
            "button"
        );


    skipButton.type =
        "button";


    skipButton.className =
        "cancel-btn";


    skipButton.textContent =
        "Continue without a place";


    skipButton.addEventListener(
        "click",
        function () {

            selectedPlaceId =
                null;


            selectedPlace =
                null;


            updateSelectedPlaceLabel();


            renderNoPlaceSelectedState();

        }
    );


    actions.appendChild(
        skipButton
    );


    panel.appendChild(
        actions
    );

}


/* ============================================================
   16. SHOW NO RESULTS
   ============================================================ */

function showNoPlaceResults(
    panel
) {

    const message =
        document.createElement(
            "p"
        );


    message.className =
        "step-help";


    message.textContent =
        "No matching place was found nearby.";


    panel.appendChild(
        message
    );


    const createButton =
        document.createElement(
            "button"
        );


    createButton.type =
        "button";


    createButton.className =
        "submit-experience-btn";


    createButton.textContent =
        "Create a Placeful place";


    createButton.addEventListener(
        "click",
        function () {

            showCreatePlaceUI();

        }
    );


    panel.appendChild(
        createButton
    );


    const skipButton =
        document.createElement(
            "button"
        );


    skipButton.type =
        "button";


    skipButton.className =
        "cancel-btn";


    skipButton.textContent =
        "Continue without a place";


    skipButton.addEventListener(
        "click",
        function () {

            selectedPlaceId =
                null;


            selectedPlace =
                null;


            updateSelectedPlaceLabel();


            renderNoPlaceSelectedState();

        }
    );


    panel.appendChild(
        skipButton
    );


    const searchButton =
        document.createElement(
            "button"
        );


    searchButton.type =
        "button";


    searchButton.className =
        "cancel-btn";


    searchButton.textContent =
        "Search again";


    searchButton.addEventListener(
        "click",
        function () {

            showPlaceSearchUI();

        }
    );


    panel.appendChild(
        searchButton
    );

}


/* ============================================================
   17. SHOW SEARCH UI
   ============================================================ */

function showPlaceSearchUI() {

    const panel =
        createPlaceSelectionPanel();


    if (!panel) {
        return;
    }


    placeSearchOpen =
        true;


    const heading =
        document.createElement(
            "p"
        );


    heading.className =
        "step-help";


    heading.textContent =
        "Search for a place near your selected location";


    panel.appendChild(
        heading
    );


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.id =
        "place-search-input";


    input.className =
        "form-input";


    input.placeholder =
        "Search for a place";


    input.autocomplete =
        "off";


    panel.appendChild(
        input
    );


    const searchButton =
        document.createElement(
            "button"
        );


    searchButton.type =
        "button";


    searchButton.className =
        "submit-experience-btn";


    searchButton.textContent =
        "Search";


    panel.appendChild(
        searchButton
    );


    const backButton =
        document.createElement(
            "button"
        );


    backButton.type =
        "button";


    backButton.className =
        "cancel-btn";


    backButton.textContent =
        "Back to nearby places";


    backButton.addEventListener(
        "click",
        function () {

            placeSearchOpen =
                false;


            setExperienceFormStatus(
                "Looking for nearby places..."
            );


            identifyPlacesAtLocation(
                selectedLatitude,
                selectedLongitude
            )
                .then(
                    function (result) {

                        setExperienceFormStatus(
                            ""
                        );


                        showPlaceCandidates(
                            result.candidates ||
                            []
                        );

                    }
                )
                .catch(
                    function (error) {

                        console.error(
                            error
                        );


                        showPlaceSearchUI();


                        setExperienceFormStatus(
                            "Unable to load nearby places.",
                            true
                        );

                    }
                );

        }
    );


    panel.appendChild(
        backButton
    );


    const resultsContainer =
        document.createElement(
            "div"
        );


    resultsContainer.id =
        "place-search-results";


    panel.appendChild(
        resultsContainer
    );


    async function performSearch() {

        const searchText =
            input.value.trim();


        if (
            searchText.length < 2
        ) {

            setExperienceFormStatus(
                "Please enter at least 2 characters.",
                true
            );


            input.focus();


            return;

        }


        searchButton.disabled =
            true;


        setExperienceFormStatus(
            "Searching nearby places..."
        );


        resultsContainer.innerHTML =
            "";


        try {

            const result =
                await searchPlaces(
                    searchText
                );


            setExperienceFormStatus(
                ""
            );


            showSearchResults(
                result.candidates ||
                [],
                resultsContainer
            );

        }

        catch (error) {

            console.error(
                "Place search error:",
                error
            );


            setExperienceFormStatus(
                error.message ||
                "Unable to search for places.",
                true
            );

        }

        finally {

            searchButton.disabled =
                false;

        }

    }


    searchButton.addEventListener(
        "click",
        performSearch
    );


    input.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                performSearch();

            }

        }
    );


    input.focus();

}


/* ============================================================
   18. SHOW SEARCH RESULTS
   ============================================================ */

function showSearchResults(
    candidates,
    resultsContainer
) {

    resultsContainer.innerHTML =
        "";


    if (
        !candidates ||
        candidates.length === 0
    ) {

        const message =
            document.createElement(
                "p"
            );


        message.className =
            "step-help";


        message.textContent =
            "No matching place found nearby.";


        resultsContainer.appendChild(
            message
        );


        const createButton =
            document.createElement(
                "button"
            );


        createButton.type =
            "button";


        createButton.className =
            "submit-experience-btn";


        createButton.textContent =
            "Create a Placeful place";


        createButton.addEventListener(
            "click",
            function () {

                showCreatePlaceUI();

            }
        );


        resultsContainer.appendChild(
            createButton
        );


        const skipButton =
            document.createElement(
                "button"
            );


        skipButton.type =
            "button";


        skipButton.className =
            "cancel-btn";


        skipButton.textContent =
            "Continue without a place";


        skipButton.addEventListener(
            "click",
            function () {

                selectedPlaceId =
                    null;


                selectedPlace =
                    null;


                updateSelectedPlaceLabel();


                renderNoPlaceSelectedState();

            }
        );


        resultsContainer.appendChild(
            skipButton
        );


        return;

    }


    const heading =
        document.createElement(
            "p"
        );


    heading.className =
        "step-help";


    heading.textContent =
        "Results near your selected location";


    resultsContainer.appendChild(
        heading
    );


    const list =
        document.createElement(
            "div"
        );


    list.className =
        "choice-list";


    candidates.forEach(
        function (candidate) {

            createPlaceCandidateCard(
                candidate,
                list
            );

        }
    );


    resultsContainer.appendChild(
        list
    );


    const createButton =
        document.createElement(
            "button"
        );


    createButton.type =
        "button";


    createButton.className =
        "cancel-btn";


    createButton.textContent =
        "Create a Placeful place";


    createButton.addEventListener(
        "click",
        function () {

            showCreatePlaceUI();

        }
    );


    resultsContainer.appendChild(
        createButton
    );


    const skipButton =
        document.createElement(
            "button"
        );


    skipButton.type =
        "button";


    skipButton.className =
        "cancel-btn";


    skipButton.textContent =
        "Continue without a place";


    skipButton.addEventListener(
        "click",
        function () {

            selectedPlaceId =
                null;


            selectedPlace =
                null;


            updateSelectedPlaceLabel();


            renderNoPlaceSelectedState();

        }
    );


    resultsContainer.appendChild(
        skipButton
    );

}


/* ============================================================
   19. SHOW CREATE PLACEFUL PLACE UI
   ============================================================ */

function showCreatePlaceUI() {

    const panel =
        createPlaceSelectionPanel();


    if (!panel) {
        return;
    }


    const heading =
        document.createElement(
            "p"
        );


    heading.className =
        "step-help";


    heading.textContent =
        "Create a Placeful place";


    panel.appendChild(
        heading
    );


    const help =
        document.createElement(
            "p"
        );


    help.className =
        "field-hint";


    help.textContent =
        "Give this place a name. Its location will be the exact location you selected on the map.";


    panel.appendChild(
        help
    );


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.id =
        "placeful-place-name";


    input.className =
        "form-input";


    input.placeholder =
        "Place name";


    input.maxLength =
        255;


    panel.appendChild(
        input
    );


    const saveButton =
        document.createElement(
            "button"
        );


    saveButton.type =
        "button";


    saveButton.className =
        "submit-experience-btn";


    saveButton.textContent =
        "Create place";


    panel.appendChild(
        saveButton
    );


    const backButton =
        document.createElement(
            "button"
        );


    backButton.type =
        "button";


    backButton.className =
        "cancel-btn";


    backButton.textContent =
        "Back";


    backButton.addEventListener(
        "click",
        function () {

            identifyPlacesAtLocation(
                selectedLatitude,
                selectedLongitude
            )
                .then(
                    function (result) {

                        showPlaceCandidates(
                            result.candidates ||
                            []
                        );

                    }
                )
                .catch(
                    function (error) {

                        console.error(
                            error
                        );


                        setExperienceFormStatus(
                            "Unable to load nearby places.",
                            true
                        );

                    }
                );

        }
    );


    panel.appendChild(
        backButton
    );


    saveButton.addEventListener(
        "click",
        async function () {

            const name =
                input.value.trim();


            if (!name) {

                setExperienceFormStatus(
                    "Please enter a name for the Placeful place.",
                    true
                );


                input.focus();


                return;

            }


            saveButton.disabled =
                true;


            setExperienceFormStatus(
                "Creating Placeful place..."
            );


            try {

                const place =
                    await createPlacefulPlace(
                        name
                    );


                selectedPlace =
                    place;


                selectedPlaceId =
                    place.id;


                updateSelectedPlaceLabel();


                renderSelectedPlaceState(
                    panel
                );


                setExperienceFormStatus(
                    ""
                );

            }

            catch (error) {

                console.error(
                    "Failed to create Placeful place:",
                    error
                );


                setExperienceFormStatus(
                    error.message ||
                    "Unable to create the Placeful place.",
                    true
                );

            }

            finally {

                saveButton.disabled =
                    false;

            }

        }
    );


    input.focus();

}


/* ============================================================
   20. CREATE PLACEFUL PLACE
   ============================================================ */

async function createPlacefulPlace(
    name
) {

    if (
        selectedLatitude === null ||
        selectedLongitude === null
    ) {

        throw new Error(
            "No location has been selected."
        );

    }


    const placePayload = {

        name:
            name,

        description:
            null,

        category:
            null,

        latitude:
            selectedLatitude,

        longitude:
            selectedLongitude,

        address:
            null,

        city:
            null,

        country:
            null,

        osm_type:
            null,

        osm_id:
            null

    };


    console.log(
        "Creating Placeful place:",
        placePayload
    );


    const response =
        await fetch(
            API_BASE_URL +
            "/places/",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        placePayload
                    )

            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();


        console.error(
            "Placeful place response:",
            errorText
        );


        throw new Error(
            "Unable to create the Placeful place."
        );

    }


    const result =
        await response.json();


    console.log(
        "Placeful place created:",
        result
    );


    return result;

}


/* ============================================================
   21. CREATE OR REUSE OSM PLACE
   ============================================================ */

async function createOrReusePlace(
    candidate
) {

    const placePayload = {

        name:
            candidate.name,

        description:
            null,

        category:
            candidate.category,

        latitude:
            candidate.latitude,

        longitude:
            candidate.longitude,

        address:
            candidate.address,

        city:
            candidate.city,

        country:
            candidate.country,

        osm_type:
            candidate.osm_type,

        osm_id:
            candidate.osm_id

    };


    console.log(
        "Sending Place to API:",
        placePayload
    );


    const response =
        await authenticatedFetch(
            API_BASE_URL +
            "/places/",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        placePayload
                    )

            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();


        console.error(
            "Place creation response:",
            errorText
        );


        throw new Error(
            "Unable to create or reuse the selected place."
        );

    }


    const result =
        await response.json();


    console.log(
        "Place created/reused:",
        result
    );


    return result;

}


/* ============================================================
   22. SELECT PLACE CANDIDATE
   ============================================================ */

async function selectPlaceCandidate(
    candidate
) {

    /*
       IMPORTANT:

       Candidate coordinates become
       the persistent Place location.

       They do NOT replace the exact
       Experience location.
    */

    const place =
        await createOrReusePlace(
            candidate
        );


    selectedPlace =
        place;


    selectedPlaceId =
        place.id;


    console.log(
        "Selected Place:",
        selectedPlace
    );


    console.log(
        "Selected Place ID:",
        selectedPlaceId
    );


    updateSelectedPlaceLabel();

}


/* ============================================================
   23. RENDER SELECTED PLACE STATE
   ============================================================ */

function renderSelectedPlaceState(
    panel
) {

    if (!panel) {
        return;
    }


    panel.innerHTML =
        "";


    const heading =
        document.createElement(
            "p"
        );


    heading.className =
        "step-help";


    heading.textContent =
        "Place selected";


    panel.appendChild(
        heading
    );


    const placeName =
        document.createElement(
            "strong"
        );


    placeName.className =
        "selected-place-name";


    placeName.textContent =
        selectedPlace &&
        selectedPlace.name
            ? selectedPlace.name
            : "Selected place";


    panel.appendChild(
        placeName
    );


    const changeButton =
        document.createElement(
            "button"
        );


    changeButton.type =
        "button";


    changeButton.className =
        "cancel-btn";


    changeButton.textContent =
        "Change place";


    changeButton.addEventListener(
        "click",
        function () {

            setExperienceFormStatus(
                "Looking for nearby places..."
            );


            identifyPlacesAtLocation(
                selectedLatitude,
                selectedLongitude
            )
                .then(
                    function (result) {

                        setExperienceFormStatus(
                            ""
                        );


                        showPlaceCandidates(
                            result.candidates ||
                            []
                        );

                    }
                )
                .catch(
                    function (error) {

                        console.error(
                            error
                        );


                        setExperienceFormStatus(
                            "Unable to load nearby places.",
                            true
                        );

                    }
                );

        }
    );


    panel.appendChild(
        changeButton
    );


    const removeButton =
        document.createElement(
            "button"
        );


    removeButton.type =
        "button";


    removeButton.className =
        "cancel-btn";


    removeButton.textContent =
        "Continue without a place";


    removeButton.addEventListener(
        "click",
        function () {

            selectedPlaceId =
                null;


            selectedPlace =
                null;


            updateSelectedPlaceLabel();


            renderNoPlaceSelectedState();

        }
    );


    panel.appendChild(
        removeButton
    );

}


/* ============================================================
   24. RENDER NO PLACE STATE
   ============================================================ */

function renderNoPlaceSelectedState() {

    const panel =
        panelForCurrentPlaceSelection();


    if (!panel) {
        return;
    }


    panel.innerHTML =
        "";


    const message =
        document.createElement(
            "p"
        );


    message.className =
        "step-help";


    message.textContent =
        "You can continue without linking this experience to a Place.";


    panel.appendChild(
        message
    );


    const chooseButton =
        document.createElement(
            "button"
        );


    chooseButton.type =
        "button";


    chooseButton.className =
        "cancel-btn";


    chooseButton.textContent =
        "Choose a place";


    chooseButton.addEventListener(
        "click",
        function () {

            identifyPlacesAtLocation(
                selectedLatitude,
                selectedLongitude
            )
                .then(
                    function (result) {

                        showPlaceCandidates(
                            result.candidates ||
                            []
                        );

                    }
                )
                .catch(
                    function (error) {

                        console.error(
                            error
                        );


                        setExperienceFormStatus(
                            "Unable to load nearby places.",
                            true
                        );

                    }
                );

        }
    );


    panel.appendChild(
        chooseButton
    );

}


/* ============================================================
   25. SELECT EXPERIENCE LOCATION
   ============================================================

   map.js calls:

       selectExperienceLocation(event.coordinate)

   Because this script loads after map.js,
   this implementation becomes the active
   location-selection implementation.
   ============================================================ */

function selectExperienceLocation(
    coordinate
) {

    /*
       Convert OpenLayers coordinate
       from EPSG:3857 to longitude/latitude.
    */

    const lonLat =
        ol.proj.toLonLat(
            coordinate
        );


    /*
       Store exact clicked location.

       This is the Experience location.
    */

    selectedLongitude =
        lonLat[0];


    selectedLatitude =
        lonLat[1];


    console.log(
        "Selected experience location:",
        {
            longitude:
                selectedLongitude,

            latitude:
                selectedLatitude
        }
    );


    /*
       Stop location-selection mode.
    */

    isSelectingLocation =
        false;


    /*
       Restore Add Experience button.
    */

    if (addExperienceBtn) {

        addExperienceBtn.innerHTML =
            '<span class="add-experience-icon">+</span>' +
            '<span>Add experience</span>';

    }


    /*
       Restore cursor.
    */

    if (
        typeof map !== "undefined" &&
        map.getTargetElement()
    ) {

        map.getTargetElement().style.cursor =
            "";

    }


    /*
       Reset Place state.
    */

    selectedPlaceId =
        null;


    selectedPlace =
        null;


    updateSelectedLocationLabel();

    updateSelectedPlaceLabel();


    /*
       Open form.
    */

    openExperienceForm();


    /*
       Identify nearby Places.
    */

    setPlaceSelectionStatus(
        "Looking for nearby places..."
    );


    identifyPlacesAtLocation(
        selectedLatitude,
        selectedLongitude
    )
        .then(
            function (result) {

                setPlaceSelectionStatus(
                    ""
                );


                showPlaceCandidates(
                    result.candidates ||
                    []
                );

            }
        )
        .catch(
            function (error) {

                console.error(
                    "Place identification error:",
                    error
                );


                /*
                   Place identification should
                   never prevent Experience creation.
                */

                setExperienceFormStatus(
                    "No place suggestions available. " +
                    "You can still save the experience without a place."
                );


                renderNoPlaceSelectedState();

            }
        );

}


/* ============================================================
   26. OPEN EXPERIENCE FORM
   ============================================================ */

function openExperienceForm() {

    if (!experienceFormOverlay) {
        return;
    }


    experienceFormOverlay.classList.add(
        "active"
    );


    experienceFormStep =
        1;


    updateExperienceFormStep();


    updateSelectedLocationLabel();


    updateSelectedPlaceLabel();


    removePlaceSelectionUI();


    setExperienceFormStatus(
        ""
    );

    setPlaceSelectionStatus(
        "Looking for nearby places..."
    );

}


/* ============================================================
   27. START EXPERIENCE CREATION
   ============================================================ */

if (addExperienceBtn) {

    addExperienceBtn.addEventListener(
        "click",
        function () {

            /*
               Require authentication.
            */

            if (!isLoggedIn()) {

                if (
                    typeof openSignInModal ===
                    "function"
                ) {

                    openSignInModal();

                }

                return;

            }


            /*
               Start location selection.
            */

            isSelectingLocation =
                true;


            /*
               Clear previous Place state.
            */

            selectedPlaceId =
                null;


            selectedPlace =
                null;


            /*
               Clear previous coordinates.
            */

            selectedLongitude =
                null;


            selectedLatitude =
                null;


            updateSelectedLocationLabel();

            updateSelectedPlaceLabel();

            removePlaceSelectionUI();


            setExperienceFormStatus(
                ""
            );


            /*
               Update button.
            */

            addExperienceBtn.textContent =
                "Click a location on the map";


            /*
               Change cursor.
            */

            if (
                typeof map !== "undefined" &&
                map.getTargetElement()
            ) {

                map.getTargetElement().style.cursor =
                    "crosshair";

            }


            /*
               Close sidebar while selecting.
            */

            if (
                typeof closeSidebar ===
                "function"
            ) {

                closeSidebar();

            }


            console.log(
                "Location selection started."
            );

        }
    );

}


/* ============================================================
   28. CLOSE FORM
   ============================================================ */

function closeExperienceFormAndReset() {

    /*
       Hide overlay.
    */

    if (experienceFormOverlay) {

        experienceFormOverlay.classList.remove(
            "active"
        );

    }


    /*
       Reset form.
    */

    if (experienceForm) {

        experienceForm.reset();

    }


    /*
       Remove Place UI.
    */

    removePlaceSelectionUI();


    /*
       Clear location.
    */

    selectedLongitude =
        null;


    selectedLatitude =
        null;


    /*
       Clear Place.
    */

    selectedPlaceId =
        null;


    selectedPlace =
        null;


    /*
       Stop selection mode.
    */

    isSelectingLocation =
        false;


    /*
       Restore button.
    */

    if (addExperienceBtn) {

        addExperienceBtn.innerHTML =
            '<span class="add-experience-icon">+</span>' +
            '<span>Add experience</span>';

    }


    /*
       Restore cursor.
    */

    if (
        typeof map !== "undefined" &&
        map.getTargetElement()
    ) {

        map.getTargetElement().style.cursor =
            "";

    }


    /*
       Reset step.
    */

    experienceFormStep =
        1;


    updateExperienceFormStep();


    updateSelectedLocationLabel();

    updateSelectedPlaceLabel();


    setExperienceFormStatus(
        ""
    );
    setPlaceSelectionStatus(
        ""
    );

}


/* ============================================================
   29. CLOSE BUTTON
   ============================================================ */

if (closeExperienceForm) {

    closeExperienceForm.addEventListener(
        "click",
        function () {

            closeExperienceFormAndReset();

        }
    );

}


/* ============================================================
   30. CANCEL BUTTON
   ============================================================ */

if (cancelExperienceBtn) {

    cancelExperienceBtn.addEventListener(
        "click",
        function () {

            closeExperienceFormAndReset();

        }
    );

}


/* ============================================================
   31. CLICK OUTSIDE FORM
   ============================================================ */

if (experienceFormOverlay) {

    let experienceFormPointerStartedInside = false;

    experienceFormOverlay.addEventListener(
        "pointerdown",
        function (event) {

            experienceFormPointerStartedInside =
                experienceForm &&
                experienceForm.contains(event.target);

        }
    );

    experienceFormOverlay.addEventListener(
        "click",
        function (event) {

            const shouldClose =
                event.target === experienceFormOverlay &&
                !experienceFormPointerStartedInside;

            experienceFormPointerStartedInside = false;

            if (shouldClose) {
                closeExperienceFormAndReset();
            }

        }
    );

    experienceFormOverlay.addEventListener(
        "pointercancel",
        function () {

            experienceFormPointerStartedInside =
                false;

        }
    );

}


/* ============================================================
   32. NEXT STEP
   ============================================================ */

if (experienceStepNext) {

    experienceStepNext.addEventListener(
        "click",
        function () {

            /*
               Step 1 validation.
            */

            if (
                experienceFormStep ===
                1
            ) {

                const titleElement =
                    document.getElementById(
                        "experience-title"
                    );


                const storyElement =
                    document.getElementById(
                        "experience-description"
                    );


                const emotionElement =
                    document.getElementById(
                        "experience-emotion"
                    );


                const title =
                    titleElement
                        ? titleElement.value.trim()
                        : "";


                const story =
                    storyElement
                        ? storyElement.value.trim()
                        : "";


                const emotion =
                    emotionElement
                        ? emotionElement.value
                        : "";


                if (!title) {

                    setExperienceFormStatus(
                        "Please enter a title.",
                        true
                    );


                    return;

                }


                if (!story) {

                    setExperienceFormStatus(
                        "Please enter your story.",
                        true
                    );


                    return;

                }


                if (!emotion) {

                    setExperienceFormStatus(
                        "Please select an emotion.",
                        true
                    );


                    return;

                }

            }


            /*
               Move to next step.
            */

            if (
                experienceFormStep <
                4
            ) {

                experienceFormStep +=
                    1;


                setExperienceFormStatus(
                    ""
                );


                updateExperienceFormStep();

            }

        }
    );

}


/* ============================================================
   33. BACK STEP
   ============================================================ */

if (experienceStepBack) {

    experienceStepBack.addEventListener(
        "click",
        function () {

            if (
                experienceFormStep >
                1
            ) {

                experienceFormStep -=
                    1;


                setExperienceFormStatus(
                    ""
                );


                updateExperienceFormStep();

            }

        }
    );

}


/* ============================================================
   34. SUBMIT EXPERIENCE
   ============================================================ */

if (experienceForm) {

    experienceForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            /* ----------------------------------------------------
               Get title
               ---------------------------------------------------- */

            const titleElement =
                document.getElementById(
                    "experience-title"
                );


            const title =
                titleElement
                    ? titleElement.value.trim()
                    : "";


            /* ----------------------------------------------------
               Get story
               ---------------------------------------------------- */

            const storyElement =
                document.getElementById(
                    "experience-description"
                );


            const story =
                storyElement
                    ? storyElement.value.trim()
                    : "";


            /* ----------------------------------------------------
               Get emotion
               ---------------------------------------------------- */

            const emotionElement =
                document.getElementById(
                    "experience-emotion"
                );


            const emotion =
                emotionElement
                    ? emotionElement.value
                    : "";


            /* ----------------------------------------------------
               Get visibility
               ---------------------------------------------------- */

            const visibilityElement =
                document.querySelector(
                    'input[name="visibility"]:checked'
                );


            const visibility =
                visibilityElement
                    ? visibilityElement.value
                    : "public";


            /* ----------------------------------------------------
               Get anonymity
               ---------------------------------------------------- */

            const anonymityElement =
                document.querySelector(
                    'input[name="is_anonymous"]:checked'
                );


            const isAnonymous =
                anonymityElement
                    ? anonymityElement.value ===
                      "true"
                    : false;


            /* ----------------------------------------------------
               Validate location
               ---------------------------------------------------- */

            if (
                selectedLongitude === null ||
                selectedLatitude === null
            ) {

                setExperienceFormStatus(
                    "Please select a location on the map first.",
                    true
                );


                return;

            }


            /* ----------------------------------------------------
               Validate final step
               ---------------------------------------------------- */

            if (
                experienceFormStep !==
                3
            ) {

                setExperienceFormStatus(
                    "Please complete the form first.",
                    true
                );


                return;

            }


            /* ----------------------------------------------------
               Validate story fields
               ---------------------------------------------------- */

            if (!title) {

                setExperienceFormStatus(
                    "Please enter a title.",
                    true
                );


                experienceFormStep =
                    1;


                updateExperienceFormStep();


                return;

            }


            if (!story) {

                setExperienceFormStatus(
                    "Please enter your story.",
                    true
                );


                experienceFormStep =
                    1;


                updateExperienceFormStep();


                return;

            }


            if (!emotion) {

                setExperienceFormStatus(
                    "Please select an emotion.",
                    true
                );


                experienceFormStep =
                    1;


                updateExperienceFormStep();


                return;

            }


            /* ----------------------------------------------------
               Build Experience payload
               ---------------------------------------------------- */

            const experience = {

                /*
                   Persistent Place relationship.

                   This can be null.
                */

                place_id:
                    selectedPlaceId,


                /*
                   Exact user-selected location.

                   This remains independent
                   of Place coordinates.
                */

                latitude:
                    selectedLatitude,

                longitude:
                    selectedLongitude,


                title:
                    title,

                story:
                    story,

                emotion:
                    emotion,

                visibility:
                    visibility,

                is_anonymous:
                    isAnonymous

            };


            console.log(
                "Sending experience to API:"
            );


            console.log(
                experience
            );


            console.log(
                "Selected Place:",
                selectedPlace
            );


            /* ----------------------------------------------------
               Disable submit button
               ---------------------------------------------------- */

            experienceSubmitBtn.disabled =
                true;


            setExperienceFormStatus(
                "Saving experience..."
            );


            /* ----------------------------------------------------
               POST Experience
               ---------------------------------------------------- */

            try {

                const response =
                    await authenticatedFetch(
                        API_BASE_URL +
                        "/experiences/",
                        {

                            method:
                                "POST",

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


                /* ------------------------------------------------
                   Check response
                   ------------------------------------------------ */

                if (!response.ok) {

                    const errorText =
                        await response.text();


                    console.error(
                        "FastAPI response:",
                        errorText
                    );


                    throw new Error(
                        "Unable to save experience."
                    );

                }


                /* ------------------------------------------------
                   Read response
                   ------------------------------------------------ */

                const result =
                    await response.json();


                console.log(
                    "Experience created successfully:",
                    result
                );


                /* ------------------------------------------------
                   Close form
                   ------------------------------------------------ */

                closeExperienceFormAndReset();


                /* ------------------------------------------------
                   Reload map experiences
                   ------------------------------------------------ */

                if (
                    typeof loadExperiences ===
                    "function"
                ) {

                    await loadExperiences();

                }

            }


            catch (error) {

                console.error(
                    "Failed to create experience:",
                    error
                );


                setExperienceFormStatus(
                    error.message ||
                    "Unable to save experience.",
                    true
                );

            }


            finally {

                experienceSubmitBtn.disabled =
                    false;

            }

        }
    );

}


/* ============================================================
   35. INITIAL FORM STATE
   ============================================================ */

updateExperienceFormStep();

updateSelectedLocationLabel();

updateSelectedPlaceLabel();