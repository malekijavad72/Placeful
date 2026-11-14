// ============================================================
// Localeify - MapLibre map
// ============================================================
//
// Responsibilities:
//   1. MapLibre + OpenFreeMap basemap
//   2. Generic OpenFreeMap feature selection
//   3. Localeify experiences
//   4. Experience heatmap
//   5. Experience clustering
//   6. Individual experience markers
//   7. Localeify places
//   8. Selected experience highlighting
//   9. Add Experience location selection bridge
//
// OpenLayers remains underneath during migration.
// ============================================================

import * as maplibregl
    from "https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs";


// ============================================================
// MAP
// ============================================================

const maplibreMap = new maplibregl.Map({
    container: "maplibre-map",

    style: "https://tiles.openfreemap.org/styles/liberty",

    center: [45.0783, 37.5497],

    zoom: 12
});


// Keep compatibility with old Placeful naming
window.localeifyMapLibre = maplibreMap;
window.placefulMapLibre = maplibreMap;


// ============================================================
// CONSTANTS
// ============================================================

const HEATMAP_MAX_ZOOM = 9;
const CLUSTER_MAX_ZOOM = 13;

const PLACE_MEDIUM_ZOOM = 11;
const PLACE_HIGH_ZOOM = 13;


// ============================================================
// STATE
// ============================================================

let selectedFeature = null;

let hoveredExperienceId = null;

let localeifyExperiencesGeoJSON = null;

let localeifyPlaces = [];

let currentEmotionFilter = null;

let mapLoaded = false;


// ============================================================
// HELPERS
// ============================================================

function createEmptyFeatureCollection() {
    return {
        type: "FeatureCollection",
        features: []
    };
}


function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}


// ============================================================
// GENERIC MAP FEATURE SELECTION
// ============================================================

function clearSelectedFeature() {

    selectedFeature = null;

    const source = maplibreMap.getSource(
        "localeify-selection"
    );

    if (source) {

        source.setData(
            createEmptyFeatureCollection()
        );
    }

    const infoPanel =
        document.getElementById(
            "maplibre-feature-info"
        );

    if (infoPanel) {

        infoPanel.remove();
    }
}


function getFeatureName(feature) {

    if (!feature || !feature.properties) {
        return "Unnamed feature";
    }

    const p = feature.properties;

    const possibleNames = [
        p.name,
        p.name_en,
        p.name_fa,
        p["name:en"],
        p["name:fa"],
        p["name:ar"],
        p.ref,
        p.type
    ];

    for (const value of possibleNames) {

        if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        ) {
            return String(value);
        }
    }

    return "Unnamed feature";
}


function getFeatureType(feature) {

    if (!feature || !feature.properties) {
        return "Feature";
    }

    const p = feature.properties;

    return (
        p.class ||
        p.type ||
        p.subclass ||
        p.category ||
        "Feature"
    );
}


function showGenericFeatureInfo(feature) {

    let panel =
        document.getElementById(
            "maplibre-feature-info"
        );

    if (!panel) {

        panel = document.createElement("div");

        panel.id =
            "maplibre-feature-info";

        panel.style.position = "absolute";
        panel.style.top = "20px";
        panel.style.right = "20px";

        panel.style.zIndex = "20";

        panel.style.background = "#ffffff";

        panel.style.padding = "14px 16px";

        panel.style.borderRadius = "8px";

        panel.style.boxShadow =
            "0 2px 12px rgba(0,0,0,0.18)";

        panel.style.maxWidth = "300px";

        panel.style.fontFamily =
            "Arial, sans-serif";

        document
            .getElementById("full-map-container")
            .appendChild(panel);
    }

    const name =
        getFeatureName(feature);

    const type =
        getFeatureType(feature);

    panel.innerHTML = `
        <div style="
            font-size:16px;
            font-weight:600;
            margin-bottom:6px;
        ">
            ${name}
        </div>

        <div style="
            font-size:13px;
            color:#666;
        ">
            ${type}
        </div>
    `;
}


function pointInRing(point, ring) {

    const x = point[0];
    const y = point[1];

    let inside = false;

    for (
        let i = 0, j = ring.length - 1;
        i < ring.length;
        j = i++
    ) {

        const xi = ring[i][0];
        const yi = ring[i][1];

        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersect =
            ((yi > y) !== (yj > y)) &&
            (
                x <
                (xj - xi) *
                (y - yi) /
                (yj - yi) +
                xi
            );

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}


function pointInPolygon(point, polygon) {

    if (!polygon || polygon.length === 0) {
        return false;
    }

    if (!pointInRing(point, polygon[0])) {
        return false;
    }

    for (let i = 1; i < polygon.length; i++) {

        if (pointInRing(point, polygon[i])) {
            return false;
        }
    }

    return true;
}


function getClickedGeometry(
    feature,
    lngLat
) {

    if (!feature || !feature.geometry) {
        return null;
    }

    const geometry =
        feature.geometry;

    const point = [
        lngLat.lng,
        lngLat.lat
    ];

    if (geometry.type === "Polygon") {

        if (
            pointInPolygon(
                point,
                geometry.coordinates
            )
        ) {
            return {
                type: "Polygon",
                coordinates:
                    geometry.coordinates
            };
        }

        return null;
    }


    if (geometry.type === "MultiPolygon") {

        for (
            const polygon
            of geometry.coordinates
        ) {

            if (
                pointInPolygon(
                    point,
                    polygon
                )
            ) {

                return {
                    type: "Polygon",
                    coordinates: polygon
                };
            }
        }

        return null;
    }


    if (
        geometry.type === "Point"
    ) {

        return geometry;
    }


    if (
        geometry.type === "MultiPoint"
    ) {

        return geometry;
    }


    return geometry;
}


function selectGenericFeature(
    feature,
    lngLat
) {

    if (!feature) {
        return;
    }

    const clickedGeometry =
        getClickedGeometry(
            feature,
            lngLat
        );

    if (!clickedGeometry) {
        return;
    }

    selectedFeature = feature;

    const selectionFeature = {

        type: "Feature",

        properties: {
            ...(
                feature.properties || {}
            )
        },

        geometry: clickedGeometry
    };


    const source =
        maplibreMap.getSource(
            "localeify-selection"
        );

    if (source) {

        source.setData({

            type: "FeatureCollection",

            features: [
                selectionFeature
            ]
        });
    }


    showGenericFeatureInfo(
        feature
    );


    window.dispatchEvent(
        new CustomEvent(
            "localeify:map-feature-selected",
            {
                detail: {
                    feature: feature
                }
            }
        )
    );


    window.dispatchEvent(
        new CustomEvent(
            "placeful:map-feature-selected",
            {
                detail: {
                    feature: feature
                }
            }
        )
    );
}


// ============================================================
// GENERIC FEATURE SELECTION LAYERS
// ============================================================

function addSelectionLayers() {

    if (
        !maplibreMap.getSource(
            "localeify-selection"
        )
    ) {

        maplibreMap.addSource(
            "localeify-selection",
            {
                type: "geojson",

                data:
                    createEmptyFeatureCollection()
            }
        );
    }


    // Polygon fill
    if (
        !maplibreMap.getLayer(
            "localeify-selection-fill"
        )
    ) {

        maplibreMap.addLayer({

            id:
                "localeify-selection-fill",

            type: "fill",

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
                    0.20
            }
        });
    }


    // Polygon boundary
    if (
        !maplibreMap.getLayer(
            "localeify-selection-line"
        )
    ) {

        maplibreMap.addLayer({

            id:
                "localeify-selection-line",

            type: "line",

            source:
                "localeify-selection",

            filter: [
                "==",
                ["geometry-type"],
                "Polygon"
            ],

            paint: {

                "line-color":
                    "#c45c3e",

                "line-width":
                    3,

                "line-opacity":
                    0.95
            }
        });
    }


    // Point selection
    if (
        !maplibreMap.getLayer(
            "localeify-selection-point"
        )
    ) {

        maplibreMap.addLayer({

            id:
                "localeify-selection-point",

            type: "circle",

            source:
                "localeify-selection",

            filter: [
                "==",
                ["geometry-type"],
                "Point"
            ],

            paint: {

                "circle-radius":
                    8,

                "circle-color":
                    "#c45c3e",

                "circle-stroke-color":
                    "#ffffff",

                "circle-stroke-width":
                    3
            }
        });
    }
}


// ============================================================
// EXPERIENCE SOURCE
// ============================================================

function addExperienceSource() {

    // ----------------------------------------
    // Clustered source
    // ----------------------------------------

    if (
        !maplibreMap.getSource(
            "localeify-experiences"
        )
    ) {

        maplibreMap.addSource(
            "localeify-experiences",
            {
                type: "geojson",

                data:
                    createEmptyFeatureCollection(),

                cluster: true,

                clusterMaxZoom:
                    CLUSTER_MAX_ZOOM,

                clusterRadius:
                    45
            }
        );
    }


    // ----------------------------------------
    // Separate unclustered source
    // for the heatmap
    // ----------------------------------------

    if (
        !maplibreMap.getSource(
            "localeify-experiences-heatmap"
        )
    ) {

        maplibreMap.addSource(
            "localeify-experiences-heatmap",
            {
                type: "geojson",

                data:
                    createEmptyFeatureCollection(),

                cluster: false
            }
        );
    }
}


// ============================================================
// EXPERIENCE HEATMAP
// ============================================================

function addExperienceHeatmap() {

    if (
        maplibreMap.getLayer(
            "localeify-experience-heatmap"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-experience-heatmap",

        type: "heatmap",

        source:
            "localeify-experiences-heatmap",

        maxzoom:
            HEATMAP_MAX_ZOOM + 0.5,


        paint: {

            // ----------------------------------------
            // Weight
            // ----------------------------------------

            "heatmap-weight": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                0,
                1,

                9,
                1
            ],


            // ----------------------------------------
            // Intensity
            // ----------------------------------------

            "heatmap-intensity": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                0,
                1.0,

                5,
                1.5,

                9,
                2.0
            ],


            // ----------------------------------------
            // Radius
            // ----------------------------------------

            "heatmap-radius": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                0,
                20,

                4,
                28,

                7,
                40,

                9,
                50
            ],


            // ----------------------------------------
            // Opacity
            // ----------------------------------------

            "heatmap-opacity": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                0,
                0.82,

                8,
                0.90,

                9,
                0.95
            ],


            // ----------------------------------------
            // Terracotta gradient
            // ----------------------------------------

            "heatmap-color": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "heatmap-density"
                ],

                0.00,
                "rgba(255,255,255,0)",

                0.10,
                "rgba(255,220,205,0.20)",

                0.25,
                "rgba(235,170,145,0.40)",

                0.45,
                "rgba(210,120,90,0.60)",

                0.65,
                "rgba(196,92,62,0.75)",

                0.80,
                "rgba(160,60,40,0.88)",

                1.00,
                "rgba(120,40,25,1)"
            ]
        }
    });
}


// ============================================================
// CLUSTER CIRCLES
// ============================================================

function addExperienceClusters() {

    if (
        maplibreMap.getLayer(
            "localeify-experience-clusters"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-experience-clusters",

        type: "circle",

        source:
            "localeify-experiences",

        minzoom:
            HEATMAP_MAX_ZOOM,

        maxzoom:
            CLUSTER_MAX_ZOOM + 0.01,

        filter: [
            "has",
            "point_count"
        ],

        paint: {

            // ----------------------------------------
            // Radius
            // ----------------------------------------

            "circle-radius": [
                "step",
                [
                    "get",
                    "point_count"
                ],

                15,

                5,
                18,

                10,
                21,

                25,
                25,

                50,
                30,

                100,
                36
            ],


            // ----------------------------------------
            // Main color
            // ----------------------------------------

            "circle-color":
                "#c45c3e",


            // ----------------------------------------
            // Opacity
            // ----------------------------------------

            "circle-opacity":
                0.92,


            // ----------------------------------------
            // White outline
            // ----------------------------------------

            "circle-stroke-color":
                "#ffffff",

            "circle-stroke-width": [
                "step",
                [
                    "get",
                    "point_count"
                ],

                2,

                10,
                2.5,

                50,
                3
            ],

            "circle-stroke-opacity":
                0.95
        }
    });
}


// ============================================================
// CLUSTER COUNTS
// ============================================================

function addExperienceClusterCount() {

    if (
        maplibreMap.getLayer(
            "localeify-experience-cluster-count"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-experience-cluster-count",

        type: "symbol",

        source:
            "localeify-experiences",

        minzoom:
            HEATMAP_MAX_ZOOM,

        maxzoom:
            CLUSTER_MAX_ZOOM + 0.01,

        filter: [
            "has",
            "point_count"
        ],

        layout: {

            "text-field": [
                "get",
                "point_count_abbreviated"
            ],

            "text-size": [
                "step",
                [
                    "get",
                    "point_count"
                ],

                11,

                10,
                12,

                50,
                13,

                100,
                14
            ],

            "text-allow-overlap":
                true,

            "text-ignore-placement":
                true
        },

        paint: {

            "text-color":
                "#ffffff",

            "text-halo-color":
                "rgba(0,0,0,0.12)",

            "text-halo-width":
                1
        }
    });
}


// ============================================================
// INDIVIDUAL EXPERIENCE POINTS
// ============================================================

function addIndividualExperienceLayer() {

    if (
        maplibreMap.getLayer(
            "localeify-experiences-points"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-experiences-points",

        type: "circle",

        source:
            "localeify-experiences",

        minzoom:
            CLUSTER_MAX_ZOOM,

        filter: [
            "!",
            [
                "has",
                "point_count"
            ]
        ],

        paint: {

            // ----------------------------------------
            // Radius
            // ----------------------------------------

            "circle-radius": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                13,
                5,

                16,
                6,

                20,
                7
            ],


            // ----------------------------------------
            // White center
            // ----------------------------------------

            "circle-color":
                "#ffffff",


            // ----------------------------------------
            // Terracotta border
            // ----------------------------------------

            "circle-stroke-color":
                "#c45c3e",

            "circle-stroke-width":
                3,

            "circle-opacity":
                1
        }
    });
}


// ============================================================
// SELECTED EXPERIENCE
// ============================================================

function addSelectedExperienceLayer() {

    if (
        maplibreMap.getLayer(
            "localeify-selected-experience"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-selected-experience",

        type: "circle",

        source:
            "localeify-experiences",

        minzoom:
            CLUSTER_MAX_ZOOM,

        filter: [
            "all",

            [
                "!",
                [
                    "has",
                    "point_count"
                ]
            ],

            [
                "==",
                [
                    "get",
                    "id"
                ],
                ""
            ]
        ],

        paint: {

            "circle-radius": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                13,
                8,

                16,
                9,

                20,
                10
            ],

            "circle-color":
                "#c45c3e",

            "circle-stroke-color":
                "#ffffff",

            "circle-stroke-width":
                3,

            "circle-opacity":
                1
        }
    });
}


function clearLocaleifySelectedExperience() {

    if (
        maplibreMap.getLayer(
            "localeify-selected-experience"
        )
    ) {

        maplibreMap.setFilter(

            "localeify-selected-experience",

            [
                "all",

                [
                    "!",
                    [
                        "has",
                        "point_count"
                    ]
                ],

                [
                    "==",
                    [
                        "get",
                        "id"
                    ],
                    ""
                ]
            ]
        );
    }


    window.localeifySelectedExperience =
        null;

    window.localeifySelectedExperienceFeature =
        null;
}


window.clearLocaleifySelectedExperience =
    clearLocaleifySelectedExperience;


// ============================================================
// PLACES SOURCE
// ============================================================

function addPlacesSource() {

    if (
        maplibreMap.getSource(
            "localeify-places"
        )
    ) {
        return;
    }


    maplibreMap.addSource(
        "localeify-places",
        {

            type: "geojson",

            data:
                createEmptyFeatureCollection()
        }
    );
}


// ============================================================
// PLACE LAYER
// ============================================================

function addPlacesLayer() {

    if (
        maplibreMap.getLayer(
            "localeify-places"
        )
    ) {
        return;
    }


    maplibreMap.addLayer({

        id:
            "localeify-places",

        type: "circle",

        source:
            "localeify-places",

        minzoom:
            PLACE_MEDIUM_ZOOM,

        paint: {

            "circle-radius": [
                "interpolate",
                [
                    "linear"
                ],
                [
                    "zoom"
                ],

                11,
                6,

                13,
                7,

                18,
                8
            ],

            "circle-color":
                "#ffffff",

            "circle-stroke-color":
                "#6f6f6f",

            "circle-stroke-width":
                2,

            "circle-opacity":
                0.95
        }
    });
}


// ============================================================
// PLACE VISIBILITY
// ============================================================

function updatePlaceVisibility() {

    if (
        !maplibreMap.getLayer(
            "localeify-places"
        )
    ) {
        return;
    }


    const zoom =
        maplibreMap.getZoom();


    let filter;


    // ----------------------------------------
    // Low zoom
    // Only important places
    // ----------------------------------------

    if (zoom < PLACE_MEDIUM_ZOOM) {

        filter = [
            "all",

            [
                ">=",
                [
                    "get",
                    "experience_count"
                ],
                5
            ]
        ];
    }


    // ----------------------------------------
    // Medium zoom
    // ----------------------------------------

    else if (
        zoom < PLACE_HIGH_ZOOM
    ) {

        filter = [
            "all",

            [
                ">=",
                [
                    "get",
                    "experience_count"
                ],
                2
            ]
        ];
    }


    // ----------------------------------------
    // High zoom
    // ----------------------------------------

    else {

        filter = null;
    }


    maplibreMap.setFilter(
        "localeify-places",
        filter
    );
}


// ============================================================
// EXPERIENCE VISIBILITY
// ============================================================

function updateExperienceVisibility() {

    if (
        !maplibreMap.getLayer(
            "localeify-experience-heatmap"
        )
    ) {
        return;
    }


    const zoom =
        maplibreMap.getZoom();


    // ----------------------------------------
    // HEATMAP
    // ----------------------------------------

    const heatmapVisible =
        zoom <= HEATMAP_MAX_ZOOM;


    // ----------------------------------------
    // CLUSTERS
    // ----------------------------------------

    const clustersVisible =
        zoom > HEATMAP_MAX_ZOOM &&
        zoom <= CLUSTER_MAX_ZOOM;


    // ----------------------------------------
    // INDIVIDUAL
    // ----------------------------------------

    const individualsVisible =
        zoom > CLUSTER_MAX_ZOOM;


    maplibreMap.setLayoutProperty(

        "localeify-experience-heatmap",

        "visibility",

        heatmapVisible
            ? "visible"
            : "none"
    );


    maplibreMap.setLayoutProperty(

        "localeify-experience-clusters",

        "visibility",

        clustersVisible
            ? "visible"
            : "none"
    );


    maplibreMap.setLayoutProperty(

        "localeify-experience-cluster-count",

        "visibility",

        clustersVisible
            ? "visible"
            : "none"
    );


    maplibreMap.setLayoutProperty(

        "localeify-experiences-points",

        "visibility",

        individualsVisible
            ? "visible"
            : "none"
    );


    maplibreMap.setLayoutProperty(

        "localeify-selected-experience",

        "visibility",

        individualsVisible
            ? "visible"
            : "none"
    );
}


// ============================================================
// EMOTION FILTER
// ============================================================

function updateEmotionFilter() {

    const layers = [

        "localeify-experience-heatmap",

        "localeify-experience-clusters",

        "localeify-experience-cluster-count",

        "localeify-experiences-points",

        "localeify-selected-experience"
    ];


    for (const layerId of layers) {

        if (
            !maplibreMap.getLayer(
                layerId
            )
        ) {
            continue;
        }


        const baseFilter =
            layerId ===
            "localeify-experience-heatmap"

                ? [
                    "!",
                    [
                        "has",
                        "point_count"
                    ]
                ]

                : layerId ===
                  "localeify-experiences-points"

                    ? [
                        "!",
                        [
                            "has",
                            "point_count"
                        ]
                    ]

                    : layerId ===
                      "localeify-selected-experience"

                        ? [
                            "all",

                            [
                                "!",
                                [
                                    "has",
                                    "point_count"
                                ]
                            ],

                            [
                                "==",
                                [
                                    "get",
                                    "id"
                                ],
                                ""
                            ]
                        ]

                        : [
                            "has",
                            "point_count"
                        ];


        if (
            currentEmotionFilter === null
        ) {

            maplibreMap.setFilter(
                layerId,
                baseFilter
            );

            continue;
        }


        maplibreMap.setFilter(

            layerId,

            [
                "all",

                baseFilter,

                [
                    "in",

                    currentEmotionFilter,

                    [
                        "get",
                        "emotion"
                    ]
                ]
            ]
        );
    }
}


// ============================================================
// UPDATE ALL VISUALIZATION
// ============================================================

function updateVisualization() {

    if (!mapLoaded) {
        return;
    }


    updateExperienceVisibility();

    updatePlaceVisibility();
}


// ============================================================
// LOAD EXPERIENCES
// ============================================================

async function loadExperiences() {

    try {

        const response =
            await fetch(
                "http://127.0.0.1:8000/api/experiences/?offset=0&limit=500"
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const geojson =
            await response.json();


        localeifyExperiencesGeoJSON =
            geojson;


        const clusteredSource =
            maplibreMap.getSource(
                "localeify-experiences"
            );

        const heatmapSource =
            maplibreMap.getSource(
                "localeify-experiences-heatmap"
            );


        if (!clusteredSource) {

            console.error(
                "Localeify clustered experience source not found."
            );

            return;
        }


        if (!heatmapSource) {

            console.error(
                "Localeify heatmap experience source not found."
            );

            return;
        }


        // Same experience data goes into both sources.

        clusteredSource.setData(
            geojson
        );

        heatmapSource.setData(
            geojson
        );


        console.log(
            "Localeify experiences rendered:",
            geojson.features
                ? geojson.features.length
                : 0
        );


        updateVisualization();
    }

    catch (error) {

        console.error(
            "Failed to load Localeify experiences:",
            error
        );
    }
}


// ============================================================
// LOAD PLACES
// ============================================================

async function loadLocaleifyPlaces() {

    try {

        const response =
            await fetch(
                "http://127.0.0.1:8000/api/places/with-experiences"
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const places =
            await response.json();


        localeifyPlaces =
            places;


        const features =
            places
                .filter(
                    place =>
                        place.longitude !== null &&
                        place.latitude !== null
                )
                .map(
                    place => ({

                        type: "Feature",

                        geometry: {

                            type: "Point",

                            coordinates: [

                                Number(
                                    place.longitude
                                ),

                                Number(
                                    place.latitude
                                )
                            ]
                        },

                        properties: {

                            id:
                                place.id,

                            name:
                                place.name,

                            category:
                                place.category,

                            address:
                                place.address,

                            city:
                                place.city,

                            country:
                                place.country,

                            experience_count:
                                Number(
                                    place.experience_count ||
                                    0
                                )
                        }
                    })
                );


        const source =
            maplibreMap.getSource(
                "localeify-places"
            );


        if (source) {

            source.setData({

                type:
                    "FeatureCollection",

                features:
                    features
            });
        }


        console.log(
            "Localeify places loaded:",
            features.length
        );


        updatePlaceVisibility();
    }

    catch (error) {

        console.error(
            "Failed to load Localeify places:",
            error
        );
    }
}


// ============================================================
// EXPERIENCE SIDEBAR ADAPTER
// ============================================================

function createExperienceSidebarFeature(
    feature
) {

    return {

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


        mapLibreFeature:
            feature
    };
}


// ============================================================
// OPEN EXPERIENCE SIDEBAR
// ============================================================

function openExperienceFromMap(
    feature
) {

    if (
        typeof window.openExperienceSidebar !==
        "function"
    ) {

        console.warn(
            "openExperienceSidebar() is not available."
        );

        return;
    }


    const experienceFeature =
        createExperienceSidebarFeature(
            feature
        );


    const experienceId =
        feature.properties
            ? feature.properties.id
            : null;


    if (
        maplibreMap.getLayer(
            "localeify-selected-experience"
        )
    ) {

        maplibreMap.setFilter(

            "localeify-selected-experience",

            [
                "all",

                [
                    "!",
                    [
                        "has",
                        "point_count"
                    ]
                ],

                [
                    "==",
                    [
                        "get",
                        "id"
                    ],
                    String(
                        experienceId
                    )
                ]
            ]
        );
    }


    window.localeifySelectedExperience =
        experienceId;

    window.localeifySelectedExperienceFeature =
        feature;


    window.openExperienceSidebar(
        experienceFeature
    );
}


// ============================================================
// OPEN PLACE SIDEBAR
// ============================================================

function openPlaceFromMap(
    feature
) {

    if (
        typeof window.openPlaceSidebar !==
        "function"
    ) {

        console.warn(
            "openPlaceSidebar() is not available."
        );

        return;
    }


    const placeId =
        feature.properties
            ? feature.properties.id
            : null;


    // Clear selected experience
    if (
        typeof window.clearLocaleifySelectedExperience ===
        "function"
    ) {

        window.clearLocaleifySelectedExperience();
    }


    window.openPlaceSidebar(
        feature.properties
    );
}


// ============================================================
// ADD EXPERIENCE LOCATION BRIDGE
// ============================================================

function isSelectingExperienceLocation() {

    return (
        typeof window.localeifyIsSelectingLocation ===
        "function" &&
        window.localeifyIsSelectingLocation()
    );
}


function selectExperienceLocation(
    longitude,
    latitude
) {

    if (
        typeof window.localeifySelectExperienceLocation ===
        "function"
    ) {

        window.localeifySelectExperienceLocation(
            longitude,
            latitude
        );
    }
}


// ============================================================
// MAP LOAD
// ============================================================

maplibreMap.on(
    "load",
    async function () {

        mapLoaded = true;


        console.log(
            "MapLibre loaded."
        );


        // ----------------------------------------
        // Generic selection
        // ----------------------------------------

        addSelectionLayers();


        // ----------------------------------------
        // Experiences
        // ----------------------------------------

        addExperienceSource();

        addExperienceHeatmap();

        addExperienceClusters();

        addExperienceClusterCount();

        addIndividualExperienceLayer();

        addSelectedExperienceLayer();


        // ----------------------------------------
        // Places
        // ----------------------------------------

        addPlacesSource();

        addPlacesLayer();


        // ----------------------------------------
        // Initial visualization
        // ----------------------------------------

        updateVisualization();


        // ----------------------------------------
        // Load data
        // ----------------------------------------

        await loadExperiences();

        await loadLocaleifyPlaces();
    }
);


// ============================================================
// ZOOM
// ============================================================

maplibreMap.on(
    "zoomend",
    function () {

        updateVisualization();
    }
);


// ============================================================
// CLUSTER CLICK
// ============================================================

maplibreMap.on(
    "click",
    "localeify-experience-clusters",
    function (event) {

        if (
            isSelectingExperienceLocation()
        ) {

            selectExperienceLocation(
                event.lngLat.lng,
                event.lngLat.lat
            );

            return;
        }


        const features =
            maplibreMap.queryRenderedFeatures(
                event.point,
                {
                    layers: [
                        "localeify-experience-clusters"
                    ]
                }
            );


        if (
            !features ||
            features.length === 0
        ) {
            return;
        }


        const cluster =
            features[0];


        const clusterId =
            cluster.properties
                .cluster_id;


        const source =
            maplibreMap.getSource(
                "localeify-experiences"
            );


        if (
            !source ||
            typeof source.getClusterExpansionZoom !==
            "function"
        ) {
            return;
        }


        source.getClusterExpansionZoom(

            clusterId,

            function (
                error,
                zoom
            ) {

                if (error) {

                    console.error(
                        "Cluster expansion error:",
                        error
                    );

                    return;
                }


                maplibreMap.easeTo({

                    center:
                        cluster.geometry.coordinates,

                    zoom:
                        Math.min(
                            zoom,
                            20
                        )
                });
            }
        );
    }
);


// ============================================================
// CLUSTER CURSOR
// ============================================================

maplibreMap.on(
    "mouseenter",
    "localeify-experience-clusters",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "pointer";
    }
);


maplibreMap.on(
    "mouseleave",
    "localeify-experience-clusters",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "";
    }
);


// ============================================================
// EXPERIENCE CLICK
// ============================================================

maplibreMap.on(
    "click",
    "localeify-experiences-points",
    function (event) {

        if (
            isSelectingExperienceLocation()
        ) {

            selectExperienceLocation(
                event.lngLat.lng,
                event.lngLat.lat
            );

            return;
        }


        const features =
            maplibreMap.queryRenderedFeatures(
                event.point,
                {
                    layers: [
                        "localeify-experiences-points"
                    ]
                }
            );


        if (
            !features ||
            features.length === 0
        ) {
            return;
        }


        const feature =
            features[0];


        openExperienceFromMap(
            feature
        );
    }
);


// ============================================================
// EXPERIENCE CURSOR
// ============================================================

maplibreMap.on(
    "mouseenter",
    "localeify-experiences-points",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "pointer";
    }
);


maplibreMap.on(
    "mouseleave",
    "localeify-experiences-points",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "";
    }
);


// ============================================================
// PLACE CLICK
// ============================================================

maplibreMap.on(
    "click",
    "localeify-places",
    function (event) {

        if (
            isSelectingExperienceLocation()
        ) {

            selectExperienceLocation(
                event.lngLat.lng,
                event.lngLat.lat
            );

            return;
        }


        const features =
            maplibreMap.queryRenderedFeatures(
                event.point,
                {
                    layers: [
                        "localeify-places"
                    ]
                }
            );


        if (
            !features ||
            features.length === 0
        ) {
            return;
        }


        openPlaceFromMap(
            features[0]
        );
    }
);


// ============================================================
// PLACE CURSOR
// ============================================================

maplibreMap.on(
    "mouseenter",
    "localeify-places",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "pointer";
    }
);


maplibreMap.on(
    "mouseleave",
    "localeify-places",
    function () {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "";
    }
);


// ============================================================
// GENERIC MAP HOVER
// ============================================================

maplibreMap.on(
    "mousemove",
    function (event) {

        if (
            isSelectingExperienceLocation()
        ) {

            maplibreMap.getCanvas().style.cursor =
                "crosshair";

            return;
        }


        const interactiveLayers = [

            "localeify-experience-clusters",

            "localeify-experiences-points",

            "localeify-places"
        ];


        const existingLayers =
            interactiveLayers.filter(
                layer =>
                    maplibreMap.getLayer(
                        layer
                    )
            );


        let features = [];


        if (
            existingLayers.length > 0
        ) {

            features =
                maplibreMap.queryRenderedFeatures(
                    event.point,
                    {
                        layers:
                            existingLayers
                    }
                );
        }


        if (
            features.length > 0
        ) {

            maplibreMap.getCanvas().style.cursor =
                "pointer";

            return;
        }


        maplibreMap.getCanvas().style.cursor =
            "";
    }
);


// ============================================================
// GENERIC MAP CLICK
// ============================================================

maplibreMap.on(
    "click",
    function (event) {

        if (
            isSelectingExperienceLocation()
        ) {

            selectExperienceLocation(
                event.lngLat.lng,
                event.lngLat.lat
            );

            return;
        }


        // ----------------------------------------
        // Ignore clicks already handled by
        // dedicated interactive layers
        // ----------------------------------------

        const interactiveLayers = [

            "localeify-experience-clusters",

            "localeify-experiences-points",

            "localeify-places"
        ];


        const existingLayers =
            interactiveLayers.filter(
                layer =>
                    maplibreMap.getLayer(
                        layer
                    )
            );


        let interactiveFeatures = [];


        if (
            existingLayers.length > 0
        ) {

            interactiveFeatures =
                maplibreMap.queryRenderedFeatures(
                    event.point,
                    {
                        layers:
                            existingLayers
                    }
                );
        }


        if (
            interactiveFeatures.length > 0
        ) {
            return;
        }


        // ----------------------------------------
        // Query OpenFreeMap features
        // ----------------------------------------

        const features =
            maplibreMap.queryRenderedFeatures(
                event.point
            );


        if (
            !features ||
            features.length === 0
        ) {

            clearSelectedFeature();

            return;
        }


        // ----------------------------------------
        // Find useful geographic feature
        // ----------------------------------------

        let candidate = null;


        for (
            const feature
            of features
        ) {

            if (
                feature.source ===
                "openfreemap"
            ) {

                candidate =
                    feature;

                break;
            }
        }


        // If source information is not available,
        // use the first feature with geometry.

        if (!candidate) {

            for (
                const feature
                of features
            ) {

                if (
                    feature.geometry
                ) {

                    candidate =
                        feature;

                    break;
                }
            }
        }


        if (!candidate) {

            clearSelectedFeature();

            return;
        }


        selectGenericFeature(
            candidate,
            event.lngLat
        );
    }
);


// ============================================================
// ESCAPE
// ============================================================

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !== "Escape"
        ) {
            return;
        }


        clearSelectedFeature();


        if (
            typeof window.clearLocaleifySelectedExperience ===
            "function"
        ) {

            window.clearLocaleifySelectedExperience();
        }
    }
);


// ============================================================
// PUBLIC API
// ============================================================

window.clearLocaleifyMapFeatureSelection =
    clearSelectedFeature;

window.clearPlacefulMapFeatureSelection =
    clearSelectedFeature;


window.loadLocaleifyExperiences =
    loadExperiences;

window.loadLocaleifyPlaces =
    loadLocaleifyPlaces;


window.updateLocaleifyMapVisualization =
    updateVisualization;


// ============================================================
// OPTIONAL EMOTION FILTER API
// ============================================================

window.setLocaleifyEmotionFilter =
    function (emotion) {

        currentEmotionFilter =
            emotion || null;

        updateEmotionFilter();
    };


window.clearLocaleifyEmotionFilter =
    function () {

        currentEmotionFilter =
            null;

        updateEmotionFilter();
    };


// ============================================================
// INITIAL CONSOLE MESSAGE
// ============================================================

console.log(
    "Localeify MapLibre module initialized."
);