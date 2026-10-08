const manager = document.getElementById("manager");
const offline = document.getElementById("offline");
async function connect() {
  try {
    const response = await fetch("http://localhost:3100/api/status", {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw Error("Servi?o indispon?vel");
    manager.src = "http://localhost:3100/sidebar";
    manager.hidden = false;
    offline.hidden = true;
  } catch {
    manager.hidden = true;
    offline.hidden = false;
  }
}
document.getElementById("retry").addEventListener("click", connect);
connect();
