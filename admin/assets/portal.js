(() => {
  "use strict";

  const userNameElements = document.querySelectorAll("[data-user-name]");
  const userRoleElements = document.querySelectorAll("[data-user-role]");
  const logoutButtons = document.querySelectorAll("[data-logout]");
  const menuButtons = document.querySelectorAll("[data-menu-toggle]");
  const sidebar = document.querySelector(".sidebar");
  const errorBanner = document.getElementById("errorBanner");

  function formatRole(role) {
    const normalized = String(role || "").trim().toLowerCase();

    if (normalized === "admin") {
      return "Administrator";
    }

    if (normalized === "operations") {
      return "Operations";
    }

    if (normalized === "read-only") {
      return "Read Only";
    }

    return role || "Authenticated User";
  }

  function showError(message) {
    if (!errorBanner) {
      console.error(message);
      return;
    }

    errorBanner.textContent = message;
    errorBanner.style.display = "block";
  }

  function clearError() {
    if (!errorBanner) {
      return;
    }

    errorBanner.textContent = "";
    errorBanner.style.display = "none";
  }

  function redirectToLogin() {
    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`,
    );

    window.location.replace(
      `/auth/login.html?returnTo=${returnTo}`,
    );
  }

  function setUserDisplay(user) {
    const displayName =
      user?.displayName ||
      user?.display_name ||
      user?.name ||
      user?.username ||
      "Authenticated User";

    const role = formatRole(user?.role);

    for (const element of userNameElements) {
      element.textContent = displayName;
    }

    for (const element of userRoleElements) {
      element.textContent = role;
    }
  }

  function setLoadingDisplay() {
    for (const element of userNameElements) {
      element.textContent = "Loading user...";
    }

    for (const element of userRoleElements) {
      element.textContent = "Checking session";
    }
  }

  async function loadCurrentUser() {
    setLoadingDisplay();
    clearError();

    try {
      const response = await fetch("/api/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => null);

      if (
        response.status === 401 ||
        result?.authenticated === false ||
        result?.ok === false
      ) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
          `Unable to verify the session. Status ${response.status}.`,
        );
      }

      const user =
        result?.user ||
        result?.account ||
        result;

      if (!user) {
        throw new Error(
          "The session response did not include user information.",
        );
      }

      setUserDisplay(user);
    } catch (error) {
      console.error("Current user load failed:", error);

      for (const element of userNameElements) {
        element.textContent = "Session Error";
      }

      for (const element of userRoleElements) {
        element.textContent = "Unable to load user";
      }

      showError(
        error?.message ||
        "Unable to load the current user.",
      );
    }
  }

  async function logout(button) {
    clearError();

    if (button) {
      button.disabled = true;
      button.textContent = "Logging out...";
    }

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok && response.status !== 401) {
        throw new Error(
          result?.error ||
          `Logout failed with status ${response.status}.`,
        );
      }

      window.location.replace("/auth/login.html");
    } catch (error) {
      console.error("Logout failed:", error);

      showError(
        error?.message ||
        "Unable to log out. Please try again.",
      );

      if (button) {
        button.disabled = false;
        button.textContent = "Log Out";
      }
    }
  }

  function toggleMenu() {
    document.body.classList.toggle("menu-open");
  }

  function closeMenu() {
    document.body.classList.remove("menu-open");
  }

  for (const button of logoutButtons) {
    button.addEventListener("click", () => logout(button));
  }

  for (const button of menuButtons) {
    button.addEventListener("click", toggleMenu);
  }

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("menu-open")) {
      return;
    }

    const clickedInsideSidebar = sidebar?.contains(event.target);
    const clickedMenuButton = [...menuButtons].some((button) =>
      button.contains(event.target),
    );

    if (!clickedInsideSidebar && !clickedMenuButton) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) {
      closeMenu();
    }
  });

  loadCurrentUser();
})();
