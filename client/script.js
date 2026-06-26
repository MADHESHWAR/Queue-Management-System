// Q-Flow Queue Management System JS Control

const API_BASE = '/api';
let pollingInterval = null;
let currentFilter = 'all';

// DOM Elements
const views = document.querySelectorAll('.view-section');
const navLinks = document.querySelectorAll('.nav-link');
const mobileMenu = document.getElementById('mobile-menu');
const nav = document.querySelector('nav');
const logoBtn = document.getElementById('logo-btn');
const toast = document.getElementById('toast');

// Form Containers & Inputs
const tokenForm = document.getElementById('token-form');
const customerNameInput = document.getElementById('customerName');
const tokenRegistrationContainer = document.getElementById('token-registration-container');
const activeTicketContainer = document.getElementById('active-ticket-container');

// Admin Elements
const adminLoginContainer = document.getElementById('admin-login-container');
const adminDashboardContainer = document.getElementById('admin-dashboard-container');
const adminLoginForm = document.getElementById('admin-login-form');
const adminUsernameInput = document.getElementById('adminUsername');
const adminPasswordInput = document.getElementById('adminPassword');
const btnCallNext = document.getElementById('btn-call-next');
const btnResetQueue = document.getElementById('btn-reset-queue');
const btnAdminLogout = document.getElementById('btn-admin-logout');
const adminTokensTableBody = document.getElementById('admin-tokens-table-body');

// Navigation Toggle
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetView = link.getAttribute('data-target');
    switchView(targetView);
  });
});

logoBtn.addEventListener('click', () => switchView('home-view'));

if (mobileMenu) {
  mobileMenu.addEventListener('click', () => {
    nav.classList.toggle('open');
  });
}

function switchView(viewId) {
  // Hide all sections, show target
  views.forEach(section => {
    section.classList.remove('active-view');
  });
  const activeSection = document.getElementById(viewId);
  if (activeSection) {
    activeSection.classList.add('active-view');
  }

  // Update nav active link state
  navLinks.forEach(link => {
    if (link.getAttribute('data-target') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Close mobile nav
  if (nav.classList.contains('open')) {
    nav.classList.remove('open');
  }

  // Handle active views specific setup & start polling
  stopPolling();
  
  if (viewId === 'customer-view') {
    setupCustomerPortal();
    startPolling(5000, setupCustomerPortal);
  } else if (viewId === 'dashboard-view') {
    loadDashboard();
    startPolling(5000, loadDashboard);
  } else if (viewId === 'admin-view') {
    setupAdminPortal();
    startPolling(5000, () => {
      if (isAdminLoggedIn()) loadAdminDashboard();
    });
  }
}

// Polling Helper Functions
function startPolling(ms, callback) {
  stopPolling();
  pollingInterval = setInterval(callback, ms);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Toast Notifier Helper
function showToast(message, type = 'info') {
  toast.innerText = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ================= CUSTOMER PORTAL FLOW =================

tokenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const customerName = customerNameInput.value.trim();
  
  if (!customerName) return;

  try {
    const res = await fetch(`${API_BASE}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName })
    });
    const result = await res.json();
    
    if (result.success) {
      // Save current active token locally
      localStorage.setItem('qms_my_token', JSON.stringify(result.data));
      showToast('Token generated successfully!', 'success');
      customerNameInput.value = '';
      setupCustomerPortal();
    } else {
      showToast(result.message || 'Error generating token', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to connect to the server', 'error');
  }
});

async function setupCustomerPortal() {
  const savedToken = localStorage.getItem('qms_my_token');

  if (!savedToken) {
    tokenRegistrationContainer.classList.remove('hidden');
    activeTicketContainer.classList.add('hidden');
    return;
  }

  const tokenData = JSON.parse(savedToken);
  
  try {
    // Fetch live status of the local user's token
    const res = await fetch(`${API_BASE}/tokens/${tokenData.id}`);
    const result = await res.json();

    if (result.success) {
      const { token, queuePosition, estimatedWaitTime, currentServingTokenNumber } = result.data;
      
      tokenRegistrationContainer.classList.add('hidden');
      activeTicketContainer.classList.remove('hidden');

      // Update values in domestic view
      document.getElementById('my-token-number').innerText = String(token.tokenNumber).padStart(3, '0');
      document.getElementById('my-ticket-name').innerText = token.customerName;
      document.getElementById('my-ticket-status').innerText = token.status;
      
      // Format Badge status color
      const statusBadge = document.getElementById('my-ticket-status');
      statusBadge.className = `ticket-badge badge-${token.status.toLowerCase()}`;
      
      // Format creation time
      const createdDate = new Date(token.createdAt);
      document.getElementById('my-ticket-time').innerText = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Update Queue stats depending on status
      if (token.status === 'Waiting') {
        document.getElementById('my-queue-position').innerText = queuePosition;
        document.getElementById('my-wait-time').innerText = `${estimatedWaitTime} mins`;
      } else if (token.status === 'Serving') {
        document.getElementById('my-queue-position').innerText = '0';
        document.getElementById('my-wait-time').innerText = 'Now Serving!';
        document.getElementById('my-wait-time').style.color = 'var(--serving-color)';
      } else {
        document.getElementById('my-queue-position').innerText = '-';
        document.getElementById('my-wait-time').innerText = 'Finished';
        document.getElementById('my-wait-time').style.color = 'var(--text-muted)';
      }

      document.getElementById('my-current-serving').innerText = currentServingTokenNumber 
        ? String(currentServingTokenNumber).padStart(3, '0') 
        : 'None';
      
    } else {
      // Local token does not exist on server anymore (likely reset by admin)
      localStorage.removeItem('qms_my_token');
      tokenRegistrationContainer.classList.remove('hidden');
      activeTicketContainer.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error fetching customer token state:', error);
  }
}

// User leaves the queue (clears active token)
document.getElementById('btn-leave-queue').addEventListener('click', () => {
  if (confirm('Are you sure you want to exit the queue? This will release your token.')) {
    // We clear locally. The server admin will skip/complete it when reached.
    localStorage.removeItem('qms_my_token');
    showToast('You left the queue.', 'info');
    setupCustomerPortal();
  }
});


// ================= PUBLIC DISPLAY FLOW =================

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/tokens/stats`);
    const result = await res.json();
    
    if (result.success) {
      const { servingToken, totalWaiting, estimatedWaitTime, upcomingTokens } = result.data;
      
      // 1. Serving now update
      if (servingToken) {
        document.getElementById('pub-serving-number').innerText = String(servingToken.tokenNumber).padStart(3, '0');
        document.getElementById('pub-serving-name').innerText = servingToken.customerName;
      } else {
        document.getElementById('pub-serving-number').innerText = '--';
        document.getElementById('pub-serving-name').innerText = 'No customer is being served';
      }

      // 2. Waiting counts and estimate
      document.getElementById('pub-waiting-count').innerText = totalWaiting;
      document.getElementById('pub-wait-time').innerText = `${estimatedWaitTime} mins`;

      // 3. Upcoming List render
      const listContainer = document.getElementById('pub-upcoming-list');
      listContainer.innerHTML = '';
      
      if (upcomingTokens.length > 0) {
        upcomingTokens.forEach(token => {
          const card = document.createElement('div');
          card.className = 'upcoming-item';
          card.innerHTML = `
            <div class="upcoming-num-badge">${String(token.tokenNumber).padStart(3, '0')}</div>
            <div class="upcoming-info">
              <span class="upcoming-name">${token.customerName}</span>
              <span class="upcoming-label">Upcoming</span>
            </div>
          `;
          listContainer.appendChild(card);
        });
      } else {
        listContainer.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-face-smile"></i>
            <p>The queue is empty. No upcoming tokens.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error fetching public stats:', error);
  }
}


// ================= ADMIN CONSOLE FLOW =================

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value.trim();

  if (!username || !password) return;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await res.json();
    
    if (result.success) {
      localStorage.setItem('qms_admin_token', result.token);
      showToast('Welcome Back, Administrator!', 'success');
      adminUsernameInput.value = '';
      adminPasswordInput.value = '';
      setupAdminPortal();
    } else {
      showToast(result.message || 'Login failed', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to reach backend auth api', 'error');
  }
});

function isAdminLoggedIn() {
  return localStorage.getItem('qms_admin_token') !== null;
}

function setupAdminPortal() {
  if (isAdminLoggedIn()) {
    adminLoginContainer.classList.add('hidden');
    adminDashboardContainer.classList.remove('hidden');
    // Hide the admin login link visually from header bar, or mark it special
    document.getElementById('admin-nav-link').classList.add('active');
    loadAdminDashboard();
  } else {
    adminLoginContainer.classList.remove('hidden');
    adminDashboardContainer.classList.add('hidden');
  }
}

// Fetch and Render Admin dashboard details
async function loadAdminDashboard() {
  const token = localStorage.getItem('qms_admin_token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/tokens`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      // Token expired or invalid
      adminLogout();
      return;
    }
    
    const result = await res.json();
    if (result.success) {
      const tokens = result.data;
      
      // Calculate Stats
      const waitingTokens = tokens.filter(t => t.status === 'Waiting');
      const servingTokens = tokens.filter(t => t.status === 'Serving');
      
      const currentServing = servingTokens.length > 0 ? servingTokens[0] : null;
      
      document.getElementById('admin-serving-number').innerText = currentServing 
        ? String(currentServing.tokenNumber).padStart(3, '0') 
        : '--';
      document.getElementById('admin-serving-name').innerText = currentServing 
        ? currentServing.customerName 
        : 'No customer active';
      
      document.getElementById('admin-waiting-count').innerText = waitingTokens.length;
      document.getElementById('admin-total-count').innerText = tokens.length;
      
      // Render Table Content
      renderAdminTokensTable(tokens);
    }
  } catch (error) {
    console.error('Error fetching admin list:', error);
  }
}

// Filter Badge Listeners
document.querySelectorAll('.filter-badge').forEach(badge => {
  badge.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.getAttribute('data-filter');
    loadAdminDashboard();
  });
});

function renderAdminTokensTable(tokens) {
  adminTokensTableBody.innerHTML = '';
  
  // Filter list
  let filtered = tokens;
  if (currentFilter !== 'all') {
    filtered = tokens.filter(t => t.status === currentFilter);
  }
  
  // Show table in reverse order so latest tokens are at top (standard admin dashboard)
  // or sort by tokenNumber ascending. Let's do token number ascending so it displays in order.
  filtered.sort((a, b) => b.tokenNumber - a.tokenNumber);

  if (filtered.length === 0) {
    adminTokensTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <i class="fa-solid fa-filter"></i>
          <p>No tokens match the filter "${currentFilter}".</p>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(token => {
    const tr = document.createElement('tr');
    
    const tokenNum = String(token.tokenNumber).padStart(3, '0');
    const createdTime = new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Status Badge Markup
    const badgeClass = `badge badge-${token.status.toLowerCase()}`;
    const statusBadge = `<span class="${badgeClass}">${token.status}</span>`;

    // Action button markup based on status
    let actionButtons = '';
    if (token.status === 'Waiting') {
      actionButtons = `
        <button class="btn btn-accent btn-table" onclick="adminUpdateStatus('${token._id}', 'Serving')">Serve</button>
        <button class="btn btn-secondary btn-table" onclick="adminUpdateStatus('${token._id}', 'Skipped')">Skip</button>
      `;
    } else if (token.status === 'Serving') {
      actionButtons = `
        <button class="btn btn-primary btn-table" onclick="adminUpdateStatus('${token._id}', 'Completed')">Complete</button>
        <button class="btn btn-secondary btn-table" onclick="adminUpdateStatus('${token._id}', 'Skipped')">Skip</button>
      `;
    } else {
      // Completed or Skipped
      actionButtons = `<span style="font-size: 0.8rem; color: var(--text-muted);">No action available</span>`;
    }

    tr.innerHTML = `
      <td><strong>#${tokenNum}</strong></td>
      <td>${token.customerName}</td>
      <td>${statusBadge}</td>
      <td>${createdTime}</td>
      <td>
        <div class="action-btn-group">
          ${actionButtons}
        </div>
      </td>
    `;
    
    adminTokensTableBody.appendChild(tr);
  });
}

// Control Console Actions
btnCallNext.addEventListener('click', async () => {
  const token = localStorage.getItem('qms_admin_token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/tokens/admin/call-next`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await res.json();
    if (result.success) {
      if (result.data) {
        showToast(`Calling Token #${result.data.tokenNumber} (${result.data.customerName})`, 'success');
      } else {
        showToast('Waiting queue is empty!', 'info');
      }
      loadAdminDashboard();
    } else {
      showToast(result.message || 'Error calling next customer', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to call next customer', 'error');
  }
});

async function adminUpdateStatus(tokenId, status) {
  const token = localStorage.getItem('qms_admin_token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/tokens/admin/${tokenId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    
    const result = await res.json();
    if (result.success) {
      showToast(`Status updated to ${status}`, 'success');
      loadAdminDashboard();
    } else {
      showToast(result.message || 'Error updating status', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to update status', 'error');
  }
}

// Expose adminUpdateStatus globally for inline buttons
window.adminUpdateStatus = adminUpdateStatus;

btnResetQueue.addEventListener('click', async () => {
  if (!confirm('CRITICAL WARNING: Are you sure you want to reset the queue? This will DELETE all customer records from the database.')) {
    return;
  }

  const token = localStorage.getItem('qms_admin_token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/tokens/admin/reset`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await res.json();
    if (result.success) {
      showToast('Queue has been fully reset.', 'success');
      loadAdminDashboard();
    } else {
      showToast(result.message || 'Error resetting queue', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to reset queue', 'error');
  }
});

btnAdminLogout.addEventListener('click', adminLogout);

function adminLogout() {
  localStorage.removeItem('qms_admin_token');
  showToast('Logged out successfully.', 'info');
  setupAdminPortal();
}

// Initial View Activation on Load
window.addEventListener('DOMContentLoaded', () => {
  // Clear any leftover interval
  stopPolling();
  // Activate default View: Home
  switchView('home-view');
});
