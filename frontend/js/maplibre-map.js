// ============================================================
// LOCALEIFY — MapLibre map
// Step 1: MapLibre basemap + Localeify experiences
//
// Keeps the existing OpenLayers map running underneath during
// the migration.
//
// Depends on:
//   - api.js
// ============================================================

import * as maplibregl
    from "https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs";


// ------------------------------------------------------------
// MAP
// ------------------------------------------------------------

const maplibreMap = new maplibregl.Map({
    container: "maplibre-map",

    style: "https://tiles.openfreemap.org/styles/liberty",

    center: [45.0783, 37.5497],

    zoom: 12
});


// Make the MapLibre map available globally for debugging and
// for later migration steps.
window.localeifyMapLibre = maplibreMap;
window.placefulMapLibre = maplibreMap;


// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

let selectedFeature = null;

let experiencesReloadTimer = null;

let activeEmotionFilter = "all";


// ------------------------------------------------------------
// TEMPORARY FEATURE INFO PANEL
// ------------------------------------------------------------

const featureInfo = document.createElement("div");

featureInfo.id = "maplibre-feature-info";

featureInfo.style.position = "absolute";
featureInfo.style.top = "12px";
featureInfo.style.right = "12px";
featureInfo.style.zIndex = "1000";
featureInfo.style.maxWidth = "360px";
featureInfo.style.maxHeight = "70vh";
featureInfo.style.overflow = "auto";
featureInfo.style.padding = "12px";
featureInfo.style.background = "rgba(255,255,255,0.96)";
featureInfo.style.borderRadius = "8px";
featureInfo.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
featureInfo.style.fontFamily = "Arial, sans-serif";
featureInfo.style.fontSize = "13px";
featureInfo.style.lineHeight = "1.4";
featureInfo.style.display = "none";

document.getElementById("full-map-container").appendChild(featureInfo);


// ------------------------------------------------------------
// GEOJSON SOURCE — EXPERIENCE DATA
// ------------------------------------------------------------

function createEmptyFeatureCollection() {
    return {
        type: "FeatureCollection",
        features: []
    };
}


// ------------------------------------------------------------
// MAPLIBRE LOAD
// ------------------------------------------------------------

maplibreMap.on("load", function () {

    console.log("MapLibre loaded.");

    // --------------------------------------------------------
    // EXPERIENCE SOURCE
    // --------------------------------------------------------

    maplibreMap.addSource("localeify-experiences", {
        type: "geojson",

        data: createEmptyFeatureCollection()
    });


    // --------------------------------------------------------
    // EXPERIENCE LAYER
    // --------------------------------------------------------

    maplibreMap.addLayer({
        id: "localeify-experiences",

        type: "circle",

        source: "localeify-experiences",

        paint: {

            "circle-radius": 6,

            "circle-color": "#ffffff",

            "circle-stroke-color": "#c45c3e",

            "circle-stroke-width": 2
        }
    });

    // ----------------------------------------------------
// Localeify places
// ----------------------------------------------------

maplibreMap.addSource("localeify-places", {
    type: "geojson",
    data: {
        type: "FeatureCollection",
        features: []
    }
});

maplibreMap.addLayer({
    id: "localeify-places",
    type: "circle",
    source: "localeify-places",

    paint: {
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "experience_count"],

            0, 7,
            5, 9,
            10, 11
        ],

        "circle-color": "#c45c3e",

        "circle-stroke-color": "#ffffff",

        "circle-stroke-width": 2
    }
});


    // --------------------------------------------------------
    // SELECTED EXPERIENCE LAYER
    //
    // This is separate from the general geographic-feature
    // selection system below.
    // --------------------------------------------------------

    maplibreMap.addLayer({
        id: "localeify-selected-experience",

        type: "circle",

        source: "localeify-experiences",

        filter: [
            "==",
            ["get", "id"],
            ""
        ],

        paint: {

            "circle-radius": 9,

            "circle-color": "#c45c3e",

            "circle-stroke-color": "#ffffff",

            "circle-stroke-width": 2
        }
    });


    // --------------------------------------------------------
    // LOAD INITIAL EXPERIENCES
    // --------------------------------------------------------

    loadExperiences();
    loadLocaleifyPlaces();


    // --------------------------------------------------------
    // MAP MOVEMENT
    // --------------------------------------------------------

    maplibreMap.on("moveend", scheduleLoadExperiences);


    console.log(
        "Localeify experience source and layer initialized."
    );
});


// ============================================================
// EXPERIENCE API LOADING
// ============================================================

function getMapBboxParams() {

    const bounds = maplibreMap.getBounds();

    return {
        min_lng: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lng: bounds.getEast(),
        max_lat: bounds.getNorth()
    };
}


async function loadExperiences() {

    try {

        const source =
            maplibreMap.getSource("localeify-experiences");

        if (!source) {
            return;
        }


        const bbox = getMapBboxParams();


        const params = new URLSearchParams({

            offset: "0",

            limit: "500",

            min_lng: String(bbox.min_lng),

            min_lat: String(bbox.min_lat),

            max_lng: String(bbox.max_lng),

            max_lat: String(bbox.max_lat)
        });


        console.log(
            "Loading Localeify experiences:",
            params.toString()
        );


        const response = await apiFetch(
            API_BASE_URL +
            "/experiences/?" +
            params.toString()
        );


        if (!response.ok) {

            throw new Error(
                "HTTP error: " + response.status
            );
        }


        const geojson = await response.json();


        console.log(
            "Localeify experiences received:",
            geojson
        );


        // ----------------------------------------------------
        // The API already returns GeoJSON.
        //
        // Unlike OpenLayers, MapLibre does not require us to
        // convert the features into another feature class.
        // ----------------------------------------------------

        if (
            !geojson ||
            geojson.type !== "FeatureCollection"
        ) {

            throw new Error(
                "Experiences API did not return a GeoJSON FeatureCollection."
            );
        }


        source.setData(geojson);


        console.log(
            "Localeify experiences rendered:",
            geojson.features.length
        );


    } catch (error) {

        console.error(
            "Failed to load Localeify experiences:",
            error
        );
    }
}

async function loadLocaleifyPlaces() {

    try {

        const response = await apiFetch(
            API_BASE_URL + "/places/with-experiences"
        );

        if (!response.ok) {
            throw new Error(
                "HTTP error: " + response.status
            );
        }

        const places = await response.json();

        const features = places
            .filter(function (place) {
                return (
                    place.longitude !== null &&
                    place.latitude !== null
                );
            })
            .map(function (place) {

                return {
                    type: "Feature",

                    id: String(place.id),

                    geometry: {
                        type: "Point",

                        coordinates: [
                            Number(place.longitude),
                            Number(place.latitude)
                        ]
                    },

                    properties: {
                        id: place.id,
                        name: place.name,
                        category: place.category,
                        address: place.address,
                        city: place.city,
                        country: place.country,
                        experience_count:
                            Number(place.experience_count || 0)
                    }
                };

            });

        const geojson = {
            type: "FeatureCollection",
            features: features
        };

        const source =
            maplibreMap.getSource(
                "localeify-places"
            );

        if (source) {
            source.setData(geojson);
        }

        console.log(
            "Localeify places loaded:",
            features.length
        );

    } catch (error) {

        console.error(
            "Failed to load Localeify places:",
            error
        );

    }
}
// ------------------------------------------------------------
// DEBOUNCED EXPERIENCE LOADING
// ------------------------------------------------------------

function scheduleLoadExperiences() {

    if (experiencesReloadTimer) {

        clearTimeout(
            experiencesReloadTimer
        );
    }


    experiencesReloadTimer = setTimeout(
        function () {

            loadExperiences();

        },
        300
    );
}


// ============================================================
// EXPERIENCE FILTERING
// ============================================================
//
// We are intentionally not implementing the final filtering
// architecture yet.
//
// For this migration step, the complete API GeoJSON is loaded.
// The existing OpenLayers emotion filtering remains active
// underneath.
//
// This function is kept here so we can migrate the filter
// cleanly in the next step.
// ============================================================

function setExperienceFilter(emotion) {

    activeEmotionFilter = emotion || "all";


    const layerId =
        "localeify-experiences";


    if (
        !maplibreMap.getLayer(layerId)
    ) {
        return;
    }


    if (activeEmotionFilter === "all") {

        maplibreMap.setFilter(
            layerId,
            null
        );

        return;
    }


    maplibreMap.setFilter(
        layerId,
        [
            "==",
            ["get", "emotion"],
            activeEmotionFilter
        ]
    );
}


// Make this available for the next migration step.
window.setLocaleifyExperienceFilter =
    setExperienceFilter;


// ============================================================
// EXPERIENCE HOVER
// ============================================================

maplibreMap.on(
    "mousemove",
    "localeify-experiences",
    function (event) {

        maplibreMap.getCanvas().style.cursor =
            "pointer";
    }
);


maplibreMap.on(
    "mouseleave",
    "localeify-experiences",
    function () {

        maplibreMap.getCanvas().style.cursor =
            "";
    }
);


// ============================================================
// EXPERIENCE CLICK
// ============================================================

maplibreMap.on(
    "click",
    "localeify-experiences",
    function (event) {

        const features = event.features || [];

        if (!features.length) {
            return;
        }

        const feature = features[0];

        console.log(
            "CLICKED LOCALEIFY EXPERIENCE:",
            feature
        );

        console.table({
            id:
                feature.properties?.id ??
                feature.id ??
                null,

            title:
                feature.properties?.title ??
                null,

            emotion:
                feature.properties?.emotion ??
                null,

            geometry:
                feature.geometry?.type ??
                null,

            longitude:
                event.lngLat.lng,

            latitude:
                event.lngLat.lat
        });

        // ----------------------------------------------------
        // Adapter:
        // makes a MapLibre feature look like an OpenLayers
        // feature to the existing experience sidebar
        // ----------------------------------------------------

        const experienceFeature = {

            get: function (key) {

                if (
                    feature.properties &&
                    Object.prototype.hasOwnProperty.call(
                        feature.properties,
                        key
                    )
                ) {
                    return feature.properties[key];
                }

                return null;
            },

            getGeometry: function () {
                return feature.geometry || null;
            },

            mapLibreFeature: feature
        };

        window.localeifySelectedExperience =
            feature;

        window.localeifySelectedExperienceFeature =
            experienceFeature;

        // ----------------------------------------------------
        // Highlight selected experience
        // ----------------------------------------------------

        const experienceId =
            feature.properties?.id ??
            feature.id ??
            "";

        if (
            maplibreMap.getLayer(
                "localeify-selected-experience"
            )
        ) {

            maplibreMap.setFilter(
                "localeify-selected-experience",
                [
                    "==",
                    ["get", "id"],
                    String(experienceId)
                ]
            );
        }

        // ----------------------------------------------------
        // Hide generic geographic feature info
        // ----------------------------------------------------

        if (featureInfo) {
            featureInfo.style.display = "none";
        }

        // ----------------------------------------------------
        // Close other sidebars
        // ----------------------------------------------------

        if (
            typeof closePlaceSidebar ===
            "function"
        ) {
            closePlaceSidebar();
        }

        if (
            typeof closeProfileSidebar ===
            "function"
        ) {
            closeProfileSidebar();
        }

        // ----------------------------------------------------
        // Open existing Localeify experience sidebar
        // ----------------------------------------------------

        if (
            typeof openExperienceSidebar ===
            "function"
        ) {
            openExperienceSidebar(
                experienceFeature
            );
        }
    }
);

// ============================================================
// EXPERIENCE INFO
// ============================================================

function showExperienceInfo(
    feature,
    event
) {

    const properties =
        feature.properties || {};


    const title =
        properties.title ||
        "Untitled experience";


    const story =
        properties.story ||
        "";


    const emotion =
        properties.emotion ||
        "";


    const id =
        properties.id ??
        feature.id ??
        "—";


    featureInfo.innerHTML = "";


    const titleElement =
        document.createElement("div");

    titleElement.style.fontWeight =
        "700";

    titleElement.style.fontSize =
        "15px";

    titleElement.style.marginBottom =
        "6px";

    titleElement.textContent =
        title;


    featureInfo.appendChild(
        titleElement
    );


    if (story) {

        const storyElement =
            document.createElement("div");

        storyElement.style.marginBottom =
            "6px";

        storyElement.textContent =
            story;

        featureInfo.appendChild(
            storyElement
        );
    }


    const metaElement =
        document.createElement("div");

    metaElement.style.fontSize =
        "11px";

    metaElement.style.opacity =
        "0.7";

    metaElement.textContent =
        "Experience ID: " +
        id +
        " | " +
        event.lngLat.lng.toFixed(6) +
        ", " +
        event.lngLat.lat.toFixed(6);


    featureInfo.appendChild(
        metaElement
    );


    featureInfo.style.display =
        "block";
}


// ============================================================
// GENERIC MAP FEATURE SELECTION
// ============================================================
//
// This is the geographic-feature selection system we already
// built for OpenFreeMap.
//
// It remains independent from Localeify experience selection.
// ============================================================

function pointInRing(
    point,
    ring
) {

    const x = point[0];
    const y = point[1];

    let inside = false;


    for (
        let i = 0,
        j = ring.length - 1;

        i < ring.length;

        j = i++
    ) {

        const xi = ring[i][0];
        const yi = ring[i][1];

        const xj = ring[j][0];
        const yj = ring[j][1];


        const intersect =
            (
                yi > y
            ) !== (
                yj > y
            ) &&
            x <
                (
                    (xj - xi) *
                    (y - yi)
                ) /
                (yj - yi) +
                xi;


        if (intersect) {
            inside = !inside;
        }
    }


    return inside;
}


function pointInPolygon(
    point,
    polygon
) {

    if (!polygon || !polygon.length) {
        return false;
    }


    if (!pointInRing(
        point,
        polygon[0]
    )) {

        return false;
    }


    for (
        let i = 1;

        i < polygon.length;

        i++
    ) {

        if (
            pointInRing(
                point,
                polygon[i]
            )
        ) {

            return false;
        }
    }


    return true;
}


function getClickedGeometry(
    feature,
    event
) {

    const geometry =
        feature.geometry;


    if (!geometry) {
        return null;
    }


    const clickPoint = [
        event.lngLat.lng,
        event.lngLat.lat
    ];


    // --------------------------------------------------------
    // MultiPolygon
    // --------------------------------------------------------

    if (
        geometry.type ===
        "MultiPolygon"
    ) {

        const polygons =
            geometry.coordinates;


        for (
            let i = 0;

            i < polygons.length;

            i++
        ) {

            if (
                pointInPolygon(
                    clickPoint,
                    polygons[i]
                )
            ) {

                return {
                    type: "Polygon",

                    coordinates:
                        polygons[i]
                };
            }
        }


        // If no polygon contains the exact click,
        // preserve the original geometry.
        return geometry;
    }


    return geometry;
}


// ------------------------------------------------------------
// Selection source
// ------------------------------------------------------------

function createSelectionSource() {

    if (
        maplibreMap.getSource(
            "localeify-selection"
        )
    ) {
        return;
    }


    maplibreMap.addSource(
        "localeify-selection",
        {
            type: "geojson",

            data: createEmptyFeatureCollection()
        }
    );


    maplibreMap.addLayer({

        id:
            "localeify-selection-fill",

        type:
            "fill",

        source:
            "localeify-selection",

        filter: [
            "==",
            ["geometry-type"],
            "Polygon"
        ],

        paint: {

            "fill-color":
                "#c45c3e",

            "fill-opacity":
                0.18
        }
    });


    maplibreMap.addLayer({

        id:
            "localeify-selection-line",

        type:
            "line",

        source:
            "localeify-selection",

        filter: [
            "in",
            ["geometry-type"],
            "LineString",
            "Polygon"
        ],

        paint: {

            "line-color":
                "#c45c3e",

            "line-width":
                3
        }
    });


    maplibreMap.addLayer({

        id:
            "localeify-selection-point",

        type:
            "circle",

        source:
            "localeify-selection",

        filter: [
            "==",
            ["geometry-type"],
            "Point"
        ],

        paint: {

            "circle-radius":
                7,

            "circle-color":
                "#c45c3e",

            "circle-stroke-color":
                "#ffffff",

            "circle-stroke-width":
                2
        }
    });
}


// ============================================================
// GENERIC MAP FEATURE SELECTION
// ============================================================

function selectMapFeature(
    feature,
    event
) {

    selectedFeature =
        feature;


    window.placefulSelectedMapFeature =
        feature;


    const selectedGeometry =
        getClickedGeometry(
            feature,
            event
        );


    const source =
        maplibreMap.getSource(
            "localeify-selection"
        );


    if (source) {

        source.setData({

            type:
                "FeatureCollection",

            features: [

                {
                    type:
                        "Feature",

                    geometry:
                        selectedGeometry,

                    properties:
                        {}
                }

            ]
        });
    }


    const normalizedFeature = {

        source:
            feature.source ??
            null,

        sourceLayer:
            feature.sourceLayer ??
            null,

        styleLayer:
            feature.layer?.id ??
            null,

        id:
            feature.id ??
            null,

        properties:
            feature.properties ??
            {},

        geometry:
            feature.geometry ??
            null,

        selectedGeometry:
            selectedGeometry,

        lngLat: {

            lng:
                event.lngLat.lng,

            lat:
                event.lngLat.lat
        }
    };


    window.localeifySelectedMapFeature =
        normalizedFeature;


    showMapFeatureInfo(
        normalizedFeature
    );


    window.dispatchEvent(
        new CustomEvent(
            "localeify:map-feature-selected",
            {
                detail: {

                    feature:
                        normalizedFeature,

                    rawFeature:
                        feature,

                    map:
                        maplibreMap
                }
            }
        )
    );


    window.dispatchEvent(
        new CustomEvent(
            "placeful:map-feature-selected",
            {
                detail: {

                    feature:
                        feature,

                    normalizedFeature:
                        normalizedFeature
                }
            }
        )
    );


    console.log(
        "Localeify selected geographic feature:",
        normalizedFeature
    );
}


// ============================================================
// GENERIC FEATURE INFO
// ============================================================

function showMapFeatureInfo(
    feature
) {

    const properties =
        feature.properties || {};


    const name =
        properties.name ||
        "Unnamed feature";


    const geometryType =
        feature.geometry?.type ||
        "Unknown";


    const source =
        feature.source ||
        "Unknown";


    const sourceLayer =
        feature.sourceLayer ||
        "Unknown";


    const styleLayer =
        feature.styleLayer ||
        "Unknown";


    const id =
        feature.id ??
        "Unknown";


    featureInfo.innerHTML = "";


    const title =
        document.createElement("div");

    title.style.fontWeight =
        "700";

    title.style.fontSize =
        "15px";

    title.style.marginBottom =
        "8px";

    title.textContent =
        name;


    featureInfo.appendChild(
        title
    );


    const meta =
        document.createElement("div");

    meta.innerHTML =
        "<strong>Geometry:</strong> " +
        geometryType +
        "<br>" +

        "<strong>Source:</strong> " +
        source +
        "<br>" +

        "<strong>Source layer:</strong> " +
        sourceLayer +
        "<br>" +

        "<strong>Style layer:</strong> " +
        styleLayer +
        "<br>" +

        "<strong>Feature ID:</strong> " +
        id;


    featureInfo.appendChild(
        meta
    );


    const propertiesTitle =
        document.createElement("div");

    propertiesTitle.style.fontWeight =
        "700";

    propertiesTitle.style.marginTop =
        "10px";

    propertiesTitle.style.marginBottom =
        "4px";

    propertiesTitle.textContent =
        "Properties";


    featureInfo.appendChild(
        propertiesTitle
    );


    const pre =
        document.createElement("pre");

    pre.style.whiteSpace =
        "pre-wrap";

    pre.style.wordBreak =
        "break-word";

    pre.style.fontSize =
        "11px";

    pre.textContent =
        JSON.stringify(
            properties,
            null,
            2
        );


    featureInfo.appendChild(
        pre
    );


    featureInfo.style.display =
        "block";
}


// ============================================================
// GENERIC VECTOR FEATURE HOVER
// ============================================================

maplibreMap.on(
    "mousemove",
    function (event) {

        const features =
            maplibreMap.queryRenderedFeatures(
                event.point
            );


        if (features.length > 0) {

            maplibreMap.getCanvas().style.cursor =
                "pointer";

        } else {

            maplibreMap.getCanvas().style.cursor =
                "";
        }
    }
);


// ============================================================
// GENERIC VECTOR FEATURE CLICK
// ============================================================
//
// IMPORTANT:
//
// We deliberately exclude Localeify experience features here.
// Experience clicks are handled by the dedicated experience
// layer handler above.
//
// Everything else belongs to OpenFreeMap geographic features.
// ============================================================

maplibreMap.on(
    "click",
    function (event) {

        const features =
            maplibreMap.queryRenderedFeatures(
                event.point
            );


        console.log(
            "CLICKED FEATURES:",
            features
        );


        console.table(

            features.map(
                function (
                    feature,
                    index
                ) {

                    return {

                        index:
                            index,

                        id:
                            feature.id ??
                            null,

                        source:
                            feature.source ??
                            null,

                        sourceLayer:
                            feature.sourceLayer ??
                            null,

                        styleLayer:
                            feature.layer?.id ??
                            null,

                        geometry:
                            feature.geometry?.type ??
                            null,

                        name:
                            feature.properties?.name ??
                            null,

                        class:
                            feature.properties?.class ??
                            null,

                        type:
                            feature.properties?.type ??
                            null
                    };
                }
            )
        );


        // ----------------------------------------------------
        // Ignore our own Localeify layers here.
        // ----------------------------------------------------

        const geographicFeature =
            features.find(
                function (feature) {

                    return (
                        feature.source !==
                        "localeify-experiences" &&

                        feature.source !==
                        "localeify-selection"
                    );
                }
            );


        if (!geographicFeature) {

            return;
        }


        selectMapFeature(
            geographicFeature,
            event
        );
    }
);


// ============================================================
// CLEAR GENERIC SELECTION
// ============================================================

function clearSelectedFeature() {

    selectedFeature =
        null;


    window.placefulSelectedMapFeature =
        null;


    window.localeifySelectedMapFeature =
        null;


    const source =
        maplibreMap.getSource(
            "localeify-selection"
        );


    if (source) {

        source.setData(
            createEmptyFeatureCollection()
        );
    }


    featureInfo.style.display =
        "none";
}


// ============================================================
// ESCAPE
// ============================================================

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }


        clearSelectedFeature();
    }
);


// ============================================================
// PUBLIC API
// ============================================================

window.clearLocaleifyMapFeatureSelection =
    clearSelectedFeature;

window.clearPlacefulMapFeatureSelection =
    clearSelectedFeature;


// ============================================================
// INITIALIZE GENERIC SELECTION SOURCE
// ============================================================
//
// This must happen after the MapLibre style has loaded.
// ============================================================

maplibreMap.on(
    "load",
    function () {

        createSelectionSource();

    }
);