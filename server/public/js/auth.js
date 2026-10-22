// SASTS Authentication Utilities

const API_BASE = '/api';

// Check authentication and get user
function getUser() {
  const userStr = localStorage.getItem('sasts_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem('sasts_token');
}

function isAuthenticated() {
  return !!getToken();
}

function logout() {
  localStorage.removeItem('sasts_token');
  localStorage.removeItem('sasts_user');
  window.location.href = 'index.html';
}

// Authenticated fetch helper
async function authFetch(endpoint, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  // Handle token expiration
  if (response.status === 401) {
    const data = await response.json();
    if (data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
      logout();
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
}

// Require authentication (redirect if not logged in)
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Get user role
function getUserRole() {
  const user = getUser();
  return user?.role || null;
}

// Check if user has specific role
function hasRole(roles) {
  const userRole = getUserRole();
  if (!userRole) return false;
  return Array.isArray(roles) ? roles.includes(userRole) : roles === userRole;
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Format date time
function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Show alert message
function showAlert(message, type = 'info', container = 'alert-container') {
  const alertContainer = document.getElementById(container);
  if (alertContainer) {
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => alertContainer.innerHTML = '', 5000);
  }
}

// Map activity type to display text
function formatActivityType(type) {
  const types = {
    'notes': 'Extra Notes',
    'lecture': 'Extra Lecture',
    'interactive': 'Interactive Activity',
    'nptel_course': 'NPTEL Course',
    'assignment': 'Advanced Assignment',
    'tutorial': 'Additional Tutorial',
    'extra_course': 'Extra Course'
  };
  return types[type] || type;
}

// Build sidebar based on role
function buildSidebar() {
  const user = getUser();
  if (!user) return '';

  const commonLinks = `
    <a href="dashboard.html" class="nav-link ${location.pathname.includes('dashboard') ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      Dashboard
    </a>
    <a href="students-weak.html" class="nav-link ${location.pathname.includes('weak') ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Weak Students
    </a>
    <a href="students-strong.html" class="nav-link ${location.pathname.includes('strong') ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Strong Students
    </a>
    <a href="activities.html" class="nav-link ${location.pathname.includes('activities') && !location.pathname.includes('faculty') ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      Activities
    </a>
    <a href="reports.html" class="nav-link ${location.pathname.includes('reports') ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Reports
    </a>
  `;

  const facultyToolsLinks = `
    <div class="nav-section">
      <div class="nav-section-title">Faculty Tools</div>
      <a href="faculty-syllabus.html" class="nav-link ${location.pathname.includes('faculty-syllabus') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        Syllabus
      </a>
      <a href="faculty-activities.html" class="nav-link ${location.pathname.includes('faculty-activities') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        AI Generator
      </a>
      <a href="faculty-marks.html" class="nav-link ${location.pathname.includes('faculty-marks') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        </svg>
        Marks Upload
      </a>
      <a href="analytics.html" class="nav-link ${location.pathname.includes('analytics') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        Analytics
      </a>
    </div>
  `;

  const adminLinks = `
    <div class="nav-section">
      <div class="nav-section-title">Administration</div>
      <a href="admin-users.html" class="nav-link ${location.pathname.includes('admin-users') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Manage Faculty
      </a>
    </div>
  `;

  const superadminLinks = `
    <div class="nav-section">
      <div class="nav-section-title">Super Admin</div>
      <a href="admin-users.html" class="nav-link ${location.pathname.includes('admin-users') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        Manage Users
      </a>
      <a href="admin-departments.html" class="nav-link ${location.pathname.includes('departments') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Departments
      </a>
      <a href="admin-reports.html" class="nav-link ${location.pathname.includes('admin-reports') ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Reports & Exports
      </a>
    </div>
  `;

  return `
    <div class="sidebar">
      <div class="sidebar-brand">
        <span style="font-size: 1.5rem;">📚</span>
        <h1>SASTS</h1>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Main Menu</div>
          ${commonLinks}
        </div>
        
        ${facultyToolsLinks}
        
        ${user.role === 'admin' ? adminLinks : ''}
        ${user.role === 'superadmin' ? superadminLinks : ''}
      </nav>
      
      <div style="margin-top: auto; padding-top: var(--space-lg); border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); color: rgba(255,255,255,0.7);">
          <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600;">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name}</div>
            <div style="font-size: 0.75rem; text-transform: capitalize;">${user.role}</div>
          </div>
          <button onclick="logout()" class="btn-icon" style="color: rgba(255,255,255,0.7);" title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}
