const BACKEND_URL = "http://localhost:3000/api";

const googleBtn = document.querySelector(".google-btn");

document.getElementById('login-form').addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${BACKEND_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login Failed');

        alert(`Welcome back, ${data.user.name}!`);

    } catch (err) {
        alert(err.message);
    }
});

window.onload = function () {
    fetch(`${BACKEND_URL}/config`)
        .then(response => response.json())
        .then(config => {
            if (!config.googleClientId) {
                console.error("Missing GOOGLE_CLIENT_ID in server environment configurations.");
                return;
            }

            // A. Prepare the underlying Google auth configuration layer
            google.accounts.id.initialize({
                client_id: config.googleClientId,
                callback: handleGoogleCredentialResponse // Loops back to your token verification function
            });

            // B. NEW FIXED METHOD: Render the official premium button automatically
            // This replaces attachClickHandler completely
            google.accounts.id.renderButton(
                document.getElementById('google-btn-container'), // Target a container div element wrapper
                {
                    theme: 'dark',      // Matches Vantage's clean dark aesthetic mode perfectly!
                    size: 'large',
                    type: 'standard',
                    shape: 'rectangular',
                    text: 'continue_with',
                    width: '100%'       // Stretches seamlessly to fit card layout width bounds
                }
            );
        })
        .catch(err => console.error("Failed to load server configurations:", err));
};

async function handleGoogleCredentialResponse(response) {
    console.log("Secure token received from Google:", response.credential);

    try {
        const backendRes = await fetch(`${BACKEND_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.credential })
        });

        const data = await backendRes.json();

        if (!backendRes.ok) throw new Error(data.error || 'Google Authentication failed at database check.');
        alert(`Welcome back to Vantage, ${data.user.name}!`);
        console.log("Logged in profile data:", data.user);

        // window.location.href = "/dashboard.html";

    } catch (err) {
        alert(err.message);
    }
}