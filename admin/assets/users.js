const usersTableBody = document.getElementById("usersTableBody");
const usersEmptyState = document.getElementById("usersEmptyState");
const usersLoadingState = document.getElementById("usersLoadingState");
const usersErrorState = document.getElementById("usersErrorState");

const userCount = document.getElementById("userCount");
const activeCount = document.getElementById("activeCount");
const adminCount = document.getElementById("adminCount");

const refreshUsersButton = document.getElementById(
  "refreshUsersButton"
);

/*
 * Create user elements
 */
const openCreateUserButton = document.getElementById(
  "openCreateUserButton"
);

const createUserDialog = document.getElementById(
  "createUserDialog"
);

const createUserForm = document.getElementById(
  "createUserForm"
);

const cancelCreateUserButton = document.getElementById(
  "cancelCreateUserButton"
);

const createUserSubmitButton = document.getElementById(
  "createUserSubmitButton"
);

const createUserError = document.getElementById(
  "createUserError"
);

const createUserSuccess = document.getElementById(
  "createUserSuccess"
);

/*
 * Edit user elements
 */
const editUserDialog = document.getElementById(
  "editUserDialog"
);

const editUserForm = document.getElementById(
  "editUserForm"
);

const editUserSubmitButton = document.getElementById(
  "editUserSubmitButton"
);

const cancelEditUserButton = document.getElementById(
  "cancelEditUserButton"
);

const editUserError = document.getElementById(
  "editUserError"
);

const editUserSuccess = document.getElementById(
  "editUserSuccess"
);

/*
 * Reset password elements
 */
const resetPasswordDialog = document.getElementById(
  "resetPasswordDialog"
);

const resetPasswordForm = document.getElementById(
  "resetPasswordForm"
);

const resetPasswordSubmitButton = document.getElementById(
  "resetPasswordSubmitButton"
);

const cancelResetPasswordButton = document.getElementById(
  "cancelResetPasswordButton"
);

const resetPasswordError = document.getElementById(
  "resetPasswordError"
);

const resetPasswordSuccess = document.getElementById(
  "resetPasswordSuccess"
);

let loadedUsers = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  if (normalized === "admin") {
    return "Administrator";
  }

  if (normalized === "operations") {
    return "Operations";
  }

  if (
    normalized === "read-only" ||
    normalized === "readonly" ||
    normalized === "viewer"
  ) {
    return "Read Only";
  }

  return role || "Unknown";
}

function normalizeRoleForForm(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "read-only" ||
    normalized === "readonly" ||
    normalized === "viewer"
  ) {
    return "viewer";
  }

  if (normalized === "admin") {
    return "admin";
  }

  return "operations";
}

function formatDate(value, emptyText = "Never") {
  if (!value) {
    return emptyText;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function redirectToLogin() {
  const returnTo = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );

  window.location.replace(
    `/auth/login.html?returnTo=${returnTo}`
  );
}

async function readApiResponse(response) {
  const result = await response.json().catch(() => null);

  if (response.status === 401) {
    redirectToLogin();
    return null;
  }

  if (response.status === 403) {
    throw new Error(
      "Your account does not have administrator access."
    );
  }

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.error ||
      `Request failed with status ${response.status}.`
    );
  }

  return result;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  return readApiResponse(response);
}

function getUserById(userId) {
  return loadedUsers.find(
    (user) => Number(user.id) === Number(userId)
  );
}

function updateSummary(users) {
  userCount.textContent = String(users.length);

  activeCount.textContent = String(
    users.filter((user) => user.enabled).length
  );

  adminCount.textContent = String(
    users.filter(
      (user) =>
        String(user.role || "").toLowerCase() === "admin"
    ).length
  );
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

    const statusText = user.enabled
      ? "Active"
      : "Disabled";

    const toggleButtonText = user.enabled
      ? "Disable"
      : "Enable";

    const toggleButtonClass = user.enabled
      ? "table-action-button danger"
      : "table-action-button";

    row.innerHTML = `
      <td>
        <strong>
          ${escapeHtml(user.displayName || "Unnamed User")}
        </strong>
      </td>

      <td>${escapeHtml(user.username)}</td>

      <td>${escapeHtml(formatRole(user.role))}</td>

      <td>
        <span class="${statusClass}">
          ${statusText}
        </span>
      </td>

      <td>
        ${escapeHtml(formatDate(user.lastLogin, "Never"))}
      </td>

      <td>
        ${escapeHtml(formatDate(user.createdAt, "Unknown"))}
      </td>

      <td>
        <div class="user-actions">
          <button
            class="table-action-button"
            type="button"
            data-action="edit"
            data-user-id="${Number(user.id)}"
          >
            Edit
          </button>

          <button
            class="${toggleButtonClass}"
            type="button"
            data-action="toggle-status"
            data-user-id="${Number(user.id)}"
          >
            ${toggleButtonText}
          </button>

          <button
            class="table-action-button warning"
            type="button"
            data-action="reset-password"
            data-user-id="${Number(user.id)}"
          >
            Reset Password
          </button>

          <button
            class="table-action-button danger"
            type="button"
            data-action="force-logout"
            data-user-id="${Number(user.id)}"
          >
            Force Logout
          </button>
        </div>
      </td>
    `;

    usersTableBody.appendChild(row);
  }
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
        Accept: "application/json"
      }
    });

    const result = await readApiResponse(response);

    if (!result) {
      return;
    }

    if (!Array.isArray(result.users)) {
      throw new Error(
        "The server returned an invalid user list."
      );
    }

    loadedUsers = result.users;

    renderUsers(loadedUsers);
    updateSummary(loadedUsers);
  } catch (error) {
    loadedUsers = [];
    usersTableBody.innerHTML = "";

    usersErrorState.textContent =
      error?.message || "Unable to load users.";

    usersErrorState.hidden = false;

    updateSummary([]);
  } finally {
    usersLoadingState.hidden = true;
    refreshUsersButton.disabled = false;
    refreshUsersButton.textContent = "Refresh";
  }
}

/*
 * Create user
 */
function openCreateUserDialog() {
  createUserForm?.reset();

  const enabledCheckbox = document.getElementById(
    "newUserEnabled"
  );

  if (enabledCheckbox) {
    enabledCheckbox.checked = true;
  }

  createUserError.hidden = true;
  createUserSuccess.hidden = true;

  createUserDialog.showModal();

  document.getElementById(
    "newUserDisplayName"
  )?.focus();
}

async function createUser(event) {
  event.preventDefault();

  createUserError.hidden = true;
  createUserSuccess.hidden = true;

  createUserSubmitButton.disabled = true;
  createUserSubmitButton.textContent = "Creating...";

  const payload = {
    displayName:
      document.getElementById("newUserDisplayName")?.value ||
      "",

    username:
      document.getElementById("newUserUsername")?.value ||
      "",

    password:
      document.getElementById("newUserPassword")?.value ||
      "",

    role:
      document.getElementById("newUserRole")?.value ||
      "viewer",

    enabled:
      document.getElementById("newUserEnabled")?.checked ??
      true
  };

  try {
    const result = await postJson(
      "/api/admin/users/create",
      payload
    );

    if (!result) {
      return;
    }

    createUserSuccess.textContent =
      `${result.user.displayName} was created successfully.`;

    createUserSuccess.hidden = false;

    createUserForm.reset();

    const enabledCheckbox = document.getElementById(
      "newUserEnabled"
    );

    if (enabledCheckbox) {
      enabledCheckbox.checked = true;
    }

    await loadUsers();

    window.setTimeout(() => {
      if (createUserDialog.open) {
        createUserDialog.close();
      }
    }, 900);
  } catch (error) {
    createUserError.textContent =
      error?.message ||
      "The user account could not be created.";

    createUserError.hidden = false;
  } finally {
    createUserSubmitButton.disabled = false;
    createUserSubmitButton.textContent = "Create User";
  }
}

/*
 * Edit user
 */
function openEditUserDialog(userId) {
  const user = getUserById(userId);

  if (!user) {
    window.alert("The selected user could not be found.");
    return;
  }

  document.getElementById("editUserId").value =
    String(user.id);

  document.getElementById("editUserDisplayName").value =
    user.displayName || "";

  document.getElementById("editUserUsername").value =
    user.username || "";

  document.getElementById("editUserRole").value =
    normalizeRoleForForm(user.role);

  editUserError.hidden = true;
  editUserSuccess.hidden = true;

  editUserDialog.showModal();

  document.getElementById(
    "editUserDisplayName"
  )?.focus();
}

async function updateUser(event) {
  event.preventDefault();

  editUserError.hidden = true;
  editUserSuccess.hidden = true;

  editUserSubmitButton.disabled = true;
  editUserSubmitButton.textContent = "Saving...";

  const payload = {
    userId: Number(
      document.getElementById("editUserId")?.value
    ),

    displayName:
      document.getElementById("editUserDisplayName")?.value ||
      "",

    username:
      document.getElementById("editUserUsername")?.value ||
      "",

    role:
      document.getElementById("editUserRole")?.value ||
      "viewer"
  };

  try {
    const result = await postJson(
      "/api/admin/users/update",
      payload
    );

    if (!result) {
      return;
    }

    editUserSuccess.textContent =
      result.message ||
      "User account updated successfully.";

    editUserSuccess.hidden = false;

    await loadUsers();

    window.setTimeout(() => {
      if (editUserDialog.open) {
        editUserDialog.close();
      }
    }, 900);
  } catch (error) {
    editUserError.textContent =
      error?.message ||
      "The user account could not be updated.";

    editUserError.hidden = false;
  } finally {
    editUserSubmitButton.disabled = false;
    editUserSubmitButton.textContent = "Save Changes";
  }
}

/*
 * Enable or disable user
 */
async function toggleUserStatus(userId) {
  const user = getUserById(userId);

  if (!user) {
    window.alert("The selected user could not be found.");
    return;
  }

  const enableAccount = !user.enabled;

  const confirmationText = enableAccount
    ? `Enable the account for ${user.displayName}?`
    : `Disable the account for ${user.displayName}? This will immediately end their active sessions.`;

  if (!window.confirm(confirmationText)) {
    return;
  }

  try {
    const result = await postJson(
      "/api/admin/users/toggle-status",
      {
        userId: Number(user.id),
        enabled: enableAccount
      }
    );

    if (!result) {
      return;
    }

    window.alert(result.message);
    await loadUsers();
  } catch (error) {
    window.alert(
      error?.message ||
      "The account status could not be changed."
    );
  }
}

/*
 * Reset password
 */
function openResetPasswordDialog(userId) {
  const user = getUserById(userId);

  if (!user) {
    window.alert("The selected user could not be found.");
    return;
  }

  resetPasswordForm.reset();

  document.getElementById(
    "resetPasswordUserId"
  ).value = String(user.id);

  document.getElementById(
    "resetPasswordDescription"
  ).textContent =
    `Set a new temporary password for ${user.displayName}.`;

  resetPasswordError.hidden = true;
  resetPasswordSuccess.hidden = true;

  resetPasswordDialog.showModal();

  document.getElementById(
    "resetPasswordValue"
  )?.focus();
}

async function resetUserPassword(event) {
  event.preventDefault();

  resetPasswordError.hidden = true;
  resetPasswordSuccess.hidden = true;

  const newPassword =
    document.getElementById("resetPasswordValue")?.value ||
    "";

  const confirmPassword =
    document.getElementById("resetPasswordConfirm")?.value ||
    "";

  if (newPassword !== confirmPassword) {
    resetPasswordError.textContent =
      "The passwords do not match.";

    resetPasswordError.hidden = false;
    return;
  }

  resetPasswordSubmitButton.disabled = true;
  resetPasswordSubmitButton.textContent = "Resetting...";

  try {
    const result = await postJson(
      "/api/admin/users/reset-password",
      {
        userId: Number(
          document.getElementById(
            "resetPasswordUserId"
          )?.value
        ),
        newPassword
      }
    );

    if (!result) {
      return;
    }

    resetPasswordSuccess.textContent =
      result.message ||
      "Password reset successfully.";

    resetPasswordSuccess.hidden = false;

    resetPasswordForm.reset();

    window.setTimeout(() => {
      if (resetPasswordDialog.open) {
        resetPasswordDialog.close();
      }
    }, 1200);
  } catch (error) {
    resetPasswordError.textContent =
      error?.message ||
      "The password could not be reset.";

    resetPasswordError.hidden = false;
  } finally {
    resetPasswordSubmitButton.disabled = false;
    resetPasswordSubmitButton.textContent =
      "Reset Password";
  }
}

/*
 * Force logout
 */
async function forceLogoutUser(userId) {
  const user = getUserById(userId);

  if (!user) {
    window.alert("The selected user could not be found.");
    return;
  }

  const confirmed = window.confirm(
    `End every active session for ${user.displayName}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await postJson(
      "/api/admin/users/force-logout",
      {
        userId: Number(user.id)
      }
    );

    if (!result) {
      return;
    }

    window.alert(result.message);
    await loadUsers();
  } catch (error) {
    window.alert(
      error?.message ||
      "The user's sessions could not be ended."
    );
  }
}

/*
 * Table actions
 */
usersTableBody?.addEventListener("click", (event) => {
  const button = event.target.closest(
    "button[data-action][data-user-id]"
  );

  if (!button) {
    return;
  }

  const userId = Number(button.dataset.userId);
  const action = button.dataset.action;

  if (!Number.isInteger(userId) || userId <= 0) {
    window.alert("A valid user account was not selected.");
    return;
  }

  if (action === "edit") {
    openEditUserDialog(userId);
    return;
  }

  if (action === "toggle-status") {
    toggleUserStatus(userId);
    return;
  }

  if (action === "reset-password") {
    openResetPasswordDialog(userId);
    return;
  }

  if (action === "force-logout") {
    forceLogoutUser(userId);
  }
});

/*
 * General event listeners
 */
refreshUsersButton?.addEventListener(
  "click",
  loadUsers
);

openCreateUserButton?.addEventListener(
  "click",
  openCreateUserDialog
);

cancelCreateUserButton?.addEventListener(
  "click",
  () => {
    createUserDialog?.close();
  }
);

createUserForm?.addEventListener(
  "submit",
  createUser
);

cancelEditUserButton?.addEventListener(
  "click",
  () => {
    editUserDialog?.close();
  }
);

editUserForm?.addEventListener(
  "submit",
  updateUser
);

cancelResetPasswordButton?.addEventListener(
  "click",
  () => {
    resetPasswordDialog?.close();
  }
);

resetPasswordForm?.addEventListener(
  "submit",
  resetUserPassword
);

for (const dialog of [
  createUserDialog,
  editUserDialog,
  resetPasswordDialog
]) {
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

loadUsers();
