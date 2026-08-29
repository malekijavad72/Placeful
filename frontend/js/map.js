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
// 12. MAP CLICK
// ============================================================

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


        // ----------------------------------------------------
        // Update popup
        // ----------------------------------------------------

        popupTitle.textContent =
            title ||
            "Untitled Experience";


        popupStory.textContent =
            story ||
            "No story available.";


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
                await fetch(
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