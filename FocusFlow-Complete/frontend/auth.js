
const API_URL = 'https://focus-flow-complete.vercel.app/api/auth';

// If already logged in, go to the dashboard.
if (localStorage.getItem('token')) {
    window.location.href = 'index.html';
}

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');

const authMessage = document.getElementById('authMessage');

function showMessage(message, type = 'error') {
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
}

function switchTab(tab) {
    authMessage.className = 'auth-message';
    authMessage.textContent = '';

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';

        loginTab.classList.add('active');
        registerTab.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';

        registerTab.classList.add('active');
        loginTab.classList.remove('active');
    }
}

loginTab.addEventListener('click', () => switchTab('login'));
registerTab.addEventListener('click', () => switchTab('register'));

// Login
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        window.location.href = 'index.html';

    } catch (error) {
        showMessage(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Login to FocusFlow';
    }
});

// Registration
registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Creating account...';

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        window.location.href = 'index.html';

    } catch (error) {
        showMessage(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Account';
    }
});

// Show login form by default.
switchTab('login');
