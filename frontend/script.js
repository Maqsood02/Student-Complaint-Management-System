/**
 * SCMS - Frontend logic for Full-stack Integration
 */

const API_BASE = '/api';
// Global Helper for Lightbox
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
    }
}

// Client-side image compression helper
function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// Helper to convert image or file to Base64 (compressing if it is an image)
async function processFile(file) {
    if (file.type.startsWith('image/')) {
        return await compressImage(file, 1000, 1000, 0.7);
    } else {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }
}

// Notification System
async function fetchNotifications() {
    if (!currentUser || currentUser.role === 'admin') return;
    try {
        const res = await fetch(`${API_BASE}/notifications/${currentUser.id}`);
        const notes = await res.json();
        const badge = document.getElementById('notification-badge');
        const unreadCount = notes.filter(n => !n.is_read).length;
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { console.error("Notification Error:", e); }
}

setInterval(fetchNotifications, 10000); // Check every 10 seconds

let currentUser = JSON.parse(localStorage.getItem('scms_user'));

// DOM Elements
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const otpForm = document.getElementById('otp-form');
const complaintForm = document.getElementById('complaint-form');
const toast = document.getElementById('toast');
const modal = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalActions = document.getElementById('modal-actions');
const closeModalBtn = document.getElementById('close-modal');

// Navigation
const navLinks = document.querySelectorAll('.nav-link[data-target]');
const pageSections = document.querySelectorAll('.page-section');
const mobileToggle = document.getElementById('mobile-toggle');
const sidebar = document.querySelector('.sidebar');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('scms_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    } else {
        const pendingEmail = sessionStorage.getItem('scms_pending_email');
        if (pendingEmail) {
            registrationEmail = pendingEmail;
            document.getElementById('otp-display-email').textContent = pendingEmail;
            switchAuthForm('otp');
            startOTPTimer(30);
        }
    }
    setupEventListeners();
    populateClassrooms();
});

function populateClassrooms() {
    const select = document.getElementById('comp-classroom');
    if (!select) return;
    for (let i = 1; i <= 30; i++) {
        const num = i.toString().padStart(3, '0');
        const option = document.createElement('option');
        option.value = `C - ${num}`;
        option.textContent = `C - ${num}`;
        select.appendChild(option);
    }
}

function setupEventListeners() {
    // Auth Switches
    document.getElementById('show-register')?.addEventListener('click', () => switchAuthForm('register'));
    document.getElementById('show-login')?.addEventListener('click', () => switchAuthForm('login'));
    document.getElementById('show-forgot')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthForm('forgot'); });
    document.getElementById('back-to-login')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthForm('login'); });
    document.getElementById('back-to-register')?.addEventListener('click', () => {
        sessionStorage.removeItem('scms_pending_email');
        switchAuthForm('register');
    });

    // Modal
    closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('resend-otp')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleRegister(new Event('submit'));
    });

    // Forms
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    otpForm.addEventListener('submit', handleOTPVerify);
    document.getElementById('forgot-form').addEventListener('submit', handleForgotSubmit);
    document.getElementById('reset-password-form').addEventListener('submit', handleResetPassword);
    complaintForm.addEventListener('submit', handleComplaintSubmit);

    // Sidebar Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            switchSection(target);
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            if (window.innerWidth <= 1024) sidebar.classList.remove('active');
        });
    });

    mobileToggle?.addEventListener('click', () => sidebar.classList.toggle('active'));

    document.getElementById('logout-btn').addEventListener('click', logout);

    // Password Toggle
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = document.getElementById(this.dataset.target);
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });

    // Category Change Listener for Classrooms
    document.getElementById('comp-category')?.addEventListener('change', function() {
        const classroomGroup = document.getElementById('classroom-group');
        if (this.value === 'Classroom Maintenance') {
            classroomGroup.classList.remove('hidden');
        } else {
            classroomGroup.classList.add('hidden');
        }
    });

    // Global Search and Filter Event Listeners
    document.getElementById('global-search')?.addEventListener('input', applyFiltersAndRender);
    document.getElementById('adm-filter-status')?.addEventListener('change', applyFiltersAndRender);


    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('scms_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('scms_theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }

    // Profile Dropdown Functionality
    const profileWidget = document.getElementById('user-profile-widget');
    const profileDropdown = document.getElementById('profile-dropdown');

    profileWidget?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileWidget.classList.toggle('active');
        profileDropdown?.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile-wrapper')) {
            profileWidget?.classList.remove('active');
            profileDropdown?.classList.remove('show');
        }
    });

    document.getElementById('dropdown-action-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        profileWidget?.classList.remove('active');
        profileDropdown?.classList.remove('show');
        if (currentUser) {
            if (currentUser.role === 'admin') {
                document.getElementById('nav-adm-dashboard')?.click();
            } else {
                document.getElementById('nav-stu-dashboard')?.click();
            }
        }
    });

    document.getElementById('dropdown-theme-toggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        profileWidget?.classList.remove('active');
        profileDropdown?.classList.remove('show');
        document.getElementById('theme-toggle')?.click();
    });

    document.getElementById('dropdown-logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// --- AUTH FUNCTIONS ---

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const loadingToast = showToast('Authenticating...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('scms_user', JSON.stringify(currentUser));
            showDashboard();
            showToast('Welcome back!', 'success');
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Server connection failed', 'danger');
    }
}

let registrationEmail = '';
let otpTimerInterval;

function startOTPTimer(seconds, displayId = 'otp-timer') {
    const timerDisplay = document.getElementById(displayId);
    const resendBtn = document.getElementById('resend-otp');
    
    if (otpTimerInterval) clearInterval(otpTimerInterval);
    
    if (resendBtn) {
        resendBtn.style.pointerEvents = 'none';
        resendBtn.style.opacity = '0.5';
    }
    
    let timeLeft = seconds;
    
    otpTimerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(otpTimerInterval);
            if (resendBtn) {
                resendBtn.style.pointerEvents = 'auto';
                resendBtn.style.opacity = '1';
            }
            timerDisplay.textContent = "00:00";
        }
        timeLeft--;
    }, 1000);
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        return showToast('Passwords do not match!', 'danger');
    }

    registrationEmail = email;
    sessionStorage.setItem('scms_pending_email', email);

    const loadingToast = showToast('Sending verification code...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);

        if (data.success) {
            document.getElementById('otp-display-email').textContent = email;
            switchAuthForm('otp');
            startOTPTimer(60, 'otp-timer'); // 1 minute timer
            showToast('OTP sent to your email', 'success');
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Server connection failed', 'danger');
    }
}

async function handleOTPVerify(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-input').value;

    if (!otp) return showToast('Please enter the OTP', 'warning');

    try {
        const res = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: registrationEmail, otp })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Account verified! You can now login.', 'success');
            sessionStorage.removeItem('scms_pending_email'); // Clear on success
            switchAuthForm('login');
            registerForm.reset();
            otpForm.reset();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Verification failed', 'danger');
    }
}

let resetEmail = '';

async function handleForgotSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    resetEmail = email;

    const loadingToast = showToast('Sending reset code...', 'info', 0); // Permanent until manual removal
    try {
        const res = await fetch(`${API_BASE}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        // Remove loading toast
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);

        if (data.success) {
            showToast('Reset code sent to your email', 'success');
            switchAuthForm('reset');
            startOTPTimer(600, 'reset-timer'); // 10 minutes
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Server connection failed', 'danger');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const code = document.getElementById('reset-code').value;
    const newPassword = document.getElementById('new-password').value;

    try {
        const res = await fetch(`${API_BASE}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Password updated! Please login.', 'success');
            switchAuthForm('login');
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Reset failed', 'danger');
    }
}

function logout() {
    localStorage.removeItem('scms_user');
    currentUser = null;
    appView.classList.remove('active');
    authView.classList.add('active');
    
    // Reset any UI states
    sidebar.classList.remove('active');
    document.getElementById('user-profile-widget')?.classList.remove('active');
    document.getElementById('profile-dropdown')?.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    switchAuthForm('login');
}

// --- UI HELPERS ---

function switchAuthForm(form) {
    // Hide all forms first
    [loginForm, registerForm, otpForm, 
     document.getElementById('forgot-form'), 
     document.getElementById('reset-password-form')].forEach(f => {
        if (f) f.classList.remove('active-form');
    });

    // Show the targeted form
    if (form === 'login') loginForm.classList.add('active-form');
    else if (form === 'register') registerForm.classList.add('active-form');
    else if (form === 'otp') otpForm.classList.add('active-form');
    else if (form === 'forgot') document.getElementById('forgot-form').classList.add('active-form');
    else if (form === 'reset') document.getElementById('reset-password-form').classList.add('active-form');
}

function showDashboard() {
    authView.classList.remove('active');
    appView.classList.add('active');
    document.getElementById('display-user-name').textContent = currentUser.name;
    document.getElementById('dropdown-user-name').textContent = currentUser.name;
    document.getElementById('dropdown-user-email').textContent = currentUser.email || 'No email provided';
    const roleEl = document.querySelector('.user-role');
    if (roleEl) {
        roleEl.textContent = currentUser.role === 'admin' ? 'System Administrator' : 'Student Scholar';
    }
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=8b5cf6&color=fff&rounded=true&bold=true`;

    if (currentUser.role === 'admin') {
        document.getElementById('student-nav').classList.add('hidden');
        document.getElementById('admin-nav').classList.remove('hidden');
        navLinks.forEach(l => l.classList.remove('active'));
        document.getElementById('nav-adm-dashboard')?.classList.add('active');
        switchSection('admin-dashboard');
    } else {
        document.getElementById('admin-nav').classList.add('hidden');
        document.getElementById('student-nav').classList.remove('hidden');
        navLinks.forEach(l => l.classList.remove('active'));
        document.getElementById('nav-stu-dashboard')?.classList.add('active');
        switchSection('student-dashboard');
    }
    refreshData();
}

function switchSection(id) {
    pageSections.forEach(s => s.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    
    if (id === 'manage-users') {
        fetchAdminUsers();
    }
}

function showToast(msg, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-circle-check',
        danger: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icons[type] || icons.success}"></i></div>
        <span class="toast-message">${msg}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }
    return toast; // Allow manual removal
}

// --- MODAL & DETAILS ---

let allComplaints = []; // Store complaints locally for quick lookup

async function refreshData() {
    try {
        const res = await fetch(`${API_BASE}/complaints/${currentUser.role}/${currentUser.id}`);
        allComplaints = await res.json();
        
        applyFiltersAndRender();
    } catch (err) {
        console.error('Data Fetch Error:', err);
    }
}

function applyFiltersAndRender() {
    const rawSearch = document.getElementById('global-search') ? document.getElementById('global-search').value.toLowerCase().trim() : '';
    // Strip leading '#' if present to match internal IDs like 'CMP-58595E'
    const searchVal = rawSearch.startsWith('#') ? rawSearch.substring(1) : rawSearch;

    const filterEl = document.getElementById('adm-filter-status');
    const statusVal = filterEl ? filterEl.value : 'All';

    const filtered = allComplaints.filter(c => {
        // Search filter
        const matchId = (c.id || '').toLowerCase().includes(searchVal);
        const matchTitle = (c.title || '').toLowerCase().includes(searchVal);
        const matchDesc = (c.description || '').toLowerCase().includes(searchVal);
        const matchCategory = (c.category || '').toLowerCase().includes(searchVal);
        const matchPriority = (c.priority || '').toLowerCase().includes(searchVal);
        const matchStatus = (c.status || '').toLowerCase().includes(searchVal);
        const matchStudentName = (c.student_name || '').toLowerCase().includes(searchVal);
        const matchStudentEmail = (c.student_email || '').toLowerCase().includes(searchVal);
        
        const matchesSearch = !searchVal || matchId || matchTitle || matchDesc || matchCategory || matchPriority || matchStatus || matchStudentName || matchStudentEmail;

        // Status filter (admin only)
        const matchesStatus = statusVal === 'All' || c.status === statusVal;

        return matchesSearch && matchesStatus;
    });

    if (currentUser && currentUser.role === 'admin') {
        renderAdminView(filtered);
    } else {
        renderStudentView(filtered);
    }
}

// Description and Location parser helper
function parseDescription(desc) {
    if (!desc) return { location: null, description: '' };
    // match [[ LOCATION: ECE - C - 010 ]] or [[ LOCATION: CSE - C - 009 ]]
    const locMatch = desc.match(/\[\[\s*LOCATION:\s*([^\s\]]+(?:\s+-\s+[^\s\]]+)*)\s*\]\]/i) || desc.match(/\[\[\s*LOCATION:\s*(.*?)\s*\]\]/i);
    let location = null;
    let cleanText = desc;
    if (locMatch) {
        location = locMatch[1].trim();
        cleanText = desc.replace(locMatch[0], '').trim();
    }
    return { location, description: cleanText };
}

window.viewComplaint = (id) => {
    const c = allComplaints.find(item => item.id === id);
    if (!c) return;

    const { location, description } = parseDescription(c.description);

    document.getElementById('modal-title').innerHTML = `
        <span style="color: var(--primary); font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-invoice"></i> Complaint Details
        </span>
    `;

    modalContent.innerHTML = `
        <div class="modal-premium-header">
            <div class="modal-header-bg-glow"><i class="fa-solid fa-file-signature"></i></div>
            <div class="modal-header-meta">
                <span class="status-badge status-${c.status.toLowerCase().replace(/\s+/g, '-')}">${c.status}</span>
                <span class="priority-badge ${c.priority.toLowerCase()}"><i class="fa-solid fa-circle"></i> ${c.priority} Priority</span>
                <span class="date-badge"><i class="fa-regular fa-calendar"></i> ${new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <h2 class="modal-complaint-title">${c.title}</h2>
            
            <div class="modal-header-tags">
                <span class="category-tag"><i class="fa-solid fa-layer-group"></i> ${c.category}</span>
                ${location ? `
                    <span class="location-tag"><i class="fa-solid fa-location-dot"></i> ${location}</span>
                ` : ''}
                <span class="id-tag"><i class="fa-solid fa-hashtag"></i> ${c.id}</span>
            </div>
        </div>

        <div class="detail-group">
            <label class="modal-section-label">
                <i class="fa-solid fa-align-left"></i> Detailed Narrative
            </label>
            <div class="description-box-modern">
                <div class="quote-mark-icon"><i class="fa-solid fa-quote-right"></i></div>
                ${description}
            </div>
        </div>

        ${c.attached_file ? (() => {
            const evidenceSrc = c.attached_file.startsWith('data:') ? c.attached_file : `/uploads/${c.attached_file}`;
            return `
            <div class="detail-group">
                <label class="modal-section-label">
                    <i class="fa-solid fa-paperclip"></i> Attached Evidence
                </label>
                <div class="evidence-gallery-card">
                    <div class="evidence-thumbnail-wrapper" onclick="openLightbox('${evidenceSrc}')">
                        <img src="${evidenceSrc}" alt="Evidence" class="evidence-thumbnail-img">
                        <div class="evidence-overlay-hover">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                            <span>View Full Screen</span>
                        </div>
                    </div>
                </div>
            </div>`;
        })() : ''}

        ${c.admin_reply ? `
            <div class="modal-resolution-card">
                <div class="resolution-card-decor"><i class="fa-solid fa-circle-check"></i></div>
                <label class="resolution-label">
                    <i class="fa-solid fa-shield-check"></i> Official Resolution
                </label>
                <div class="resolution-text">"${c.admin_reply}"</div>
            </div>
        ` : ''}
    `;

    modalActions.innerHTML = `
        <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">
            Close Window
        </button>
    `;
    modal.classList.add('active');
};

window.manageComplaint = (id) => {
    const c = allComplaints.find(item => item.id === id);
    if (!c) return;

    const { location, description } = parseDescription(c.description);

    document.getElementById('modal-title').innerHTML = `
        <span style="color: var(--primary); font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sliders"></i> Manage Complaint
        </span>
    `;

    modalContent.innerHTML = `
        <!-- Student Info Header Card -->
        <div class="modal-student-profile-card">
            <div class="profile-card-decor"><i class="fa-solid fa-file-signature"></i></div>
            <div class="profile-card-content">
                <div class="student-avatar-gradient">
                    <span>${c.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                    <div class="avatar-ring"></div>
                </div>
                <div class="student-profile-details">
                    <div class="student-name-row">
                        <h4>${c.student_name}</h4>
                        <span class="id-tag-small">#${c.id}</span>
                    </div>
                    <div class="student-meta-grid">
                        <span class="student-meta-item"><i class="fa-regular fa-envelope"></i> ${c.student_email}</span>
                        <span class="student-meta-item"><i class="fa-regular fa-calendar-plus"></i> Filed on ${new Date(c.created_at).toLocaleDateString()}</span>
                        <span class="student-meta-item"><i class="fa-solid fa-layer-group"></i> ${c.category}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-group">
            <label class="modal-section-label">
                <i class="fa-solid fa-align-left"></i> Student's Description
            </label>
            <div class="description-box-modern">
                <div class="quote-mark-icon"><i class="fa-solid fa-quote-right"></i></div>
                ${description}
            </div>
            
            ${location ? `
                <div class="location-banner-modern mt-1">
                    <i class="fa-solid fa-location-dot"></i>
                    <span><strong>Reported Location:</strong> ${location}</span>
                </div>
            ` : ''}
        </div>
        
        ${c.attached_file ? (() => {
            const evidenceSrc = c.attached_file.startsWith('data:') ? c.attached_file : `/uploads/${c.attached_file}`;
            return `
            <div class="detail-group">
                <label class="modal-section-label">
                    <i class="fa-solid fa-paperclip"></i> Provided Evidence
                </label>
                <div class="evidence-gallery-card">
                    <div class="evidence-thumbnail-wrapper" onclick="openLightbox('${evidenceSrc}')">
                        <img src="${evidenceSrc}" alt="Evidence" class="evidence-thumbnail-img">
                        <div class="evidence-overlay-hover">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                            <span>View Full Screen</span>
                        </div>
                    </div>
                </div>
            </div>`;
        })() : ''}
        
        <!-- Management Actions Form -->
        <div class="modal-management-actions-form">
            <h3 class="form-section-title"><i class="fa-solid fa-square-poll-horizontal"></i> Resolution & Status Update</h3>
            
            <div class="actions-grid-modern">
                <div class="form-group-modern">
                    <label for="update-status"><i class="fa-solid fa-signal"></i> Update Status</label>
                    <div class="select-wrapper-modern">
                        <select id="update-status">
                            <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending Approval</option>
                            <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Mark Resolved</option>
                        </select>
                        <i class="fa-solid fa-chevron-down select-chevron"></i>
                    </div>
                </div>
                
                <div class="form-group-modern">
                    <label for="update-priority"><i class="fa-solid fa-flag"></i> Set Priority</label>
                    <div class="select-wrapper-modern">
                        <select id="update-priority">
                            <option value="Low" ${c.priority === 'Low' ? 'selected' : ''}>Low Priority</option>
                            <option value="Medium" ${c.priority === 'Medium' ? 'selected' : ''}>Medium Priority</option>
                            <option value="High" ${c.priority === 'High' ? 'selected' : ''}>High Priority</option>
                        </select>
                        <i class="fa-solid fa-chevron-down select-chevron"></i>
                    </div>
                </div>
            </div>
            
            <div class="form-group-modern mt-1">
                <label for="update-reply"><i class="fa-solid fa-reply-all"></i> Official Admin Resolution Message</label>
                <div class="textarea-wrapper-modern">
                    <textarea id="update-reply" placeholder="Type a comprehensive, helpful response detailing the actions taken to resolve this concern. The student will receive a notification and email instantly..." rows="4">${c.admin_reply || ''}</textarea>
                </div>
            </div>
        </div>
    `;

    modalActions.innerHTML = `
        <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">Discard</button>
        <button class="btn btn-primary btn-save-resolution" onclick="submitAdminUpdate('${id}')"><i class="fa-solid fa-check-circle"></i> Save & Notify Student</button>
    `;
    modal.classList.add('active');
};

async function submitAdminUpdate(id) {
    const status = document.getElementById('update-status').value;
    const priority = document.getElementById('update-priority').value;
    const reply = document.getElementById('update-reply').value;

    try {
        const res = await fetch(`${API_BASE}/complaints/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, priority, reply })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Complaint updated successfully');
            modal.classList.remove('active');
            refreshData();
        }
    } catch (err) {
        showToast('Update failed', 'danger');
    }
}

// Updated rendering logic to avoid duplicate rows for recent items
function renderStudentView(complaints) {
    const statsSource = allComplaints.length > 0 ? allComplaints : complaints;
    const total = statsSource.length;
    const pending = statsSource.filter(c => c.status === 'Pending').length;
    const resolved = statsSource.filter(c => c.status === 'Resolved').length;

    document.getElementById('stu-total-count').textContent = total;
    document.getElementById('stu-pending-count').textContent = pending;
    document.getElementById('stu-resolved-count').textContent = resolved;

    const recentBody = document.getElementById('stu-recent-table-body');
    const trackBody = document.getElementById('stu-track-table-body');
    recentBody.innerHTML = '';
    trackBody.innerHTML = '';

    complaints.forEach((c, index) => {
        const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
        const row = `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td><span style="font-weight: 700;">${c.title}</span></td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap"><i class="fa-regular fa-calendar" style="margin-right: 8px; opacity: 0.4;"> </i>${new Date(c.created_at).toLocaleDateString()}</td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
            </tr>
        `;
        if (index < 5) recentBody.innerHTML += row;
        
        // Add to track table (all items should be listed on the Track History tab)
        trackBody.innerHTML += `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td><span style="font-weight: 700;">${c.title}</span></td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap"><i class="fa-regular fa-calendar" style="margin-right: 8px; opacity: 0.4;"> </i>${new Date(c.created_at).toLocaleDateString()}</td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
                <td class="nowrap"><button class="btn btn-primary" onclick="viewComplaint('${c.id}')" style="padding: 0.45rem 1rem; font-size: 0.8rem;">View <i class="fa-solid fa-angle-right"></i></button></td>
            </tr>
        `;
    });
}

function renderAdminView(complaints) {
    const statsSource = allComplaints.length > 0 ? allComplaints : complaints;
    const total = statsSource.length;
    const pending = statsSource.filter(c => c.status === 'Pending').length;
    const resolved = statsSource.filter(c => c.status === 'Resolved').length;
    const progress = statsSource.filter(c => c.status === 'In Progress').length;

    document.getElementById('adm-total-count').textContent = total;
    document.getElementById('adm-pending-count').textContent = pending;
    document.getElementById('adm-resolved-count').textContent = resolved;
    document.getElementById('adm-progress-count').textContent = progress;

    const recentBody = document.getElementById('adm-recent-table-body');
    const manageBody = document.getElementById('adm-manage-table-body');
    recentBody.innerHTML = '';
    manageBody.innerHTML = '';

    // High‑Priority Recent Action Items (first 5)
    const highPriorityFirst = [...complaints].sort((a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
    highPriorityFirst.slice(0, 5).forEach(c => {
        const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
        const priorityClass = c.priority.toLowerCase();
        recentBody.innerHTML += `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td class="nowrap">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.student_name)}&background=random&color=fff&bold=true&size=36" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <span style="font-weight: 700;">${c.student_name}</span>
                    </div>
                </td>
                <td><span style="font-weight: 700;">${c.title}</span></td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap"><span class="priority-badge ${priorityClass}"><i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${c.priority}</span></td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
            </tr>
        `;
    });

    // Management Table – exclude the items already shown in recent (first 5)
    highPriorityFirst.slice(5).forEach(c => {
        const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
        const priorityClass = c.priority.toLowerCase();
        manageBody.innerHTML += `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td class="nowrap">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.student_name)}&background=random&color=fff&bold=true&size=36" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <span style="font-weight: 700;">${c.student_name}</span>
                    </div>
                </td>
                <td><span style="font-weight: 700;">${c.title}</span></td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap"><span class="priority-badge ${priorityClass}"><i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${c.priority}</span></td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
                <td class="nowrap"><button class="btn btn-primary" onclick="manageComplaint('${c.id}')" style="padding: 0.45rem 1.25rem; font-size: 0.8rem;">Review <i class="fa-solid fa-sliders"></i></button></td>
            </tr>
        `;
    });
}

function renderAdminView(complaints) {
    const statsSource = allComplaints.length > 0 ? allComplaints : complaints;
    const total = statsSource.length;
    const pending = statsSource.filter(c => c.status === 'Pending').length;
    const resolved = statsSource.filter(c => c.status === 'Resolved').length;
    const progress = statsSource.filter(c => c.status === 'In Progress').length;

    document.getElementById('adm-total-count').textContent = total;
    document.getElementById('adm-pending-count').textContent = pending;
    document.getElementById('adm-resolved-count').textContent = resolved;
    document.getElementById('adm-progress-count').textContent = progress;

    const manageBody = document.getElementById('adm-manage-table-body');
    manageBody.innerHTML = '';

    // Populate recent action items table on Admin Overview (High-Priority complaints first, up to 5)
    const recentBody = document.getElementById('adm-recent-table-body');
    if (recentBody) {
        recentBody.innerHTML = '';
        const highPriorityFirst = [...complaints].sort((a, b) => {
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        });
        highPriorityFirst.slice(0, 5).forEach(c => {
            const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
            const priorityClass = c.priority.toLowerCase();
            recentBody.innerHTML += `
                <tr class="animate-up">
                    <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                    <td class="nowrap">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.student_name)}&background=random&color=fff&bold=true&size=36" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                            <span style="font-weight: 700;">${c.student_name}</span>
                        </div>
                    </td>
                    <td><span style="font-weight: 700;">${c.title}</span></td>
                    <td><span style="opacity: 0.8;">${c.category}</span></td>
                    <td class="nowrap">
                        <span class="priority-badge ${priorityClass}">
                            <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${c.priority}
                        </span>
                    </td>
                    <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
                </tr>
            `;
        });
    }

    complaints.forEach(c => {
        const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
        const priorityClass = c.priority.toLowerCase();
        manageBody.innerHTML += `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td class="nowrap">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.student_name)}&background=random&color=fff&bold=true&size=36" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <span style="font-weight: 700;">${c.student_name}</span>
                    </div>
                </td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap">
                    <span class="priority-badge ${priorityClass}">
                        <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${c.priority}
                    </span>
                </td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
                <td class="nowrap"><button class="btn btn-primary" onclick="manageComplaint('${c.id}')" style="padding: 0.45rem 1.25rem; font-size: 0.8rem;">Review <i class="fa-solid fa-sliders"></i></button></td>
            </tr>
        `;
    });
}

// --- COMPLAINT SUBMISSION ---

async function handleComplaintSubmit(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('comp-title').value);
    formData.append('description', document.getElementById('comp-description').value);
    formData.append('category', document.getElementById('comp-category').value);
    formData.append('priority', document.getElementById('comp-priority-user').value);
    formData.append('student_id', currentUser.id);
    formData.append('student_name', currentUser.name);
    formData.append('student_email', currentUser.email);

    const classroom = document.getElementById('comp-classroom').value;
    const dept = document.getElementById('comp-dept').value;
    if (document.getElementById('comp-category').value === 'Classroom Maintenance') {
        if (classroom) formData.append('classroom', classroom);
        if (dept) formData.append('dept', dept);
    }

    const fileInput = document.getElementById('comp-file');
    if (!fileInput.files[0]) {
        showToast('Supportive evidence is mandatory to upload.', 'danger');
        return;
    }

    try {
        showToast('Processing attachment...', 'info');
        const fileBase64 = await processFile(fileInput.files[0]);
        formData.append('file_base64', fileBase64);
    } catch (err) {
        showToast('Failed to process/compress attachment.', 'danger');
        return;
    }

    try {
        showToast('Submitting complaint...', 'success');
        const res = await fetch(`${API_BASE}/complaints`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Submitted! ID: ${data.complaint_id}`, 'success');
            complaintForm.reset();
            switchSection('track-complaints');
            refreshData();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Submission failed', 'danger');
    }
}


// Notifications logic
if (document.getElementById('notification-bell')) {
    document.getElementById('notification-bell').addEventListener('click', async () => {
        if (!currentUser) return;
        document.getElementById('notification-badge').style.display = 'none';
        await fetch(`${API_BASE}/notifications/read/${currentUser.id}`, { method: 'POST' });
    });
}

// --- ADMIN USER MANAGEMENT FUNCTIONALITY ---
let allUsers = [];

async function fetchAdminUsers() {
    try {
        const res = await fetch(`${API_BASE}/admin/users`);
        if (!res.ok) throw new Error('Failed to fetch users');
        allUsers = await res.json();
        renderAdminUsers(allUsers);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

function renderAdminUsers(usersList) {
    const tbody = document.getElementById('adm-users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (usersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No users found.</td></tr>`;
        return;
    }
    
    usersList.forEach(u => {
        const tr = document.createElement('tr');
        const roleClass = u.role === 'admin' ? 'role-badge admin' : 'role-badge student';
        const roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
        
        const isPrimaryAdmin = u.email === 'admin@scms.edu';
        const deleteButton = isPrimaryAdmin 
            ? `<button class="btn btn-outline" disabled title="Primary admin account cannot be deleted" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; cursor: not-allowed; opacity: 0.5;"><i class="fa-regular fa-trash-can"></i> Delete</button>`
            : `<button class="btn btn-danger ui-action" onclick="deleteUserAccount(${u.id}, '${u.name}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;"><i class="fa-regular fa-trash-can"></i> Delete</button>`;
        
        tr.innerHTML = `
            <td>
                <div style="font-weight: 700; color: var(--text-main);">${u.name}</div>
            </td>
            <td><code style="font-family: inherit; font-size: 0.9rem; color: var(--text-muted);">${u.email}</code></td>
            <td><span class="${roleClass}">${roleLabel}</span></td>
            <td>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${deleteButton}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteUserAccount(userId, userName) {
    if (!confirm(`Are you sure you want to permanently delete the user account for ${userName}?`)) {
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete user account');
        
        showToast(`User account for ${userName} deleted successfully.`, 'success');
        fetchAdminUsers();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// Expose globally for inline onclick
window.deleteUserAccount = deleteUserAccount;

// Bind Admin forms and search listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adm-search-users')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderAdminUsers(allUsers);
            return;
        }
        const filtered = allUsers.filter(u => 
            u.name.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query) || 
            u.role.toLowerCase().includes(query)
        );
        renderAdminUsers(filtered);
    });

    document.getElementById('admin-create-user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('adm-user-name').value.trim();
        const email = document.getElementById('adm-user-email').value.trim();
        const password = document.getElementById('adm-user-password').value.trim();
        const role = document.getElementById('adm-user-role').value;
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Registering...`;
        
        try {
            const res = await fetch(`${API_BASE}/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to register user');
            
            showToast(`Account for ${name} registered successfully as ${role}!`, 'success');
            e.target.reset();
            
            setTimeout(() => {
                const navUsersTab = document.getElementById('nav-adm-users');
                if (navUsersTab) navUsersTab.click();
            }, 1200);
            
        } catch (err) {
            showToast(err.message, 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    });
});

