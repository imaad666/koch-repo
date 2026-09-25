const form = document.getElementById("loginForm");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.textContent = "";
  messageEl.className = "formMessage";

  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      messageEl.textContent = "Incorrect password.";
      messageEl.classList.add("error");
      return;
    }

    window.location.href = "/index.html";
  } catch (err) {
    messageEl.textContent = "Something went wrong. Try again.";
    messageEl.classList.add("error");
  }
});
