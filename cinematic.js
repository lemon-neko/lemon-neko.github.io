(function () {
  "use strict";

  var body = document.body;
  var grain = document.querySelector(".cinematic-grain");
  var portrait = document.querySelector("[data-cinematic-parallax]");
  var cinematicVideo = document.querySelector("[data-cinematic-video]");
  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll("[data-cinematic-reveal]")
  );
  var spotlightTargets = Array.prototype.slice.call(
    document.querySelectorAll("[data-cinematic-spotlight]")
  );
  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarsePointer = window.matchMedia("(pointer: coarse)");
  var networkInformation = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var glitchTimer = 0;
  var videoFailed = false;
  var videoPlaybackBlocked = false;

  function shouldUseStaticVideo() {
    return motionPreference.matches || Boolean(networkInformation && networkInformation.saveData) || videoFailed || videoPlaybackBlocked;
  }

  function updateVideoPlayback() {
    if (!cinematicVideo) return;

    var useStaticVideo = shouldUseStaticVideo();
    body.classList.toggle("cinematic-video-static", useStaticVideo);

    if (useStaticVideo || document.hidden) {
      cinematicVideo.pause();
      return;
    }

    cinematicVideo.muted = true;
    var playback = cinematicVideo.play();
    if (!playback || typeof playback.catch !== "function") return;

    playback.catch(function (error) {
      if (error && error.name === "AbortError") return;
      videoPlaybackBlocked = true;
      body.classList.add("cinematic-video-static");
    });
  }

  function setupCinematicVideo() {
    if (!cinematicVideo) return;

    cinematicVideo.muted = true;
    cinematicVideo.defaultMuted = true;

    function markReady() {
      cinematicVideo.classList.add("is-video-ready");
    }

    if (cinematicVideo.readyState >= 2) markReady();
    cinematicVideo.addEventListener("loadeddata", markReady, { once: true });
    cinematicVideo.addEventListener("error", function () {
      videoFailed = true;
      body.classList.add("cinematic-video-static");
    }, { once: true });
  }

  function generateGrainTexture() {
    if (!grain) return;

    try {
      var canvas = document.createElement("canvas");
      var size = 72;
      canvas.width = size;
      canvas.height = size;

      var context = canvas.getContext("2d");
      if (!context) return;

      var texture = context.createImageData(size, size);
      for (var index = 0; index < texture.data.length; index += 4) {
        var value = Math.floor(150 + Math.random() * 105);
        texture.data[index] = value;
        texture.data[index + 1] = value;
        texture.data[index + 2] = value;
        texture.data[index + 3] = Math.floor(22 + Math.random() * 34);
      }

      context.putImageData(texture, 0, 0);
      grain.style.setProperty(
        "--cinematic-grain-texture",
        "url(" + canvas.toDataURL("image/png") + ")"
      );
    } catch (error) {
      // The atmosphere is decorative; the page remains complete without canvas.
    }
  }

  function revealSections() {
    if (motionPreference.matches || !("IntersectionObserver" in window)) return;

    revealTargets.forEach(function (target) {
      target.classList.add("cinematic-reveal-pending");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-cinematic-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.08
      }
    );

    revealTargets.forEach(function (target) {
      observer.observe(target);
    });
  }

  function resetPortrait() {
    if (!portrait) return;
    portrait.style.setProperty("--portrait-x", "0px");
    portrait.style.setProperty("--portrait-y", "0px");
    portrait.style.setProperty("--portrait-rotate-x", "0deg");
    portrait.style.setProperty("--portrait-rotate-y", "0deg");
  }

  function setupPortraitParallax() {
    if (!portrait) return;

    var frame = 0;
    var pointerX = 0;
    var pointerY = 0;

    portrait.addEventListener("pointermove", function (event) {
      if (motionPreference.matches || coarsePointer.matches || event.pointerType === "touch") return;

      var bounds = portrait.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));

      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        portrait.style.setProperty("--portrait-x", (pointerX * 6).toFixed(2) + "px");
        portrait.style.setProperty("--portrait-y", (pointerY * 6).toFixed(2) + "px");
        portrait.style.setProperty("--portrait-rotate-x", (pointerY * -3).toFixed(2) + "deg");
        portrait.style.setProperty("--portrait-rotate-y", (pointerX * 3).toFixed(2) + "deg");
        frame = 0;
      });
    });

    portrait.addEventListener("pointerleave", resetPortrait);
  }

  function resetSpotlights() {
    spotlightTargets.forEach(function (target) {
      target.style.setProperty("--spotlight-opacity", "0");
    });
  }

  function setupSpotlights() {
    spotlightTargets.forEach(function (target) {
      var frame = 0;
      var x = 0;
      var y = 0;

      target.addEventListener("pointermove", function (event) {
        if (motionPreference.matches || coarsePointer.matches || event.pointerType === "touch") return;

        var bounds = target.getBoundingClientRect();
        x = event.clientX - bounds.left;
        y = event.clientY - bounds.top;

        if (frame) return;
        frame = window.requestAnimationFrame(function () {
          target.style.setProperty("--spotlight-x", x.toFixed(1) + "px");
          target.style.setProperty("--spotlight-y", y.toFixed(1) + "px");
          target.style.setProperty("--spotlight-opacity", "1");
          frame = 0;
        });
      });

      target.addEventListener("pointerleave", function () {
        target.style.setProperty("--spotlight-opacity", "0");
      });
    });
  }

  function handlePreferenceChange() {
    if (motionPreference.matches || coarsePointer.matches) {
      resetPortrait();
      resetSpotlights();
    }

    if (motionPreference.matches) {
      revealTargets.forEach(function (target) {
        target.classList.add("is-cinematic-visible");
      });
      body.classList.remove("cinematic-neko-glitch");
    }

    updateVideoPlayback();
  }

  function handleVisibilityChange() {
    body.classList.toggle("effects-paused", document.hidden);
    updateVideoPlayback();
  }

  window.addEventListener("yubai:neko-found", function () {
    if (motionPreference.matches) return;

    window.clearTimeout(glitchTimer);
    body.classList.remove("cinematic-neko-glitch");
    void body.offsetWidth;
    body.classList.add("cinematic-neko-glitch");

    glitchTimer = window.setTimeout(function () {
      body.classList.remove("cinematic-neko-glitch");
    }, 700);
  });

  generateGrainTexture();
  setupCinematicVideo();
  revealSections();
  setupPortraitParallax();
  setupSpotlights();
  handleVisibilityChange();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  motionPreference.addEventListener("change", handlePreferenceChange);
  coarsePointer.addEventListener("change", handlePreferenceChange);
  if (networkInformation && typeof networkInformation.addEventListener === "function") {
    networkInformation.addEventListener("change", handlePreferenceChange);
  }
})();
