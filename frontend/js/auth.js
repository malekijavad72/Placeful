const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");

const userMenu = document.getElementById("user-menu");
const loggedInUsername = document.getElementById("logged-in-username");
const logoutBtn = document.getElementById("logout-btn");


// =====================================================
// SIGN IN MODAL
// =====================================================

function createSignInModal() {

    if (document.getElementById("sign-in-modal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "sign-in-modal";
    modal.className = "auth-modal-overlay";

    modal.innerHTML = `
        <div class="auth-modal">

            <button
                id="close-sign-in"
                class="auth-modal-close"
                type="button"
                aria-label="Close"
            >
                ×
            </button>

            <h2>Sign In</h2>

            <p class="auth-modal-description">
                Sign in to share and manage your experiences.
            </p>

            <form id="sign-in-form">

                <div class="auth-form-group">

                    <label for="sign-in-username">
                        Username or Email
                    </label>

                    <input
                        type="text"
                        id="sign-in-username"
                        name="username"
                        autocomplete="username"
                        required
                    >

                </div>

                <div class="auth-form-group">

                    <label for="sign-in-password">
                        Password
                    </label>

                    <input
                        type="password"
                        id="sign-in-password"
                        name="password"
                        autocomplete="current-password"
                        required
                    >

                </div>

                <div
                    id="sign-in-error"
                    class="auth-error"
                    style="display: none;"
                ></div>

                <button
                    type="submit"
                    class="auth-submit-btn"
                    id="submit-sign-in"
                >
                    Sign In
                </button>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    const closeButton = document.getElementById("close-sign-in");
    const form = document.getElementById("sign-in-form");

    closeButton.addEventListener("click", closeSignInModal);

    modal.addEventListener("click", function (event) {

        if (event.target === modal) {
            closeSignInModal();
        }

    });

    form.addEventListener("submit", handleSignIn);
}


// =====================================================
// OPEN / CLOSE MODAL
// =====================================================

function openSignInModal() {

    createSignInModal();

    const modal = document.getElementById("sign-in-modal");

    modal.classList.add("visible");

    document
        .getElementById("sign-in-username")
        .focus();
}


function closeSignInModal() {

    const modal = document.getElementById("sign-in-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("visible");
}


// =====================================================
// SIGN IN
// =====================================================

async function handleSignIn(event) {

    event.preventDefault();

    const usernameInput =
        document.getElementById("sign-in-username");

    const passwordInput =
        document.getElementById("sign-in-password");

    const errorElement =
        document.getElementById("sign-in-error");

    const submitButton =
        document.getElementById("submit-sign-in");

    const username =
        usernameInput.value.trim();

    const password =
        passwordInput.value;

    errorElement.style.display = "none";
    errorElement.textContent = "";

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";


    try {

        const response = await fetch(
            `${API_BASE_URL}/auth/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    username: username,
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Invalid username or password."
            );
        }


        if (!data.access_token) {

            throw new Error(
                "The server did not return an access token."
            );
        }


        // Save authentication token
        localStorage.setItem(
            "access_token",
            data.access_token
        );

        localStorage.setItem(
            "refresh_token",
            data.refresh_token
        );


        // Save the login identifier locally.
        // This is only for displaying the UI.
        localStorage.setItem(
            "logged_in_username",
            username
        );


        closeSignInModal();

        updateAuthenticationUI();


        console.log("Successfully signed in.");


    } catch (error) {

        console.error(
            "Sign in error:",
            error
        );

        errorElement.textContent =
            error.message ||
            "Unable to sign in.";

        errorElement.style.display = "block";


    } finally {

        submitButton.disabled = false;

        submitButton.textContent = "Sign In";
    }
}


// =====================================================
// LOG OUT
// =====================================================

function logout() {

    clearAuthenticationState();

}


// =====================================================
// AUTHENTICATION STATE
// =====================================================

function isLoggedIn() {

    return Boolean(
        localStorage.getItem("access_token")
    );
}


// =====================================================
// UPDATE HEADER
// =====================================================

function updateAuthenticationUI() {

    if (!signInBtn || !signUpBtn || !userMenu) {
        return;
    }


    if (isLoggedIn()) {

        signInBtn.style.display = "none";

        signUpBtn.style.display = "none";

        userMenu.style.display = "flex";


        const username =
            localStorage.getItem(
                "logged_in_username"
            );

        loggedInUsername.textContent =
            username || "User";

    } else {

        signInBtn.style.display = "inline-flex";

        signUpBtn.style.display = "inline-flex";

        userMenu.style.display = "none";

        loggedInUsername.textContent = "";
    }
}


// =====================================================
// GET AUTH TOKEN
// =====================================================

function getAccessToken() {

    return localStorage.getItem(
        "access_token"
    );
}

// =====================================================
// REFRESH ACCESS TOKEN
// =====================================================

async function refreshAccessToken() {

    const refreshToken =
        localStorage.getItem(
            "refresh_token"
        );

    if (!refreshToken) {

        throw new Error(
            "No refresh token available."
        );
    }


    const response = await fetch(
        `${API_BASE_URL}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`,
        {
            method: "POST"
        }
    );


    const data = await response.json();


    if (!response.ok) {

        throw new Error(
            data.detail ||
            "Unable to refresh access token."
        );
    }


    localStorage.setItem(
        "access_token",
        data.access_token
    );


    localStorage.setItem(
        "refresh_token",
        data.refresh_token
    );


    return data.access_token;
}


// =====================================================
// AUTHENTICATED REQUEST HELPER
// =====================================================
//
// We will use this later for:
// likes
// comments
// follows
// creating experiences
// media
// profile
// etc.
//
// =====================================================

async function authenticatedFetch(
    url,
    options = {}
) {

    const token = getAccessToken();


    if (!token) {

        const newAccessToken =
            await refreshAccessToken();

        const retryHeaders = {
            ...(options.headers || {}),

            "Authorization":
                `Bearer ${newAccessToken}`
        };

        return fetch(
            url,
            {
                ...options,
                headers: retryHeaders
            }
        );
    }


    const headers = {
        ...(options.headers || {}),

        "Authorization":
            `Bearer ${token}`
    };


    let response = await fetch(
        url,
        {
            ...options,
            headers: headers
        }
    );


    if (response.status === 401) {

        const newAccessToken =
            await refreshAccessToken();


        const retryHeaders = {
            ...(options.headers || {}),

            "Authorization":
                `Bearer ${newAccessToken}`
        };


        response = await fetch(
            url,
            {
                ...options,
                headers: retryHeaders
            }
        );
    }


    return response;
}


// =====================================================
// EVENT LISTENERS
// =====================================================

if (signInBtn) {

    signInBtn.addEventListener(
        "click",
        openSignInModal
    );
}


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        logout
    );
}


if (signUpBtn) {

    signUpBtn.addEventListener(
        "click",
        function () {

            alert(
                "Sign-up will be connected after the registration endpoint is added to the backend."
            );

        }
    );
}


// =====================================================
// INITIAL STATE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    updateAuthenticationUI
);

function clearAuthenticationState() {

    localStorage.removeItem(
        "access_token"
    );

    localStorage.removeItem(
        "logged_in_username"
    );

    updateAuthenticationUI();
}