const status = document.getElementById("status");
const logoutButton = document.getElementById("logout");
const statusDot = document.querySelector(".status-dot");

async function loadSession() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    const user = response.ok ? await response.json() : null;
    if (!user) {
      status.textContent = "Nenhuma sessão neste navegador.";
      return;
    }

    status.textContent = `Sessão de ${user.email ?? user.displayName ?? "usuário autenticado"}.`;
    statusDot.classList.add("is-active");
    logoutButton.hidden = false;
  } catch {
    status.textContent = "Não foi possível consultar a sessão.";
  }
}

loadSession();