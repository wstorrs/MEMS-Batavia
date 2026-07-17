const usersTableBody = document.getElementById("usersTableBody");
const usersEmptyState = document.getElementById("usersEmptyState");
const usersLoadingState = document.getElementById("usersLoadingState");
const usersErrorState = document.getElementById("usersErrorState");
const userCount = document.getElementById("userCount");
const activeCount = document.getElementById("activeCount");
const adminCount = document.getElementById("adminCount");
const refreshUsersButton = document.getElementById("refreshUsersButton");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRole(role) {
  const normalized = String(role || "").toLowerCase();

  if (normalized === "admin") return "Administrator";
  if (normalized === "operations") return "Operations";
  if (normalized === "read-only") return "Read Only";

  return role || "Unknown";
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";

  if (!users.length) {
    usersEmptyState.hidden = false;
    return;
  }

  usersEmptyState.hidden = true;

  for (const user of users) {
    const row = document.createElement("tr");

    const statusClass = user.enabled
      ? "user-status user-status-active"
      : "user-status user-status-disabled";

    const statusText = user.enabled ? "Active" : "Disabled";

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(user.displayName || "Unnamed User")}</strong>
      </td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(formatRole(user.role))}</td>
      <td>
        <span class="${statusClass}">${statusText}</span>
      </td>
    `;

    usersTableBody.appendChild(row);
  }
}

function updateSummary(users) {
  userCount.textContent = String(users.length);
  activeCount.textContent = String(users.filter(user => user.enabled).length);
  adminCount.textContent = String(
    users.filter(user => user.role === "admin").length
  );
}

async function loadUsers() {
  usersLoadingState.hidden = false;
  usersErrorState.hidden = true;
  usersEmptyState.hidden = true;
  refreshUsersButton.disabled = true;
  refreshUsersButton.textContent = "Refreshing...";

  try {
    const response = await fetch("/api/admin/users", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    const result = await response.json().catch(() => null);

    if (response.status === 401) {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.replace(`/auth/login.html?returnTo=${returnTo}`);
      return;
    }

    if (response.status === 403) {
      throw new Error("Your account does not have administrator access.");
    }

    if (!response.ok || !result?.ok || !Array.isArray(result.users)) {
      throw new Error(result?.error || `Request failed with status ${response.status}.`);
    }

    renderUsers(result.users);
    updateSummary(result.users);
  } catch (error) {
    usersTableBody.innerHTML = "";
    usersErrorState.textContent = error.message || "Unable to load users.";
    usersErrorState.hidden = false;
    updateSummary([]);
  } finally {
    usersLoadingState.hidden = true;
    refreshUsersButton.disabled = false;
    refreshUsersButton.textContent = "Refresh";
  }
}

refreshUsersButton.addEventListener("click", loadUsers);
loadUsers();
