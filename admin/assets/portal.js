:root {
  --mf-navy: #0f2347;
  --mf-navy-dark: #08152d;
  --mf-navy-light: #183663;
  --mf-orange: #ff671f;
  --mf-orange-dark: #d94e00;
  --white: #ffffff;
  --text: #eaf0f8;
  --muted: #aebed3;
  --panel: rgba(255, 255, 255, 0.075);
  --panel-strong: rgba(255, 255, 255, 0.11);
  --border: rgba(255, 255, 255, 0.14);
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --sidebar-width: 270px;
  --shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
  background: var(--mf-navy-dark);
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Arial, Helvetica, sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top right, rgba(255, 103, 31, 0.12), transparent 34%),
    linear-gradient(145deg, var(--mf-navy-dark), var(--mf-navy));
}

button,
input,
select,
textarea {
  font: inherit;
}

a {
  color: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  background: rgba(6, 16, 35, 0.93);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 6px 22px;
  border-bottom: 1px solid var(--border);
}

.brand-mark {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 12px;
  background: var(--mf-orange);
  color: var(--white);
  font-weight: 800;
  letter-spacing: -0.04em;
}

.brand-title {
  margin: 0;
  color: var(--mf-orange);
  font-size: 1.04rem;
}

.brand-subtitle {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.79rem;
}

.nav {
  display: grid;
  gap: 7px;
  margin-top: 22px;
}

.nav-label {
  margin: 10px 10px 4px;
  color: #7185a2;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #d8e2ef;
  text-decoration: none;
  transition: 0.16s ease;
}

.nav-link:hover {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.07);
}

.nav-link.active {
  border-color: rgba(255, 103, 31, 0.45);
  background: rgba(255, 103, 31, 0.16);
  color: var(--white);
}

.nav-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--mf-orange);
  font-size: 0.78rem;
  font-weight: 800;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.sidebar-user {
  padding: 0 8px 14px;
}

.sidebar-user strong,
.sidebar-user span {
  display: block;
}

.sidebar-user strong {
  font-size: 0.92rem;
}

.sidebar-user span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: capitalize;
}

.logout-button {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(255, 103, 31, 0.55);
  border-radius: 9px;
  background: transparent;
  color: var(--white);
  cursor: pointer;
}

.logout-button:hover {
  background: var(--mf-orange);
}

.main {
  min-width: 0;
  padding: 28px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: clamp(1.65rem, 3vw, 2.3rem);
}

.page-subtitle {
  margin: 7px 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.session-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  border: 1px solid rgba(34, 197, 94, 0.32);
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: #dcfce7;
  font-size: 0.84rem;
  white-space: nowrap;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.hero-panel {
  margin-bottom: 22px;
  padding: 24px;
  border: 1px solid var(--border);
  border-left: 6px solid var(--mf-orange);
  border-radius: 15px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.hero-panel h2 {
  margin: 0 0 8px;
  color: var(--mf-orange);
}

.hero-panel p {
  max-width: 850px;
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.stats-grid,
.module-grid {
  display: grid;
  gap: 18px;
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 18px;
}

.stat-card,
.module-card,
.content-panel {
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.stat-card {
  padding: 18px;
}

.stat-label {
  color: var(--muted);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-value {
  margin-top: 9px;
  font-size: 1.45rem;
  font-weight: 800;
}

.stat-note {
  margin-top: 7px;
  color: var(--muted);
  font-size: 0.8rem;
}

.module-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.module-card {
  position: relative;
  min-height: 200px;
  padding: 22px;
  text-decoration: none;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.module-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 103, 31, 0.62);
  background: var(--panel-strong);
}

.module-card h3 {
  margin: 17px 0 8px;
  color: var(--mf-orange);
}

.module-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.module-icon {
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: rgba(255, 103, 31, 0.17);
  color: var(--mf-orange);
  font-weight: 800;
}

.module-arrow {
  position: absolute;
  right: 20px;
  bottom: 18px;
  color: var(--mf-orange);
  font-size: 1.25rem;
}

.module-card.disabled {
  opacity: 0.62;
  cursor: default;
}

.module-card.disabled:hover {
  transform: none;
  border-color: var(--border);
  background: var(--panel);
}

.module-badge {
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 103, 31, 0.16);
  color: #ffd8c5;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.content-panel {
  padding: 22px;
}

.content-panel h2 {
  margin: 0 0 8px;
  color: var(--mf-orange);
}

.content-panel p {
  color: var(--muted);
  line-height: 1.55;
}

.placeholder-box {
  margin-top: 18px;
  padding: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
}

.error-banner {
  display: none;
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 10px;
  background: rgba(127, 29, 29, 0.34);
  color: #fee2e2;
}

.mobile-menu-button {
  display: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--white);
  cursor: pointer;
}

@media (max-width: 920px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    z-index: 50;
    width: min(84vw, var(--sidebar-width));
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow);
  }

  body.menu-open .sidebar {
    transform: translateX(0);
  }

  .mobile-menu-button {
    display: inline-grid;
    place-items: center;
  }

  .main {
    padding: 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .main {
    padding: 14px;
  }

  .topbar {
    align-items: flex-start;
  }

  .session-badge {
    display: none;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }
}
