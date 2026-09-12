
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from geoalchemy2 import WKTElement

import httpx
import math

from app.database import get_db
from app.models import Place, User
from app.schemas import (
    PlaceCreate,
    PlaceResponse,
    PlaceCandidate,
    PlaceIdentificationResponse
)
from app.dependencies import get_current_user


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/places",
    tags=["Places"]
)


# ============================================================
# CONSTANTS
# ============================================================

SEARCH_RADII = [
    50,
    100,
    200
]

MIN_CANDIDATES = 10
MAX_CANDIDATES = 15

# ------------------------------------------------------------
# Text-search radius
#
# Nominatim search results are restricted to this distance
# from the user's selected location.
# ------------------------------------------------------------

TEXT_SEARCH_RADIUS = 5000

TEXT_SEARCH_MAX_RESULTS = 10


# ============================================================
# DISTANCE
# ============================================================

def calculate_distance(
    latitude1,
    longitude1,
    latitude2,
    longitude2
):

    earth_radius = 6371000

    latitude1 = math.radians(latitude1)
    latitude2 = math.radians(latitude2)

    delta_latitude = math.radians(
        latitude2 - latitude1
    )

    delta_longitude = math.radians(
        longitude2 - longitude1
    )

    a = (
        math.sin(delta_latitude / 2) ** 2
        +
        math.cos(latitude1)
        *
        math.cos(latitude2)
        *
        math.sin(delta_longitude / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return round(
        earth_radius * c,
        1
    )


# ============================================================
# OSM CATEGORY
# ============================================================

def get_category(tags):

    category_priority = [
        "amenity",
        "tourism",
        "historic",
        "leisure",
        "shop",
        "office",
        "public_transport",
        "natural",
        "landmark"
    ]

    for key in category_priority:

        value = tags.get(key)

        if value:
            return value

    return None


# ============================================================
# MEANINGFUL OSM OBJECT
# ============================================================

def is_meaningful_object(tags):

    if not tags:
        return False


    name = tags.get("name")

    if not name:
        return False


    # --------------------------------------------------------
    # Reject administrative / infrastructure objects
    # --------------------------------------------------------

    if tags.get("boundary"):
        return False


    if tags.get("route"):
        return False


    if tags.get("highway"):
        return False


    # --------------------------------------------------------
    # Reject generic settlement / neighbourhood objects
    # --------------------------------------------------------

    place_type = tags.get("place")

    rejected_place_types = {
        "neighbourhood",
        "suburb",
        "quarter",
        "district",
        "city_block",
        "residential"
    }

    if place_type in rejected_place_types:
        return False


    # --------------------------------------------------------
    # Reject generic buildings
    #
    # A building is accepted when it also has a meaningful
    # POI tag such as amenity, tourism, shop, etc.
    # --------------------------------------------------------

    if tags.get("building"):

        meaningful_tags = {
            "amenity",
            "tourism",
            "historic",
            "leisure",
            "shop",
            "office",
            "public_transport",
            "natural",
            "landmark"
        }

        if not any(
            tags.get(key)
            for key in meaningful_tags
        ):
            return False


    return True


# ============================================================
# CATEGORY SCORE
# ============================================================

def get_category_score(tags):

    amenity = tags.get("amenity")
    tourism = tags.get("tourism")
    historic = tags.get("historic")
    leisure = tags.get("leisure")
    shop = tags.get("shop")
    office = tags.get("office")
    public_transport = tags.get("public_transport")
    natural = tags.get("natural")
    landmark = tags.get("landmark")


    # --------------------------------------------------------
    # Very important amenities
    # --------------------------------------------------------

    important_amenities = {
        "university",
        "college",
        "school",
        "hospital",
        "clinic",
        "library",
        "museum",
        "theatre",
        "cinema",
        "place_of_worship",
        "community_centre",
        "marketplace",
        "townhall",
        "courthouse"
    }

    if amenity in important_amenities:
        return 100


    # --------------------------------------------------------
    # Important tourism places
    # --------------------------------------------------------

    important_tourism = {
        "museum",
        "attraction",
        "gallery",
        "viewpoint",
        "hotel",
        "information"
    }

    if tourism in important_tourism:
        return 95


    # --------------------------------------------------------
    # Historic places
    # --------------------------------------------------------

    important_historic = {
        "monument",
        "memorial",
        "castle",
        "archaeological_site",
        "ruins",
        "building"
    }

    if historic in important_historic:
        return 90


    # --------------------------------------------------------
    # Important leisure places
    # --------------------------------------------------------

    important_leisure = {
        "park",
        "garden",
        "stadium",
        "sports_centre",
        "swimming_pool",
        "playground"
    }

    if leisure in important_leisure:
        return 85


    # --------------------------------------------------------
    # Landmarks
    # --------------------------------------------------------

    if landmark:
        return 85


    # --------------------------------------------------------
    # Other meaningful POIs
    # --------------------------------------------------------

    if amenity:
        return 75


    if tourism:
        return 75


    if shop:
        return 70


    if leisure:
        return 70


    if public_transport:
        return 65


    if natural:
        return 65


    if office:
        return 60


    # --------------------------------------------------------
    # Generic meaningful named object
    # --------------------------------------------------------

    return 50


# ============================================================
# CANDIDATE SCORE
# ============================================================

def calculate_candidate_score(
    candidate
):

    category_score = candidate[
        "category_score"
    ]

    distance = candidate[
        "distance"
    ]

    distance_score = max(
        0,
        200 - (distance / 5)
    )

    return (
        distance_score
        +
        category_score
    )


# ============================================================
# COORDINATES
# ============================================================

def get_element_coordinates(
    element
):

    element_type = element.get(
        "type"
    )


    # --------------------------------------------------------
    # Node
    # --------------------------------------------------------

    if element_type == "node":

        latitude = element.get(
            "lat"
        )

        longitude = element.get(
            "lon"
        )

        if (
            latitude is not None
            and longitude is not None
        ):

            return (
                latitude,
                longitude
            )


    # --------------------------------------------------------
    # Way / relation
    #
    # Overpass returns the center because the query uses:
    #
    # out center tags;
    # --------------------------------------------------------

    center = element.get(
        "center"
    )

    if center:

        latitude = center.get(
            "lat"
        )

        longitude = center.get(
            "lon"
        )

        if (
            latitude is not None
            and longitude is not None
        ):

            return (
                latitude,
                longitude
            )


    return None, None


# ============================================================
# OVERPASS QUERY
# ============================================================

def build_overpass_query(
    latitude,
    longitude,
    radius
):

    return f"""
[out:json][timeout:20];

(
    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["amenity"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["tourism"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["historic"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["leisure"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["shop"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["office"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["public_transport"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["natural"];

    nwr(
        around:{radius},
        {latitude},
        {longitude}
    )["name"]["landmark"];
);

out center tags;
"""


# ============================================================
# CANDIDATE CONVERSION
# ============================================================

def convert_overpass_candidate(
    element,
    latitude,
    longitude
):

    tags = element.get(
        "tags",
        {}
    )


    # --------------------------------------------------------
    # Filter
    # --------------------------------------------------------

    if not is_meaningful_object(
        tags
    ):

        return None


    # --------------------------------------------------------
    # Coordinates
    # --------------------------------------------------------

    candidate_latitude, candidate_longitude = (
        get_element_coordinates(
            element
        )
    )


    if (
        candidate_latitude is None
        or candidate_longitude is None
    ):

        return None


    # --------------------------------------------------------
    # Category
    # --------------------------------------------------------

    category = get_category(
        tags
    )


    if not category:

        return None


    # --------------------------------------------------------
    # Distance
    # --------------------------------------------------------

    distance = calculate_distance(
        latitude,
        longitude,
        candidate_latitude,
        candidate_longitude
    )


    # --------------------------------------------------------
    # Category score
    # --------------------------------------------------------

    category_score = get_category_score(
        tags
    )


    # --------------------------------------------------------
    # Candidate
    # --------------------------------------------------------

    candidate = {
        "name": tags.get(
            "name"
        ),

        "category": category,

        "address": (
            tags.get("addr:full")
            or tags.get("addr:street")
        ),

        "city": tags.get(
            "addr:city"
        ),

        "country": tags.get(
            "addr:country"
        ),

        "latitude": candidate_latitude,

        "longitude": candidate_longitude,

        "distance": distance,

        "osm_type": element.get(
            "type"
        ),

        "osm_id": str(
            element.get("id")
        ),

        "display_name": tags.get(
            "name"
        ),

        "category_score": category_score
    }


    candidate[
        "total_score"
    ] = calculate_candidate_score(
        candidate
    )


    return candidate


# ============================================================
# DEDUPLICATION
# ============================================================

def deduplicate_candidates(
    candidates
):

    unique_candidates = {}


    for candidate in candidates:

        osm_type = candidate.get(
            "osm_type"
        )

        osm_id = candidate.get(
            "osm_id"
        )


        # ----------------------------------------------------
        # Strong identity:
        # OSM type + OSM ID
        # ----------------------------------------------------

        if (
            osm_type
            and osm_id
        ):

            key = (
                "osm",
                osm_type,
                osm_id
            )


        else:

            # ------------------------------------------------
            # Fallback identity:
            # name + approximate location
            # ------------------------------------------------

            key = (
                "location",
                (
                    candidate["name"]
                    or ""
                ).strip().lower(),
                round(
                    candidate["latitude"],
                    4
                ),
                round(
                    candidate["longitude"],
                    4
                )
            )


        existing = unique_candidates.get(
            key
        )


        if existing is None:

            unique_candidates[
                key
            ] = candidate

            continue


        if (
            candidate[
                "total_score"
            ]
            >
            existing[
                "total_score"
            ]
        ):

            unique_candidates[
                key
            ] = candidate


    return list(
        unique_candidates.values()
    )


# ============================================================
# SORT CANDIDATES
# ============================================================

def sort_candidates(
    candidates
):

    return sorted(
        candidates,
        key=lambda candidate: (
            -candidate[
                "total_score"
            ],
            candidate[
                "distance"
            ]
        )
    )


# ============================================================
# BUILD SEARCH VIEWBOX
# ============================================================

def build_search_viewbox(
    latitude,
    longitude,
    radius
):

    earth_radius = 6371000

    # --------------------------------------------------------
    # Latitude degrees per metre
    # --------------------------------------------------------

    latitude_delta = (
        radius / earth_radius
    ) * (
        180 / math.pi
    )


    # --------------------------------------------------------
    # Longitude degrees per metre
    #
    # Longitude spacing changes with latitude.
    # --------------------------------------------------------

    longitude_delta = (
        radius
        /
        (
            earth_radius
            *
            math.cos(
                math.radians(latitude)
            )
        )
    ) * (
        180 / math.pi
    )


    min_latitude = max(
        -90,
        latitude - latitude_delta
    )

    max_latitude = min(
        90,
        latitude + latitude_delta
    )

    min_longitude = max(
        -180,
        longitude - longitude_delta
    )

    max_longitude = min(
        180,
        longitude + longitude_delta
    )


    # --------------------------------------------------------
    # Nominatim format:
    #
    # left,top,right,bottom
    #
    # longitude, latitude,
    # longitude, latitude
    # --------------------------------------------------------

    return (
        f"{min_longitude},"
        f"{max_latitude},"
        f"{max_longitude},"
        f"{min_latitude}"
    )


# ============================================================
# NOMINATIM SEARCH CANDIDATE
# ============================================================

def convert_nominatim_candidate(
    result,
    latitude,
    longitude
):

    result_latitude = result.get(
        "lat"
    )

    result_longitude = result.get(
        "lon"
    )


    if (
        result_latitude is None
        or result_longitude is None
    ):

        return None


    try:

        result_latitude = float(
            result_latitude
        )

        result_longitude = float(
            result_longitude
        )

    except (
        TypeError,
        ValueError
    ):

        return None


    name = result.get(
        "name"
    )


    # --------------------------------------------------------
    # Some Nominatim results may not have a separate name.
    #
    # For those results, use the first useful part of the
    # display name.
    # --------------------------------------------------------

    if not name:

        display_name = result.get(
            "display_name"
        )

        if display_name:

            name = (
                display_name
                .split(",")[0]
                .strip()
            )


    if not name:

        return None


    address_data = result.get(
        "address",
        {}
    )


    city = (
        address_data.get("city")
        or address_data.get("town")
        or address_data.get("village")
        or address_data.get("municipality")
    )


    country = address_data.get(
        "country"
    )


    address = (
        result.get(
            "display_name"
        )
    )


    category = (
        result.get("type")
        or result.get("category")
        or "place"
    )


    osm_type = result.get(
        "osm_type"
    )


    osm_id = result.get(
        "osm_id"
    )


    if osm_id is not None:

        osm_id = str(
            osm_id
        )


    distance = calculate_distance(
        latitude,
        longitude,
        result_latitude,
        result_longitude
    )


    # --------------------------------------------------------
    # Nominatim's importance is useful as a secondary signal.
    #
    # Distance remains the primary ranking factor for this
    # Placeful search.
    # --------------------------------------------------------

    importance = result.get(
        "importance"
    )


    try:

        importance = float(
            importance
        )

    except (
        TypeError,
        ValueError
    ):

        importance = 0


    return {
        "name": name,

        "category": category,

        "address": address,

        "city": city,

        "country": country,

        "latitude": result_latitude,

        "longitude": result_longitude,

        "distance": distance,

        "osm_type": osm_type,

        "osm_id": osm_id,

        "display_name": result.get(
            "display_name"
        ),

        "importance": importance
    }


# ============================================================
# SORT SEARCH RESULTS
# ============================================================

def sort_search_candidates(
    candidates
):

    return sorted(
        candidates,
        key=lambda candidate: (
            candidate[
                "distance"
            ],
            -candidate[
                "importance"
            ]
        )
    )


# ============================================================
# IDENTIFY PLACE
# ============================================================

@router.get(
    "/identify",
    response_model=PlaceIdentificationResponse
)
def identify_place(
    latitude: float = Query(...),
    longitude: float = Query(...)
):

    # --------------------------------------------------------
    # Validate coordinates
    # --------------------------------------------------------

    if not (
        -90 <= latitude <= 90
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude."
        )


    if not (
        -180 <= longitude <= 180
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid longitude."
        )


    # --------------------------------------------------------
    # HTTP configuration
    # --------------------------------------------------------

    headers = {
        "User-Agent": (
            "Placeful/1.0 "
            "(place-based social experience application)"
        )
    }


    reverse_url = (
        "https://nominatim.openstreetmap.org/reverse"
    )


    reverse_params = {
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "addressdetails": 1,
        "namedetails": 1,
        "zoom": 18
    }


    overpass_url = (
        "https://overpass-api.de/api/interpreter"
    )


    # ========================================================
    # REVERSE GEOCODING
    # ========================================================

    reverse_data = {}


    try:

        with httpx.Client(
            headers=headers,
            timeout=20
        ) as client:

            reverse_response = client.get(
                reverse_url,
                params=reverse_params
            )

            reverse_response.raise_for_status()

            reverse_data = (
                reverse_response.json()
            )

    except httpx.HTTPError:

        reverse_data = {}


    # ========================================================
    # ADAPTIVE OVERPASS SEARCH
    # ========================================================

    candidates = []


    for radius in SEARCH_RADII:

        overpass_query = (
            build_overpass_query(
                latitude,
                longitude,
                radius
            )
        )


        try:

            with httpx.Client(
                headers=headers,
                timeout=20
            ) as client:

                overpass_response = (
                    client.post(
                        overpass_url,
                        data={
                            "data": overpass_query
                        }
                    )
                )

                overpass_response.raise_for_status()

                overpass_data = (
                    overpass_response.json()
                )


        except httpx.HTTPError:

            continue


        radius_candidates = []


        for element in overpass_data.get(
            "elements",
            []
        ):

            candidate = (
                convert_overpass_candidate(
                    element,
                    latitude,
                    longitude
                )
            )


            if candidate:

                radius_candidates.append(
                    candidate
                )


        # ----------------------------------------------------
        # Deduplicate
        # ----------------------------------------------------

        radius_candidates = (
            deduplicate_candidates(
                radius_candidates
            )
        )


        # ----------------------------------------------------
        # Sort
        # ----------------------------------------------------

        radius_candidates = (
            sort_candidates(
                radius_candidates
            )
        )


        candidates = radius_candidates


        # ----------------------------------------------------
        # Enough meaningful candidates
        #
        # Stop expanding the search radius.
        # ----------------------------------------------------

        if len(candidates) >= MIN_CANDIDATES:

            break


    # ========================================================
    # ADD USEFUL NOMINATIM RESULT
    # ========================================================

    reverse_name = reverse_data.get(
        "name"
    )

    reverse_latitude = reverse_data.get(
        "lat"
    )

    reverse_longitude = reverse_data.get(
        "lon"
    )

    reverse_address = reverse_data.get(
        "display_name"
    )

    reverse_category = reverse_data.get(
        "type"
    )

    reverse_osm_type = reverse_data.get(
        "osm_type"
    )

    reverse_osm_id = reverse_data.get(
        "osm_id"
    )


    useful_reverse_types = {
        "museum",
        "attraction",
        "gallery",
        "hotel",
        "restaurant",
        "cafe",
        "hospital",
        "school",
        "university",
        "college",
        "library",
        "theatre",
        "cinema",
        "park",
        "garden",
        "stadium",
        "monument",
        "memorial",
        "mall",
        "market",
        "supermarket",
        "place_of_worship",
        "townhall",
        "courthouse"
    }


    if (
        reverse_name
        and reverse_category
        in useful_reverse_types
        and reverse_latitude is not None
        and reverse_longitude is not None
    ):

        reverse_candidate = {
            "name": reverse_name,

            "category": reverse_category,

            "address": reverse_address,

            "city": (
                reverse_data
                .get("address", {})
                .get("city")
                or
                reverse_data
                .get("address", {})
                .get("town")
                or
                reverse_data
                .get("address", {})
                .get("village")
            ),

            "country": (
                reverse_data
                .get("address", {})
                .get("country")
            ),

            "latitude": float(
                reverse_latitude
            ),

            "longitude": float(
                reverse_longitude
            ),

            "distance": calculate_distance(
                latitude,
                longitude,
                float(reverse_latitude),
                float(reverse_longitude)
            ),

            "osm_type": reverse_osm_type,

            "osm_id": (
                str(reverse_osm_id)
                if reverse_osm_id
                else None
            ),

            "display_name": (
                reverse_data.get(
                    "display_name"
                )
            ),

            "category_score": (
                get_category_score(
                    {
                        reverse_category:
                        reverse_category
                    }
                )
            )
        }


        reverse_candidate[
            "total_score"
        ] = calculate_candidate_score(
            reverse_candidate
        )


        candidates.append(
            reverse_candidate
        )


    # ========================================================
    # FINAL DEDUPLICATION
    # ========================================================

    candidates = deduplicate_candidates(
        candidates
    )


    # ========================================================
    # FINAL SORT
    # ========================================================

    candidates = sort_candidates(
        candidates
    )


    # ========================================================
    # RETURN BEST CANDIDATES
    # ========================================================

    final_candidates = []


    for candidate in candidates:

        final_candidates.append(
            {
                "name": candidate[
                    "name"
                ],

                "category": candidate[
                    "category"
                ],

                "address": candidate[
                    "address"
                ],

                "city": candidate[
                    "city"
                ],

                "country": candidate[
                    "country"
                ],

                "latitude": candidate[
                    "latitude"
                ],

                "longitude": candidate[
                    "longitude"
                ],

                "distance": candidate[
                    "distance"
                ],

                "osm_type": candidate[
                    "osm_type"
                ],

                "osm_id": candidate[
                    "osm_id"
                ],

                "display_name": candidate[
                    "display_name"
                ]
            }
        )


    return {
        "candidates": final_candidates[
            :MAX_CANDIDATES
        ]
    }


# ============================================================
# SEARCH OSM PLACE
# ============================================================

@router.get(
    "/search",
    response_model=PlaceIdentificationResponse
)
def search_places(
    q: str = Query(
        ...,
        min_length=2
    ),
    latitude: float = Query(...),
    longitude: float = Query(...)
):

    # --------------------------------------------------------
    # Validate coordinates
    # --------------------------------------------------------

    if not (
        -90 <= latitude <= 90
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude."
        )


    if not (
        -180 <= longitude <= 180
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid longitude."
        )


    # --------------------------------------------------------
    # Validate search text
    # --------------------------------------------------------

    search_text = q.strip()


    if len(search_text) < 2:

        raise HTTPException(
            status_code=400,
            detail=(
                "Search text must contain "
                "at least 2 characters."
            )
        )


    # --------------------------------------------------------
    # Build geographic search area
    #
    # The ORIGINAL experience location is the center.
    # --------------------------------------------------------

    viewbox = build_search_viewbox(
        latitude,
        longitude,
        TEXT_SEARCH_RADIUS
    )


    # --------------------------------------------------------
    # Nominatim
    # --------------------------------------------------------

    nominatim_url = (
        "https://nominatim.openstreetmap.org/search"
    )


    headers = {
        "User-Agent": (
            "Placeful/1.0 "
            "(place-based social experience application)"
        )
    }


    params = {
        "q": search_text,

        "format": "jsonv2",

        "addressdetails": 1,

        "namedetails": 1,

        "limit": TEXT_SEARCH_MAX_RESULTS,

        "viewbox": viewbox,

        "bounded": 1,

        "dedupe": 1
    }


    try:

        with httpx.Client(
            headers=headers,
            timeout=20
        ) as client:

            response = client.get(
                nominatim_url,
                params=params
            )

            response.raise_for_status()

            results = response.json()


    except httpx.HTTPError:

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to search OpenStreetMap "
                "at this time."
            )
        )


    # --------------------------------------------------------
    # Convert results
    # --------------------------------------------------------

    candidates = []


    for result in results:

        candidate = (
            convert_nominatim_candidate(
                result,
                latitude,
                longitude
            )
        )


        if candidate:

            candidates.append(
                candidate
            )


    # --------------------------------------------------------
    # Deduplicate
    # --------------------------------------------------------

    unique_candidates = {}


    for candidate in candidates:

        osm_type = candidate.get(
            "osm_type"
        )

        osm_id = candidate.get(
            "osm_id"
        )


        if (
            osm_type
            and osm_id
        ):

            key = (
                "osm",
                osm_type,
                osm_id
            )

        else:

            key = (
                "location",
                (
                    candidate["name"]
                    or ""
                ).strip().lower(),
                round(
                    candidate["latitude"],
                    4
                ),
                round(
                    candidate["longitude"],
                    4
                )
            )


        existing = unique_candidates.get(
            key
        )


        if existing is None:

            unique_candidates[
                key
            ] = candidate

            continue


        if (
            candidate["distance"]
            <
            existing["distance"]
        ):

            unique_candidates[
                key
            ] = candidate


    candidates = list(
        unique_candidates.values()
    )


    # --------------------------------------------------------
    # Sort by distance first
    #
    # This is intentional.
    #
    # For example, if "Imam Khomeini Street" exists in
    # several nearby places, the result closest to the
    # user's selected location appears first.
    # --------------------------------------------------------

    candidates = sort_search_candidates(
        candidates
    )


    # --------------------------------------------------------
    # Return PlaceCandidate-compatible response
    # --------------------------------------------------------

    final_candidates = []


    for candidate in candidates:

        final_candidates.append(
            {
                "name": candidate[
                    "name"
                ],

                "category": candidate[
                    "category"
                ],

                "address": candidate[
                    "address"
                ],

                "city": candidate[
                    "city"
                ],

                "country": candidate[
                    "country"
                ],

                "latitude": candidate[
                    "latitude"
                ],

                "longitude": candidate[
                    "longitude"
                ],

                "distance": candidate[
                    "distance"
                ],

                "osm_type": candidate[
                    "osm_type"
                ],

                "osm_id": candidate[
                    "osm_id"
                ],

                "display_name": candidate[
                    "display_name"
                ]
            }
        )


    return {
        "candidates": final_candidates
    }


# ============================================================
# GET PLACE
# ============================================================

@router.get(
    "/{place_id}",
    response_model=PlaceResponse
)
def get_place(
    place_id,
    db: Session = Depends(get_db)
):

    place = (
        db.query(Place)
        .filter(
            Place.id == place_id
        )
        .first()
    )

    if place is None:

        raise HTTPException(
            status_code=404,
            detail="Place not found."
        )


    # --------------------------------------------------------
    # Extract coordinates from PostGIS
    # --------------------------------------------------------

    coordinates = db.execute(
        text("""
            SELECT
                ST_Y(location) AS latitude,
                ST_X(location) AS longitude
            FROM places
            WHERE id = :place_id
        """),
        {
            "place_id": place.id
        }
    ).mappings().first()


    latitude = None
    longitude = None

    if coordinates:

        latitude = coordinates["latitude"]

        longitude = coordinates["longitude"]


    return {
        "id": place.id,

        "name": place.name,

        "description":
            place.description,

        "category":
            place.category,

        "latitude":
            latitude,

        "longitude":
            longitude,

        "address":
            place.address,

        "city":
            place.city,

        "country":
            place.country,

        "osm_type":
            place.osm_type,

        "osm_id":
            place.osm_id,

        "created_at":
            place.created_at,

        "updated_at":
            place.updated_at
    }


# ============================================================
# CREATE PLACE
# ============================================================

@router.post(
    "/",
    response_model=PlaceResponse
)
def create_place(
    place: PlaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):


    # --------------------------------------------------------
    # Validate coordinates
    # --------------------------------------------------------

    if not (
        -90 <= place.latitude <= 90
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude."
        )

    if not (
        -180 <= place.longitude <= 180
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid longitude."
        )


    # --------------------------------------------------------
    # Reuse existing Placeful Place
    #
    # OSM identity is the stable external identity.
    # --------------------------------------------------------

    if (
        place.osm_type
        and place.osm_id
    ):

        existing_place = (
            db.query(Place)
            .filter(
                Place.osm_type
                == place.osm_type,
                Place.osm_id
                == place.osm_id
            )
            .first()
        )

        if existing_place:

            return {
                "id": existing_place.id,

                "name": existing_place.name,

                "description":
                    existing_place.description,

                "category":
                    existing_place.category,

                "latitude":
                    place.latitude,

                "longitude":
                    place.longitude,

                "address":
                    existing_place.address,

                "city":
                    existing_place.city,

                "country":
                    existing_place.country,

                "osm_type":
                    existing_place.osm_type,

                "osm_id":
                    existing_place.osm_id,

                "created_at":
                    existing_place.created_at,

                "updated_at":
                    existing_place.updated_at
            }


    # --------------------------------------------------------
    # Create new Placeful Place
    #
    # IMPORTANT:
    # These coordinates belong to the selected Place,
    # not necessarily to the user's original experience
    # location.
    # --------------------------------------------------------

    new_place = Place(

        name=place.name,

        description=place.description,

        category=place.category,

        location=WKTElement(
            f"POINT({place.longitude} {place.latitude})",
            srid=4326
        ),

        address=place.address,

        city=place.city,

        country=place.country,

        osm_type=place.osm_type,

        osm_id=place.osm_id
    )

    db.add(
        new_place
    )

    try:
        db.commit()
        db.refresh(new_place)
    except Exception:
        db.rollback()

        # Concurrent create: another request inserted the same OSM place
        if place.osm_type and place.osm_id:
            existing_place = (
                db.query(Place)
                .filter(
                    Place.osm_type == place.osm_type,
                    Place.osm_id == place.osm_id,
                )
                .first()
            )
            if existing_place is not None:
                return {
                    "id": existing_place.id,
                    "name": existing_place.name,
                    "description": existing_place.description,
                    "category": existing_place.category,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                    "address": existing_place.address,
                    "city": existing_place.city,
                    "country": existing_place.country,
                    "osm_type": existing_place.osm_type,
                    "osm_id": existing_place.osm_id,
                    "created_at": existing_place.created_at,
                    "updated_at": existing_place.updated_at,
                }

        raise HTTPException(
            status_code=500,
            detail="Failed to create place.",
        )


    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "id": new_place.id,

        "name": new_place.name,

        "description":
            new_place.description,

        "category":
            new_place.category,

        "latitude":
            place.latitude,

        "longitude":
            place.longitude,

        "address":
            new_place.address,

        "city":
            new_place.city,

        "country":
            new_place.country,

        "osm_type":
            new_place.osm_type,

        "osm_id":
            new_place.osm_id,

        "created_at":
            new_place.created_at,

        "updated_at":
            new_place.updated_at
    }

