// El frontend ahora solo le pega a nuestra propia API
const API_URL = "/api/turnos";

async function obtenerTurnos() {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Error al obtener turnos");
    const data = await response.json();
    return data.turnos;
}

async function registrarIngreso(datos) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
    });
    if (!response.ok) throw new Error("Error al guardar");
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-registro");
    const tablaBody = document.getElementById("tabla-turnos");

    async function actualizarTabla() {
        tablaBody.innerHTML = "<tr><td colspan='4'>Cargando...</td></tr>";
        
        try {
            const turnos = await obtenerTurnos();
            tablaBody.innerHTML = "";
            
            if (turnos.length === 0) {
                tablaBody.innerHTML = "<tr><td colspan='4'>No hay turnos agendados.</td></tr>";
                return;
            }

            turnos.forEach(turno => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${turno.dueno}</td>
                    <td>${turno.animal} (${turno.especie})</td>
                    <td>${turno.fecha_hora}</td>
                    <td><span class="badge">${turno.estado}</span></td>
                `;
                tablaBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            tablaBody.innerHTML = "<tr><td colspan='4'>Error al cargar datos.</td></tr>";
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        btn.textContent = "Guardando...";
        btn.disabled = true;

        try {
            await registrarIngreso({
                nombre: document.getElementById("nombre").value,
                apellido: document.getElementById("apellido").value,
                telefono: document.getElementById("telefono").value,
                animal: document.getElementById("animal").value,
                especie: document.getElementById("especie").value,
                sexo: document.getElementById("sexo").value
            });
            form.reset();
            await actualizarTabla();
        } catch (error) {
            console.error(error);
            alert("Error al guardar. Revisá la consola.");
        } finally {
            btn.textContent = "Agendar Turno";
            btn.disabled = false;
        }
    });

    actualizarTabla();
});