// ============================================================
// PLACEFUL — create experience flow
// Depends on: api.js, map.js
// ============================================================

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

  if (selectedLocationLabel) {
    selectedLocationLabel.textContent =
      "Location: " +
      selectedLatitude.toFixed(5) +
      ", " +
      selectedLongitude.toFixed(5);
  }
  if (typeof setExperienceFormStep === "function") {
    setExperienceFormStep(1);
  }
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
  if (typeof setExperienceFormStep === "function") {
    setExperienceFormStep(1);
  }
  if (selectedLocationLabel) {
    selectedLocationLabel.textContent = "";
  }
  unlockMainMap();
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


// ----------------------------------------------------------
// CREATE FORM STEPS: story → visibility → anonymity
// ----------------------------------------------------------

let experienceFormStep = 1;
const experienceStep1 = document.getElementById("experience-step-1");
const experienceStep2 = document.getElementById("experience-step-2");
const experienceStep3 = document.getElementById("experience-step-3");
const experienceStepNext = document.getElementById("experience-step-next");
const experienceStepBack = document.getElementById("experience-step-back");
const experienceSubmitBtn = document.getElementById("experience-submit-btn");
const experienceFormStepLabel = document.getElementById("experience-form-step-label");
const selectedLocationLabel = document.getElementById("selected-location-label");

function setExperienceFormStep(step) {
  experienceFormStep = step;
  if (experienceStep1) experienceStep1.hidden = step !== 1;
  if (experienceStep2) experienceStep2.hidden = step !== 2;
  if (experienceStep3) experienceStep3.hidden = step !== 3;

  if (experienceStepBack) experienceStepBack.hidden = step === 1;
  if (experienceStepNext) experienceStepNext.hidden = step === 3;
  if (experienceSubmitBtn) experienceSubmitBtn.hidden = step !== 3;

  if (experienceFormStepLabel) {
    if (step === 1) experienceFormStepLabel.textContent = "Step 1 of 3 — Story & photos";
    if (step === 2) experienceFormStepLabel.textContent = "Step 2 of 3 — Visibility";
    if (step === 3) experienceFormStepLabel.textContent = "Step 3 of 3 — Identity";
  }
}

function validateExperienceStep1() {
  const title = document.getElementById("experience-title").value.trim();
  const story = document.getElementById("experience-description").value.trim();
  const emotion = document.getElementById("experience-emotion").value;
  if (!title || !story || !emotion) {
    alert("Please fill in title, story, and emotion.");
    return false;
  }
  return true;
}

if (experienceStepNext) {
  experienceStepNext.addEventListener("click", function () {
    if (experienceFormStep === 1) {
      if (!validateExperienceStep1()) return;
      setExperienceFormStep(2);
      return;
    }
    if (experienceFormStep === 2) {
      setExperienceFormStep(3);
    }
  });
}

if (experienceStepBack) {
  experienceStepBack.addEventListener("click", function () {
    if (experienceFormStep === 3) setExperienceFormStep(2);
    else if (experienceFormStep === 2) setExperienceFormStep(1);
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

    const visibilityInput = document.querySelector(
      'input[name="visibility"]:checked'
    );
    const anonymousInput = document.querySelector(
      'input[name="is_anonymous"]:checked'
    );

    const experience = {
      title: title,
      story: story,
      emotion: emotion,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      visibility: visibilityInput ? visibilityInput.value : "public",
      is_anonymous: anonymousInput ? anonymousInput.value === "true" : false
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

      const result = await response.json();
      const createdId = result && result.id;
      const files =
        experienceMediaInput && experienceMediaInput.files
          ? Array.from(experienceMediaInput.files)
          : [];

      if (createdId && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const formData = new FormData();
          formData.append("file", files[i]);
          try {
            const uploadResponse = await authenticatedFetch(
              API_BASE_URL + "/experiences/" + createdId + "/media",
              { method: "POST", body: formData }
            );
            if (!uploadResponse.ok) {
              console.error("Media upload failed:", await uploadResponse.text());
            }
          } catch (uploadError) {
            console.error("Media upload error:", uploadError);
          }
        }
      }

      closeExperienceFormAndReset();
      await loadExperiences();
    } catch (error) {
      console.error("Failed to create experience:", error);
      alert(error.message || "Could not save this experience.");
    }
  });
}

