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

// Global Helper for broken evidence images
window.handleImageError = function(img) {
    img.onerror = null;
    const wrapper = img.closest('.evidence-thumbnail-wrapper');
    if (wrapper) {
        wrapper.outerHTML = `<div style="background: rgba(239, 68, 68, 0.05); border: 1px dashed var(--danger); border-radius: var(--radius-sm); padding: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; color: var(--danger); width: 100%; min-width: 200px; box-sizing: border-box;">
            <i class="fa-solid fa-image-slash" style="font-size: 1.8rem; opacity: 0.8; margin-bottom: 4px;"></i>
            <span style="font-size: 0.82rem; font-weight: 700; text-align: center;">Evidence image not found</span>
        </div>`;
    }
};

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
    document.getElementById('change-password-form')?.addEventListener('submit', handleChangePasswordSubmit);

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

    mobileToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });

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

    // Developer Modal Event Listeners
    const devModal = document.getElementById('dev-modal-overlay');
    const closeDevModalBtn = document.getElementById('close-dev-modal');
    const closeDevModalBtn2 = document.getElementById('close-dev-modal-btn');
    
    const openDevModal = () => {
        if (devModal) devModal.classList.add('active');
    };
    
    const closeDevModal = () => {
        if (devModal) devModal.classList.remove('active');
    };

    document.querySelectorAll('.dev-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDevModal();
        });
    });

    closeDevModalBtn?.addEventListener('click', closeDevModal);
    closeDevModalBtn2?.addEventListener('click', closeDevModal);
    devModal?.addEventListener('click', (e) => {
        if (e.target === devModal) closeDevModal();
    });

    // Team Modal Event Listeners
    const teamModal = document.getElementById('team-modal-overlay');
    const closeTeamModalBtn = document.getElementById('close-team-modal');
    const closeTeamModalBtn2 = document.getElementById('close-team-modal-btn');
    
    const openTeamModal = () => {
        if (teamModal) teamModal.classList.add('active');
    };
    
    const closeTeamModal = () => {
        if (teamModal) teamModal.classList.remove('active');
    };

    document.querySelectorAll('.team-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openTeamModal();
        });
    });

    closeTeamModalBtn?.addEventListener('click', closeTeamModal);
    closeTeamModalBtn2?.addEventListener('click', closeTeamModal);
    teamModal?.addEventListener('click', (e) => {
        if (e.target === teamModal) closeTeamModal();
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
        if (currentUser.role === 'admin') {
            roleEl.textContent = 'System Administrator';
        } else if (currentUser.role === 'employee') {
            roleEl.textContent = `Support Specialist (EMP-${currentUser.id.toString().padStart(3, '0')})`;
        } else {
            roleEl.textContent = 'Student Scholar';
        }
    }
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=8b5cf6&color=fff&rounded=true&bold=true`;

    // Hide all nav elements first
    document.getElementById('student-nav').classList.add('hidden');
    document.getElementById('admin-nav').classList.add('hidden');
    document.getElementById('employee-nav').classList.add('hidden');

    if (currentUser.role === 'admin') {
        document.getElementById('admin-nav').classList.remove('hidden');
        navLinks.forEach(l => l.classList.remove('active'));
        document.getElementById('nav-adm-dashboard')?.classList.add('active');
        switchSection('admin-dashboard');
    } else if (currentUser.role === 'employee') {
        document.getElementById('employee-nav').classList.remove('hidden');
        navLinks.forEach(l => l.classList.remove('active'));
        document.getElementById('nav-emp-dashboard')?.classList.add('active');
        switchSection('employee-dashboard');
    } else {
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
    } else if (id === 'manage-employees') {
        fetchAdminEmployees();
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
    } else if (currentUser && currentUser.role === 'employee') {
        renderEmployeeView(filtered);
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

window.viewComplaint = async (id) => {
    let c = allComplaints.find(item => item.id === id);
    if (!c) return;

    const loadingToast = showToast('Loading details...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/detail/${id}`);
        const data = await res.json();
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        if (res.ok && data && !data.error) {
            c = data;
        }
    } catch (e) {
        console.error("Failed to fetch full complaint detail:", e);
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
    }

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
            const isPDF = c.attached_file.toLowerCase().endsWith('.pdf') || c.attached_file.startsWith('data:application/pdf');
            if (isPDF) {
                return `
                <div class="detail-group">
                    <label class="modal-section-label">
                        <i class="fa-solid fa-paperclip"></i> Attached Evidence (PDF Document)
                    </label>
                    <div class="evidence-pdf-card" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
                                <i class="fa-solid fa-file-pdf"></i>
                            </div>
                            <div>
                                <h4 style="margin: 0; color: var(--text-main); font-size: 1rem; font-weight: 700;">Documentary Evidence</h4>
                                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">PDF Document</p>
                            </div>
                        </div>
                        <a href="${evidenceSrc}" target="_blank" download="evidence.pdf" class="btn btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; text-decoration: none; border-radius: 10px;">
                            <i class="fa-solid fa-up-right-from-square"></i> Open PDF
                        </a>
                    </div>
                </div>`;
            }
            return `
            <div class="detail-group">
                <label class="modal-section-label">
                    <i class="fa-solid fa-paperclip"></i> Attached Evidence
                </label>
                <div class="evidence-gallery-card">
                    <div class="evidence-thumbnail-wrapper" onclick="openLightbox('${evidenceSrc}')">
                        <img src="${evidenceSrc}" alt="Evidence" class="evidence-thumbnail-img" onerror="handleImageError(this)">
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

        ${currentUser && currentUser.role === 'employee' ? `
            <div class="modal-management-actions-form mt-2" style="border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                <h3 class="form-section-title"><i class="fa-solid fa-square-poll-horizontal"></i> Update Task Status</h3>
                
                <div class="form-group-modern">
                    <label for="worker-update-status"><i class="fa-solid fa-signal"></i> Set Status</label>
                    <div class="select-wrapper-modern">
                        <select id="worker-update-status" style="width: 100%; height: 42px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.95rem; background: var(--bg-input); color: var(--text-main); padding: 0 1rem;">
                            <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Mark Resolved</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group-modern mt-1">
                    <label for="worker-update-reply"><i class="fa-solid fa-reply-all"></i> Resolution / Progress Notes</label>
                    <div class="textarea-wrapper-modern">
                        <textarea id="worker-update-reply" placeholder="Type notes explaining progress or resolution. This will notify administrators to review..." rows="3" style="width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.95rem; background: var(--bg-input); color: var(--text-main); padding: 0.75rem 1rem; box-sizing: border-box;">${c.worker_notes || ''}</textarea>
                    </div>
                </div>

                <div class="form-group-modern mt-1" id="worker-evidence-group">
                    <label class="assign-field-label" style="font-weight: 800; font-size: 0.82rem; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-camera"></i> Proof of Work Evidence <span id="evidence-required-badge" style="color: var(--danger); font-weight: 800; display: ${c.status === 'Resolved' ? 'inline-block' : 'none'};">* (Required)</span>
                    </label>
                    <input type="file" id="worker-evidence-file" accept="image/*" style="display: none;" onchange="handleWorkerEvidenceUpload(this)">
                    <div class="file-upload-zone" id="worker-evidence-dropzone" onclick="document.getElementById('worker-evidence-file').click()" style="cursor: pointer; border: 2.5px dashed var(--border); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; background: var(--bg-input); transition: all 0.2s ease; margin-top: 6px;">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.8rem; color: var(--primary); margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto;"></i>
                        <span id="worker-evidence-filename" style="margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
                            Click to upload proof of work image
                        </span>
                    </div>
                    <input type="hidden" id="worker-evidence-base64" value="">
                </div>
            </div>
        ` : ''}
    `;

    if (currentUser && currentUser.role === 'employee') {
        modalActions.innerHTML = `
            <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">Discard</button>
            <button class="btn btn-primary" onclick="submitWorkerUpdate('${c.id}')"><i class="fa-solid fa-circle-check"></i> Submit Resolution</button>
        `;
    } else {
        modalActions.innerHTML = `
            <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">
                Close Window
            </button>
        `;
    }
    modal.classList.add('active');

    // Attach dynamic validation badge listener
    if (currentUser && currentUser.role === 'employee') {
        const statusSelect = document.getElementById('worker-update-status');
        const reqBadge = document.getElementById('evidence-required-badge');
        if (statusSelect && reqBadge) {
            statusSelect.addEventListener('change', () => {
                if (statusSelect.value === 'Resolved') {
                    reqBadge.style.display = 'inline-block';
                } else {
                    reqBadge.style.display = 'none';
                }
            });
        }
    }
};

window.manageComplaint = async (id) => {
    let c = allComplaints.find(item => item.id === id);
    if (!c) return;

    const loadingToast = showToast('Loading details...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/detail/${id}`);
        const data = await res.json();
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        if (res.ok && data && !data.error) {
            c = data;
        }
    } catch (e) {
        console.error("Failed to fetch full complaint detail:", e);
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
    }

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
            const isPDF = c.attached_file.toLowerCase().endsWith('.pdf') || c.attached_file.startsWith('data:application/pdf');
            if (isPDF) {
                return `
                <div class="detail-group">
                    <label class="modal-section-label">
                        <i class="fa-solid fa-paperclip"></i> Provided Evidence (PDF Document)
                    </label>
                    <div class="evidence-pdf-card" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
                                <i class="fa-solid fa-file-pdf"></i>
                            </div>
                            <div>
                                <h4 style="margin: 0; color: var(--text-main); font-size: 1rem; font-weight: 700;">Documentary Evidence</h4>
                                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">PDF Document</p>
                            </div>
                        </div>
                        <a href="${evidenceSrc}" target="_blank" download="evidence.pdf" class="btn btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; text-decoration: none; border-radius: 10px;">
                            <i class="fa-solid fa-up-right-from-square"></i> Open PDF
                        </a>
                    </div>
                </div>`;
            }
            return `
            <div class="detail-group">
                <label class="modal-section-label">
                    <i class="fa-solid fa-paperclip"></i> Provided Evidence
                </label>
                <div class="evidence-gallery-card">
                    <div class="evidence-thumbnail-wrapper" onclick="openLightbox('${evidenceSrc}')">
                        <img src="${evidenceSrc}" alt="Evidence" class="evidence-thumbnail-img" onerror="handleImageError(this)">
                        <div class="evidence-overlay-hover">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                            <span>View Full Screen</span>
                        </div>
                    </div>
                </div>
            </div>`;
        })() : ''}
        
        ${c.worker_notes || c.worker_evidence ? `
            <div class="modal-resolution-card" style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); margin-bottom: 1.5rem; border-radius: 16px; padding: 1.25rem 1.5rem; position: relative;">
                <div class="resolution-card-decor" style="color: var(--primary);"><i class="fa-solid fa-clipboard-check"></i></div>
                <label class="resolution-label" style="color: var(--primary); font-weight: 800; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-user-check"></i> Worker Resolution Evidence
                </label>
                ${c.worker_notes ? `<div class="resolution-text" style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.75rem; font-style: italic;">"${c.worker_notes}"</div>` : ''}
                ${c.worker_evidence ? (() => {
                    const wEvidenceSrc = c.worker_evidence.startsWith('data:') ? c.worker_evidence : `/uploads/${c.worker_evidence}`;
                    return `
                    <div class="detail-group" style="margin-top: 0.75rem;">
                        <label class="modal-section-label" style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Proof of Work Uploaded by ${c.assigned_to_name || 'Worker'}:</label>
                        <div class="evidence-gallery-card" style="margin-top: 4px;">
                            <div class="evidence-thumbnail-wrapper" onclick="openLightbox('${wEvidenceSrc}')" style="max-width: 250px; border-radius: var(--radius-sm); overflow: hidden; border: 1.5px solid var(--border); cursor: zoom-in; position: relative;">
                                <img src="${wEvidenceSrc}" alt="Worker Proof of Work" class="evidence-thumbnail-img" style="width: 100%; height: auto; display: block;" onerror="handleImageError(this)">
                                <div class="evidence-overlay-hover">
                                    <i class="fa-solid fa-magnifying-glass-plus"></i>
                                    <span>View Proof</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
                })() : ''}
            </div>
        ` : ''}
        
        <!-- Assignment Info Card (shown when complaint has an assigned employee) -->
        ${c.assigned_to ? (() => {
            const empId = `EMP-${String(c.assigned_to).padStart(3, '0')}`;
            const deadlineDate = c.resolution_deadline ? new Date(c.resolution_deadline) : null;
            const now = new Date();
            const isOverdue = deadlineDate && deadlineDate < now;
            const remainingMs = deadlineDate ? (deadlineDate - now) : null;

            const formatDeadline = (d) => d.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });

            // Countdown timer accent color
            let timerAccent = '#10b981'; // green
            if (remainingMs !== null) {
                const hoursLeft = remainingMs / 3600000;
                if (isOverdue) timerAccent = '#ef4444';
                else if (hoursLeft < 6) timerAccent = '#ef4444';
                else if (hoursLeft < 24) timerAccent = '#f59e0b';
            }

            return `
            <div class="assignment-info-card" id="assignment-card-${c.id}" style="
                background: linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(139,92,246,0.04) 100%);
                border: 1px solid rgba(99,102,241,0.2);
                border-radius: 20px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                position: relative;
                overflow: hidden;
            ">
                <!-- Background watermark icon -->
                <div style="position:absolute;bottom:-20px;right:10px;font-size:6rem;opacity:0.04;color:var(--primary);pointer-events:none;">
                    <i class="fa-solid fa-user-tie"></i>
                </div>

                <!-- Section header -->
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;">
                    <div style="background:rgba(99,102,241,0.12);border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(99,102,241,0.2);">
                        <i class="fa-solid fa-user-check" style="color:var(--primary);font-size:0.9rem;"></i>
                    </div>
                    <div>
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--primary);line-height:1;">Task Assignment</div>
                        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Worker assigned to this complaint</div>
                    </div>
                    <span style="margin-left:auto;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);color:var(--primary);padding:4px 12px;border-radius:100px;font-size:0.7rem;font-weight:800;text-transform:uppercase;">${empId}</span>
                </div>

                <!-- Worker info row -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:${deadlineDate ? '1.25rem' : '0'};">
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1rem;">
                        <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:6px;">
                            <i class="fa-solid fa-user" style="margin-right:5px;"></i>Assigned Worker
                        </div>
                        <div style="font-size:1rem;font-weight:800;color:var(--text-main);">${c.assigned_to_name}</div>
                        <div style="font-size:0.8rem;color:var(--primary);font-weight:700;margin-top:3px;">${empId}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1rem;">
                        <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:6px;">
                            <i class="fa-solid fa-calendar-check" style="margin-right:5px;"></i>Resolution Deadline
                        </div>
                        ${deadlineDate ? `
                        <div style="font-size:0.88rem;font-weight:700;color:${isOverdue ? '#ef4444' : 'var(--text-main)'};">${formatDeadline(deadlineDate)}</div>
                        ` : `<div style="font-size:0.88rem;color:var(--text-muted);font-style:italic;">No deadline set</div>`}
                    </div>
                </div>

                ${deadlineDate ? (() => {
                    const isCompleted = ['Resolved', 'Under Review'].includes(c.status);
                    if (isCompleted) {
                        return `
                <!-- Task Completed — timer stopped -->
                <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;">
                    <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fa-solid fa-circle-check" style="color:#10b981;font-size:1rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px;">Timer Status</div>
                        <div style="font-size:1rem;font-weight:900;color:#10b981;font-family:'Outfit',monospace;">Task Completed — Timer Stopped</div>
                    </div>
                    <span style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:#10b981;padding:5px 14px;border-radius:100px;font-size:0.7rem;font-weight:900;text-transform:uppercase;flex-shrink:0;">
                        ${c.status === 'Under Review' ? 'Under Review' : 'Resolved'}
                    </span>
                </div>`;
                    }
                    return `
                <!-- Live Countdown Timer -->
                <div style="background:${isOverdue ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'};border-radius:14px;padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;">
                    <div style="background:${timerAccent}18;border:1px solid ${timerAccent}30;border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fa-solid fa-${isOverdue ? 'triangle-exclamation' : 'hourglass-half'}" style="color:${timerAccent};font-size:1rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px;">
                            ${isOverdue ? 'Deadline Status' : 'Time Remaining'}
                        </div>
                        <div id="countdown-timer-${c.id}" style="font-size:1.1rem;font-weight:900;color:${timerAccent};font-family:'Outfit',monospace;letter-spacing:0.02em;">
                            ${isOverdue ? '⚠ OVERDUE' : 'Calculating...'}
                        </div>
                    </div>
                    ${isOverdue ? `
                    <span style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;padding:5px 14px;border-radius:100px;font-size:0.7rem;font-weight:900;text-transform:uppercase;flex-shrink:0;">
                        Admin Alerted
                    </span>
                    ` : ''}
                </div>`;
                })() : ''}
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
                            <option value="Under Review" ${c.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
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
        <button class="btn btn-danger" style="margin-right: auto;" onclick="deleteComplaint('${id}')"><i class="fa-solid fa-trash-can"></i> Delete Complaint</button>
        <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">Discard</button>
        <button class="btn btn-primary btn-save-resolution" onclick="submitAdminUpdate('${id}')"><i class="fa-solid fa-check-circle"></i> Save & Notify Student</button>
    `;
    modal.classList.add('active');

    // --- Live Countdown Timer (only for active/in-progress complaints) ---
    const isCompleted = ['Resolved', 'Under Review'].includes(c.status);
    if (c.assigned_to && c.resolution_deadline && !isCompleted) {
        const timerId = `countdown-timer-${c.id}`;
        const deadline = new Date(c.resolution_deadline);
        let overdueAlertSent = false;

        // Clear any previous timer
        if (window._countdownInterval) clearInterval(window._countdownInterval);

        const tick = () => {
            const el = document.getElementById(timerId);
            if (!el) { clearInterval(window._countdownInterval); return; }

            const now = new Date();
            const diff = deadline - now;

            if (diff <= 0) {
                // Overdue
                el.textContent = '⚠ OVERDUE — Deadline Passed';
                el.style.color = '#ef4444';
                // Send one-time overdue notification
                if (!overdueAlertSent) {
                    overdueAlertSent = true;
                    fetch(`${API_BASE}/complaints/overdue-notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ complaintId: c.id })
                    }).then(r => r.json()).then(res => {
                        if (res.success) console.log('[SCMS] Overdue alert sent to admins.');
                    }).catch(err => console.error('[SCMS] Overdue notify failed:', err));
                }
                clearInterval(window._countdownInterval);
                return;
            }

            const days    = Math.floor(diff / 86400000);
            const hours   = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            let display = '';
            if (days > 0)    display += `${days}d `;
            if (hours > 0)   display += `${hours}h `;
            display += `${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;

            el.textContent = display;

            // Dynamic color: green → amber → red
            const hoursTotal = diff / 3600000;
            if (hoursTotal < 1)       el.style.color = '#ef4444';
            else if (hoursTotal < 24) el.style.color = '#f59e0b';
            else                      el.style.color = '#10b981';
        };

        tick(); // run immediately
        window._countdownInterval = setInterval(tick, 1000);
    }

};

window.openAssignModal = async (id) => {
    let c = allComplaints.find(item => item.id === id);
    if (!c) return;

    // --- Case 1: Complaint is already Resolved / Under Review ---
    if (['Resolved', 'Under Review'].includes(c.status)) {
        document.getElementById('modal-title').innerHTML = `
            <span style="color: #10b981; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-check"></i> Complaint ${c.status}
            </span>
        `;
        modalContent.innerHTML = `
            <div style="text-align:center;padding:2rem 1rem;">
                <div style="width:80px;height:80px;border-radius:50%;background:rgba(16,185,129,0.12);border:2px solid rgba(16,185,129,0.3);display:inline-flex;align-items:center;justify-content:center;margin-bottom:1.25rem;">
                    <i class="fa-solid fa-circle-check" style="font-size:2.5rem;color:#10b981;"></i>
                </div>
                <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:900;color:var(--text-main);margin:0 0 0.5rem 0;">
                    Complaint ${c.status === 'Under Review' ? 'Under Review' : 'Resolved Successfully'} ✅
                </h3>
                <p style="color:var(--text-muted);font-size:0.95rem;line-height:1.6;margin:0 0 1.5rem 0;">
                    ${c.status === 'Under Review'
                        ? 'The assigned employee has submitted their proof of work. Please review it from the Manage Complaint panel.'
                        : 'This complaint has been fully resolved. No further assignment is needed.'}
                </p>
                <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:1rem 1.25rem;text-align:left;display:flex;align-items:center;gap:12px;">
                    <i class="fa-solid fa-tag" style="color:#10b981;font-size:1.1rem;"></i>
                    <div>
                        <div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;color:#10b981;letter-spacing:0.06em;">Subject</div>
                        <div style="font-size:0.95rem;font-weight:700;color:var(--text-main);margin-top:2px;">${c.title}</div>
                    </div>
                    <span style="margin-left:auto;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:#10b981;padding:5px 14px;border-radius:100px;font-size:0.72rem;font-weight:900;text-transform:uppercase;">${c.status}</span>
                </div>
            </div>
        `;
        modalActions.innerHTML = `
            <button class="btn btn-secondary btn-modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">Close</button>
        `;
        document.getElementById('modal-overlay').classList.add('active');
        return;
    }

    document.getElementById('modal-title').innerHTML = `
        <span style="color: var(--primary); font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-user-check"></i> Assign Task
        </span>
    `;

    // Build "Already Assigned" banner if employee is assigned
    const alreadyAssignedBanner = c.assigned_to ? (() => {
        const empId = `EMP-${String(c.assigned_to).padStart(3, '0')}`;
        const deadlineStr = c.resolution_deadline
            ? new Date(c.resolution_deadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
            : 'No deadline set';
        return `
        <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:16px;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:12px;">
            <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fa-solid fa-user-tie" style="color:#f59e0b;font-size:1rem;"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#f59e0b;margin-bottom:3px;">Already Assigned</div>
                <div style="font-size:0.95rem;font-weight:800;color:var(--text-main);">${c.assigned_to_name} <span style="color:var(--primary);font-size:0.8rem;">(${empId})</span></div>
                <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${deadlineStr}</div>
            </div>
            <span style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#f59e0b;padding:4px 12px;border-radius:100px;font-size:0.7rem;font-weight:900;text-transform:uppercase;flex-shrink:0;">Reassign?</span>
        </div>`;
    })() : '';



    modalContent.innerHTML = `
        <style>
            #modal-overlay.active .modal-card {
                max-width: 500px !important;
                border-radius: 24px;
                box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
                overflow: visible !important;
            }
            #modal-overlay.active .modal-body {
                overflow: visible !important;
                padding: 2rem;
            }
            .assign-header-card {
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%);
                border: 1px solid rgba(79, 70, 229, 0.12);
                border-left: 4px solid var(--primary);
                border-radius: 16px;
                padding: 1.25rem 1.5rem;
                position: relative;
                overflow: hidden;
                margin-bottom: 1.5rem;
            }
            .assign-header-glow {
                position: absolute;
                top: -50px;
                right: -50px;
                width: 150px;
                height: 150px;
                background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0) 70%);
                pointer-events: none;
            }
            .assign-header-icon-watermark {
                position: absolute;
                bottom: -15px;
                right: 15px;
                font-size: 4.5rem;
                color: var(--primary);
                opacity: 0.04;
                pointer-events: none;
            }
            .assign-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                background: rgba(99, 102, 241, 0.08);
                border: 1px solid rgba(99, 102, 241, 0.16);
                border-radius: 100px;
                font-size: 0.75rem;
                font-weight: 800;
                color: var(--primary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.5rem;
            }
            .assign-title {
                font-family: 'Outfit', sans-serif;
                font-size: 1.2rem;
                font-weight: 800;
                color: var(--text-main);
                margin: 0 0 0.4rem 0;
                letter-spacing: -0.01em;
                line-height: 1.3;
            }
            .assign-desc {
                font-size: 0.85rem;
                color: var(--text-muted);
                line-height: 1.4;
                margin: 0;
            }
            .assign-form-container {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }
            .assign-field-group {
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .assign-field-group:first-of-type {
                z-index: 10; /* Ensure dropdown displays above datepicker container */
            }
            .assign-field-group:last-of-type {
                z-index: 1;
            }
            .assign-field-label {
                font-size: 0.8rem;
                font-weight: 800;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .assign-input-wrapper {
                position: relative;
                width: 100%;
            }
            .assign-input-icon {
                position: absolute;
                left: 16px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--primary);
                font-size: 1.05rem;
                opacity: 0.85;
                pointer-events: none;
                transition: var(--transition);
                z-index: 5;
            }
            
            /* Custom Modern Autocomplete Dropdown Styles */
            .custom-select-container {
                position: relative;
                width: 100%;
            }
            .custom-select-trigger {
                width: 100%;
                height: 48px;
                background: var(--bg-input);
                border: 1.5px solid var(--border);
                border-radius: 12px;
                padding: 0 16px 0 44px;
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--text-main);
                box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: all 0.2s ease;
                box-sizing: border-box;
            }
            .custom-select-trigger:hover {
                border-color: var(--primary);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
            }
            .custom-select-trigger.active {
                border-color: var(--primary);
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
            }
            .custom-select-arrow {
                color: var(--text-muted);
                font-size: 0.8rem;
                transition: transform 0.2s ease;
            }
            .custom-select-trigger.active .custom-select-arrow {
                transform: rotate(180deg);
                color: var(--primary);
            }
            .custom-select-options-list {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                width: 100%;
                background: var(--bg-input); /* Solid background to prevent overlap translucency */
                border: 1.5px solid var(--primary);
                border-radius: 14px;
                box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
                z-index: 1200; /* Ensure it stays completely on top of all other page inputs */
                box-sizing: border-box;
                padding: 8px;
                display: flex;
                flex-direction: column;
                animation: dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes dropdownFadeIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .custom-select-search-wrapper {
                padding: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 6px;
                background: var(--bg-input);
            }
            .custom-select-search-input {
                width: 100%;
                height: 36px;
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 0 12px 0 34px;
                font-size: 0.85rem;
                background: var(--bg-app);
                color: var(--text-main);
                font-family: inherit;
                outline: none;
                box-sizing: border-box;
                transition: border-color 0.2s;
            }
            .custom-select-search-input:focus {
                border-color: var(--primary);
            }
            .custom-select-items-holder {
                max-height: 180px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .custom-select-items-holder::-webkit-scrollbar {
                width: 5px;
            }
            .custom-select-items-holder::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 10px;
            }
            .custom-select-option {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
                box-sizing: border-box;
            }
            .custom-select-option:hover {
                background: rgba(99, 102, 241, 0.06);
                transform: translateX(4px);
            }
            .custom-select-option.selected {
                background: rgba(99, 102, 241, 0.1);
                color: var(--primary);
                font-weight: 700;
            }
            .option-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                font-weight: 700;
                font-size: 0.8rem;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(99, 102, 241, 0.2);
                flex-shrink: 0;
            }
            .option-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                text-align: left;
                min-width: 0;
            }
            .option-name {
                font-size: 0.88rem;
                font-weight: 700;
                color: var(--text-main);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .option-id {
                font-size: 0.74rem;
                color: var(--text-muted);
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Date Picker custom input */
            .assign-date {
                width: 100%;
                height: 48px;
                background: var(--bg-input);
                border: 1.5px solid var(--border);
                border-radius: 12px;
                padding: 0 16px 0 44px;
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--text-main);
                box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                transition: all 0.2s ease;
                outline: none;
                box-sizing: border-box;
                font-family: inherit;
            }
            .assign-date:focus {
                border-color: var(--primary);
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
            }
            .assign-date::-webkit-calendar-picker-indicator {
                background: transparent;
                bottom: 0;
                color: transparent;
                cursor: pointer;
                height: auto;
                left: 0;
                position: absolute;
                right: 0;
                top: 0;
                width: auto;
                z-index: 2;
            }
            .assign-date-arrow {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
                font-size: 0.95rem;
                pointer-events: none;
                z-index: 1;
            }
            .assign-btn-cancel {
                background: transparent;
                border: 1.5px solid var(--border);
                color: var(--text-muted);
                font-weight: 700;
                border-radius: 12px;
                height: 46px;
                padding: 0 1.5rem;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 0.95rem;
                font-family: inherit;
            }
            .assign-btn-cancel:hover {
                background: rgba(100, 116, 139, 0.05);
                color: var(--text-main);
                border-color: var(--text-muted);
            }
            .assign-btn-submit {
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                font-weight: 700;
                border-radius: 12px;
                height: 46px;
                padding: 0 1.75rem;
                border: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
                transition: all 0.2s ease;
                font-size: 0.95rem;
                font-family: inherit;
            }
            .assign-btn-submit:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
                filter: brightness(1.03);
            }
            .assign-btn-submit:active {
                transform: translateY(0);
            }
        </style>

        <div class="assign-header-card">
            <div class="assign-header-glow"></div>
            <div class="assign-header-icon-watermark"><i class="fa-solid fa-clipboard-list"></i></div>
            <span class="assign-badge"><i class="fa-solid fa-layer-group"></i> ${c.category}</span>
            <h2 class="assign-title">${c.title}</h2>
            <p class="assign-desc">${c.assigned_to ? 'Update the assigned employee or change the resolution deadline.' : 'Assign this complaint task to a verified employee and establish a resolution time limit.'}</p>
        </div>

        ${alreadyAssignedBanner}

        <div class="assign-form-container">
            <div class="assign-field-group">
                <label class="assign-field-label">
                    <i class="fa-solid fa-user-tie"></i> Select Employee *
                </label>
                <div class="custom-select-container">
                    <div class="custom-select-trigger" id="custom-employee-select-trigger">
                        <span id="custom-employee-select-value">-- Choose Employee --</span>
                        <i class="fa-solid fa-chevron-down custom-select-arrow"></i>
                    </div>
                    <i class="fa-solid fa-user-check assign-input-icon"></i>
                    <div class="custom-select-options-list hidden" id="custom-employee-options-list">
                        <div class="custom-select-search-wrapper" onclick="event.stopPropagation();">
                            <div style="position: relative; width: 100%;">
                                <input type="text" id="custom-employee-search" class="custom-select-search-input" placeholder="Search employee name, ID or email...">
                                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;"></i>
                            </div>
                        </div>
                        <div id="custom-employee-items-holder" class="custom-select-items-holder">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                    <input type="hidden" id="assign-modal-employee-select" value="">
                </div>
            </div>
            
            <div class="assign-field-group">
                <label for="assign-modal-deadline" class="assign-field-label">
                    <i class="fa-regular fa-clock"></i> Resolution Deadline Limit
                </label>
                <div class="assign-input-wrapper">
                    <input type="datetime-local" id="assign-modal-deadline" class="assign-date">
                    <i class="fa-regular fa-calendar-days assign-input-icon"></i>
                    <i class="fa-regular fa-calendar assign-date-arrow"></i>
                </div>
            </div>
        </div>
    `;

    modalActions.innerHTML = `
        <button class="assign-btn-cancel" onclick="document.getElementById('modal-overlay').classList.remove('active')">Cancel</button>
        <button class="assign-btn-submit" onclick="submitModalAssignment('${id}')">
            <i class="fa-solid fa-user-plus"></i> Assign Task
        </button>
    `;

    // Populate custom dropdown with employees
    try {
        const res = await fetch(`${API_BASE}/admin/employees`);
        const employees = await res.json();
        
        const trigger = document.getElementById('custom-employee-select-trigger');
        const list = document.getElementById('custom-employee-options-list');
        const itemsHolder = document.getElementById('custom-employee-items-holder');
        const valueSpan = document.getElementById('custom-employee-select-value');
        const hiddenInput = document.getElementById('assign-modal-employee-select');
        const searchInput = document.getElementById('custom-employee-search');
        
        if (trigger && list && itemsHolder && valueSpan && hiddenInput) {
            const openDropdown = () => {
                trigger.classList.add('active');
                list.classList.remove('hidden');
                if (searchInput) {
                    searchInput.value = '';
                    // Reset filter on open
                    const items = itemsHolder.querySelectorAll('.custom-select-option');
                    items.forEach(item => item.style.display = 'flex');
                    setTimeout(() => searchInput.focus(), 60);
                }
            };
            
            const closeDropdown = () => {
                trigger.classList.remove('active');
                list.classList.add('hidden');
            };

            // Setup trigger click event
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (list.classList.contains('hidden')) {
                    openDropdown();
                } else {
                    closeDropdown();
                }
            });
            
            // Document click to close dropdown when clicking outside
            const clickOutsideHandler = (e) => {
                if (!trigger.contains(e.target) && !list.contains(e.target)) {
                    closeDropdown();
                }
            };
            document.addEventListener('click', clickOutsideHandler);
            
            // Cleanup event listener when modal is closed
            const closeBtn = document.getElementById('close-modal');
            const cancelBtn = document.querySelector('.assign-btn-cancel');
            [closeBtn, cancelBtn].forEach(btn => {
                btn?.addEventListener('click', () => {
                    document.removeEventListener('click', clickOutsideHandler);
                });
            });

            itemsHolder.innerHTML = '';
            
            // Default "Choose Employee" option
            const defaultOpt = document.createElement('div');
            defaultOpt.className = 'custom-select-option choose-default-opt';
            defaultOpt.innerHTML = `
                <div class="option-avatar" style="background: rgba(100,116,139,0.1); color: var(--text-muted); box-shadow: none;">👤</div>
                <div class="option-info">
                    <div class="option-name">-- Choose Employee --</div>
                </div>
            `;
            defaultOpt.addEventListener('click', (e) => {
                e.stopPropagation();
                valueSpan.textContent = '-- Choose Employee --';
                hiddenInput.value = '';
                hiddenInput.dataset.name = '';
                itemsHolder.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                defaultOpt.classList.add('selected');
                closeDropdown();
            });
            itemsHolder.appendChild(defaultOpt);

            employees.forEach(emp => {
                const empIdStr = `EMP-${emp.id.toString().padStart(3, '0')}`;
                const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                const opt = document.createElement('div');
                opt.className = 'custom-select-option';
                if (emp.id === c.assigned_to) {
                    opt.classList.add('selected');
                    valueSpan.textContent = `${emp.name} (${empIdStr})`;
                    hiddenInput.value = emp.id;
                    hiddenInput.dataset.name = emp.name;
                }
                opt.innerHTML = `
                    <div class="option-avatar">${initials}</div>
                    <div class="option-info">
                        <div class="option-name">${emp.name}</div>
                        <div class="option-id">${empIdStr} &bull; ${emp.email}</div>
                    </div>
                `;
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    valueSpan.textContent = `${emp.name} (${empIdStr})`;
                    hiddenInput.value = emp.id;
                    hiddenInput.dataset.name = emp.name;
                    itemsHolder.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    closeDropdown();
                });
                itemsHolder.appendChild(opt);
            });

            // Search implementation
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase().trim();
                    const items = itemsHolder.querySelectorAll('.custom-select-option');
                    items.forEach(item => {
                        const name = item.querySelector('.option-name')?.textContent.toLowerCase() || '';
                        const id = item.querySelector('.option-id')?.textContent.toLowerCase() || '';
                        if (name.includes(term) || id.includes(term) || item.classList.contains('choose-default-opt') || term === '') {
                            item.style.display = 'flex';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            }
        }
    } catch (err) {
        console.error("Failed to populate employee dropdown:", err);
    }

    if (c.resolution_deadline) {
        try {
            // ISO format formatting for datetime-local (YYYY-MM-DDTHH:MM)
            const d = new Date(c.resolution_deadline.replace(' ', 'T'));
            const offset = d.getTimezoneOffset();
            const localDate = new Date(d.getTime() - (offset * 60 * 1000));
            const iso = localDate.toISOString().slice(0, 16);
            document.getElementById('assign-modal-deadline').value = iso;
        } catch (e) {
            console.error(e);
        }
    }

    modal.classList.add('active');
};

async function submitModalAssignment(complaintId) {
    const select = document.getElementById('assign-modal-employee-select');
    const deadlineInput = document.getElementById('assign-modal-deadline');
    if (!select) return;
    
    const employeeId = select.value;
    const employeeName = select.dataset.name || '';
    const deadline = deadlineInput ? deadlineInput.value : '';
    
    if (!employeeId) {
        showToast('Please select an employee to assign', 'warning');
        return;
    }
    
    const loadingToast = showToast('Assigning task & notifying employee...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaintId, employeeId, employeeName, deadline })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        
        if (data.success) {
            showToast('Employee assigned and notified successfully!', 'success');
            document.getElementById('modal-overlay').classList.remove('active');
            refreshData();
        } else {
            showToast(data.message || 'Assignment failed', 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Connection error', 'danger');
    }
}

window.openAssignModal = openAssignModal;
window.submitModalAssignment = submitModalAssignment;

async function submitAdminUpdate(id) {
    const status = document.getElementById('update-status').value;
    const priority = document.getElementById('update-priority').value;
    const reply = document.getElementById('update-reply').value;

    const loadingToast = showToast('Updating complaint & notifying student...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, priority, reply })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);

        if (data.success) {
            showToast('Complaint updated successfully');
            modal.classList.remove('active');
            refreshData();
        } else {
            showToast(data.message || 'Update failed', 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
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
                    <td class="nowrap">
                        <button class="btn" onclick="openAssignModal('${c.id}')" style="padding: 0.4rem 1rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #3b82f6; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.3s ease; box-sizing: border-box; height: 32px; font-weight: 700;">
                            Assign <i class="fa-solid fa-user-check"></i>
                        </button>
                    </td>
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
                <td class="nowrap" style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-primary" onclick="manageComplaint('${c.id}')" style="padding: 0.45rem 1.25rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; height: 36px;">
                        Review <i class="fa-solid fa-sliders"></i>
                    </button>
                    <button class="btn" onclick="openAssignModal('${c.id}')" style="padding: 0.45rem 1.25rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #3b82f6; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.3s ease; box-sizing: border-box; height: 36px; font-weight: 700;">
                        Assign <i class="fa-solid fa-user-check"></i>
                    </button>
                </td>
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

    document.getElementById('adm-search-employees')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderEmployeesList(allEmployees);
            return;
        }
        const filtered = allEmployees.filter(emp => 
            emp.name.toLowerCase().includes(query) || 
            emp.email.toLowerCase().includes(query)
        );
        renderEmployeesList(filtered);
    });

    document.getElementById('emp-send-otp-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('emp-reg-name').value.trim();
        const email = document.getElementById('emp-reg-email').value.trim();
        const password = document.getElementById('emp-reg-password').value.trim();
        
        if (!name || !email || !password) {
            showToast('All fields are required to send OTP code', 'warning');
            return;
        }
        
        const sendBtn = document.getElementById('emp-send-otp-btn');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>...`;
        
        try {
            const res = await fetch(`${API_BASE}/admin/send-employee-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send OTP code');
            
            showToast('Verification code sent to employee email!', 'success');
            document.getElementById('emp-otp-input-wrapper').classList.remove('hidden');
            sendBtn.classList.add('hidden');
        } catch (err) {
            showToast(err.message, 'danger');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    });

    document.getElementById('emp-verify-otp-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('emp-reg-name').value.trim();
        const email = document.getElementById('emp-reg-email').value.trim();
        const otp = document.getElementById('emp-otp-input').value.trim();
        
        if (!otp) {
            showToast('Please enter the verification code', 'warning');
            return;
        }
        
        const verifyBtn = document.getElementById('emp-verify-otp-btn');
        const originalText = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        
        try {
            const res = await fetch(`${API_BASE}/admin/verify-employee-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Verification failed');
            
            showToast(`Employee ${name} verified & registered successfully!`, 'success');
            
            // Show email verified status
            document.getElementById('emp-otp-input-wrapper').classList.add('hidden');
            document.getElementById('emp-email-status').classList.remove('hidden');
            
            // Enable submit button
            const submitBtn = document.getElementById('emp-register-submit-btn');
            submitBtn.removeAttribute('disabled');
            submitBtn.style.opacity = '1';
            submitBtn.style.pointerEvents = 'auto';
            
            fetchAdminEmployees();
        } catch (err) {
            showToast(err.message, 'danger');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalText;
        }
    });

    document.getElementById('admin-create-employee-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Employee account created and active!', 'success');
        
        // Reset form to default state
        e.target.reset();
        document.getElementById('emp-otp-input-wrapper').classList.add('hidden');
        document.getElementById('emp-email-status').classList.add('hidden');
        
        const sendBtn = document.getElementById('emp-send-otp-btn');
        sendBtn.classList.remove('hidden');
        
        const submitBtn = document.getElementById('emp-register-submit-btn');
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.style.opacity = '0.5';
        submitBtn.style.pointerEvents = 'none';
        
        fetchAdminEmployees();
    });
});

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('security-current-password').value;
    const newPassword = document.getElementById('security-new-password').value;
    const confirmPassword = document.getElementById('security-confirm-password').value;

    if (newPassword !== confirmPassword) {
        return showToast('New passwords do not match!', 'danger');
    }

    const submitBtn = document.getElementById('change-pwd-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Updating...`;

    try {
        const res = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                currentPassword,
                newPassword
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Password updated successfully!', 'success');
            document.getElementById('change-password-form').reset();
            if (currentUser.role === 'admin') {
                document.getElementById('nav-adm-dashboard')?.click();
            } else {
                document.getElementById('nav-stu-dashboard')?.click();
            }
        } else {
            showToast(data.message || 'Password update failed.', 'danger');
        }
    } catch (err) {
        showToast('Server connection failed.', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function deleteComplaint(id) {
    if (!confirm(`Are you sure you want to permanently delete complaint #${id}? This action cannot be undone.`)) {
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/complaints/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Complaint deleted successfully!', 'success');
            document.getElementById('modal-overlay').classList.remove('active');
            refreshData();
        } else {
            showToast(data.message || 'Failed to delete complaint.', 'danger');
        }
    } catch (err) {
        showToast('Server error. Could not delete complaint.', 'danger');
    }
}

// Expose globally for inline onclick
window.deleteComplaint = deleteComplaint;

let allEmployees = [];

async function fetchAdminEmployees() {
    try {
        const res = await fetch(`${API_BASE}/admin/employees`);
        allEmployees = await res.json();
        renderEmployeesList(allEmployees);
    } catch (err) {
        console.error("Failed to fetch employees:", err);
    }
}

function renderEmployeesList(employees) {
    const body = document.getElementById('adm-employees-table-body');
    if (!body) return;
    body.innerHTML = '';
    
    if (employees.length === 0) {
        body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No employees registered yet.</td></tr>`;
        return;
    }
    
    employees.forEach(emp => {
        const empIdStr = `EMP-${emp.id.toString().padStart(3, '0')}`;
        body.innerHTML += `
            <tr class="animate-up">
                <td><strong style="color: var(--primary);">${empIdStr}</strong></td>
                <td><span style="font-weight: 700;">${emp.name}</span></td>
                <td><span style="opacity: 0.8;">${emp.email}</span></td>
                <td class="nowrap">
                    <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id}, '${emp.name}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

async function deleteEmployee(userId, name) {
    if (!confirm(`Are you sure you want to permanently delete employee account for ${name}?`)) {
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete employee account');
        
        showToast(`Employee account for ${name} deleted successfully.`, 'success');
        fetchAdminEmployees();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function populateEmployeesDropdown(currentlyAssignedId) {
    try {
        const res = await fetch(`${API_BASE}/admin/employees`);
        const employees = await res.json();
        const select = document.getElementById('assign-employee-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Choose Employee --</option>';
        
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.dataset.name = emp.name;
            option.textContent = `${emp.name} (EMP-${emp.id.toString().padStart(3, '0')})`;
            if (emp.id === currentlyAssignedId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to populate employee dropdown:", err);
    }
}

async function assignWorkerToComplaint(complaintId) {
    const select = document.getElementById('assign-employee-select');
    const deadlineInput = document.getElementById('assign-deadline');
    if (!select) return;
    
    const employeeId = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const employeeName = selectedOption ? selectedOption.dataset.name : '';
    const deadline = deadlineInput ? deadlineInput.value : '';
    
    if (!employeeId) {
        showToast('Please select an employee to assign', 'warning');
        return;
    }
    
    const loadingToast = showToast('Assigning task...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaintId, employeeId, employeeName, deadline })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        
        if (data.success) {
            showToast('Employee assigned and notified successfully!', 'success');
            document.getElementById('modal-overlay').classList.remove('active');
            refreshData();
        } else {
            showToast(data.message || 'Assignment failed', 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Connection error', 'danger');
    }
}

function renderEmployeeView(complaints) {
    const total = complaints.length;
    const progress = complaints.filter(c => c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    
    document.getElementById('emp-assigned-count').textContent = total;
    document.getElementById('emp-progress-count').textContent = progress;
    document.getElementById('emp-resolved-count').textContent = resolved;
    
    const body = document.getElementById('emp-tasks-table-body');
    if (!body) return;
    body.innerHTML = '';
    
    if (complaints.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No assigned complaints at the moment.</td></tr>`;
        return;
    }
    
    complaints.forEach(c => {
        const statusClass = c.status.toLowerCase().replace(/\s+/g, '');
        const priorityClass = c.priority.toLowerCase();
        
        let deadlineText = 'Not Specified';
        let deadlineStyle = '';
        if (c.resolution_deadline) {
            try {
                // Parse date safely
                const d = new Date(c.resolution_deadline.replace(' ', 'T'));
                deadlineText = d.toLocaleString();
                if (d < new Date() && c.status !== 'Resolved') {
                    deadlineStyle = 'color: var(--danger); font-weight: 700;';
                }
            } catch (e) {
                deadlineText = c.resolution_deadline;
            }
        }
        
        body.innerHTML += `
            <tr class="animate-up">
                <td class="nowrap"><strong style="color: var(--primary);">#${c.id}</strong></td>
                <td><span style="font-weight: 700;">${c.title}</span></td>
                <td><span style="opacity: 0.8;">${c.category}</span></td>
                <td class="nowrap"><span style="${deadlineStyle}"><i class="fa-regular fa-clock" style="margin-right: 6px; opacity: 0.5;"></i>${deadlineText}</span></td>
                <td class="nowrap"><span class="priority-badge ${priorityClass}"><i class="fa-solid fa-circle"></i> ${c.priority}</span></td>
                <td class="nowrap"><span class="status-badge status-${statusClass}">${c.status}</span></td>
                <td class="nowrap">
                    <button class="btn btn-primary btn-sm" onclick="viewComplaint('${c.id}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                        <i class="fa-solid fa-eye"></i> Details
                    </button>
                </td>
            </tr>
        `;
    });
}

async function submitWorkerUpdate(id) {
    const status = document.getElementById('worker-update-status').value;
    const reply = document.getElementById('worker-update-reply').value;
    const worker_evidence = document.getElementById('worker-evidence-base64')?.value || '';
    
    if (status === 'Resolved' && !worker_evidence) {
        showToast('Uploading proof of work evidence image is mandatory to resolve a complaint.', 'warning');
        return;
    }
    
    const loadingToast = showToast('Updating task & notifying admin...', 'info', 0);
    try {
        const res = await fetch(`${API_BASE}/complaints/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id, 
                status, 
                reply,
                updater_role: 'employee',
                employee_name: currentUser.name,
                worker_evidence: worker_evidence
            })
        });
        const data = await res.json();
        
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        
        if (data.success) {
            showToast('Task updated successfully and admin notified!', 'success');
            document.getElementById('modal-overlay').classList.remove('active');
            refreshData();
        } else {
            showToast(data.message || 'Update failed', 'danger');
        }
    } catch (err) {
        loadingToast.classList.remove('show');
        setTimeout(() => loadingToast.remove(), 500);
        showToast('Connection error', 'danger');
    }
}

async function handleWorkerEvidenceUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file as proof of work evidence.', 'warning');
        input.value = '';
        return;
    }
    
    const displayFilename = document.getElementById('worker-evidence-filename');
    const base64Input = document.getElementById('worker-evidence-base64');
    const dropzone = document.getElementById('worker-evidence-dropzone');
    
    if (displayFilename) {
        displayFilename.textContent = `Processing proof image: ${file.name}...`;
    }
    
    try {
        const base64 = await processFile(file);
        if (base64Input) {
            base64Input.value = base64;
        }
        if (displayFilename) {
            displayFilename.innerHTML = `<span style="color: var(--success); font-weight: 800;"><i class="fa-solid fa-circle-check"></i> Proof uploaded: ${file.name}</span>`;
        }
        if (dropzone) {
            dropzone.style.borderColor = 'var(--success)';
            dropzone.style.background = 'rgba(16, 185, 129, 0.02)';
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to process image file.', 'danger');
        if (displayFilename) {
            displayFilename.textContent = 'Upload failed, please try again.';
        }
    }
}

// Expose functions globally for inline onclick
window.deleteEmployee = deleteEmployee;
window.assignWorkerToComplaint = assignWorkerToComplaint;
window.submitWorkerUpdate = submitWorkerUpdate;
window.handleWorkerEvidenceUpload = handleWorkerEvidenceUpload;
window.fetchAdminEmployees = fetchAdminEmployees;
window.renderEmployeesList = renderEmployeesList;
window.populateEmployeesDropdown = populateEmployeesDropdown;
window.renderEmployeeView = renderEmployeeView;

