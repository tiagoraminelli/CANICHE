const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_URL = isLocal ? "https://castraciones-tiagoraminelli.aws-sa-east-1.vercel.app/api/turnos" : "/api/turnos";

let paginaActual = 1;
let timeoutBusqueda;

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar fechas
    const hoy = new Date();
    document.getElementById('i-fecha').valueAsDate = hoy;
    document.getElementById('filtro-mes').value = hoy.toISOString().slice(0, 7); // "YYYY-MM"
    
    initApp();
});

async function initApp() {
    try {
        await cargarPersonasEnBuscador();
        await loadTurnos();
        document.getElementById('status-db').textContent = "Online";
        document.getElementById('status-db').classList.replace('text-neutral-400', 'text-green-600');
    } catch {
        document.getElementById('status-db').textContent = "Error";
    }
}

// --- NAVEGACIÓN ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`tab-${e.target.dataset.tab}`).classList.remove('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('bg-neutral-100', 'text-neutral-900'));
        e.target.classList.add('bg-neutral-100', 'text-neutral-900');

        if (e.target.dataset.tab === 'directorio') loadDirectorio();
    });
});

// --- MODALES ---
window.abrirModalIngreso = () => { document.getElementById('modal-ingreso').classList.replace('hidden', 'flex'); };
window.cerrarModal = (id) => { document.getElementById(id).classList.replace('flex', 'hidden'); };

// --- FILTROS Y PAGINACIÓN ---
document.getElementById('filtro-mes').addEventListener('change', () => { paginaActual = 1; loadTurnos(); });
document.getElementById('filtro-busqueda').addEventListener('input', () => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => { paginaActual = 1; loadTurnos(); }, 400);
});

window.cambiarPagina = (delta) => {
    paginaActual += delta;
    loadTurnos();
};

// --- CARGA DE TURNOS ---
async function loadTurnos() {
    const tbody = document.getElementById('tabla-turnos');
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-neutral-400">Cargando...</td></tr>';

    const mes = document.getElementById('filtro-mes').value;
    const busqueda = document.getElementById('filtro-busqueda').value;

    try {
        const res = await fetch(`${API_URL}?pagina=${paginaActual}&mes=${mes}&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        
        // Actualizar paginación
        document.getElementById('info-paginacion').textContent = `Mostrando página ${data.currentPage} de ${data.totalPages || 1} (${data.total} turnos)`;
        document.getElementById('btn-prev').disabled = data.currentPage <= 1;
        document.getElementById('btn-next').disabled = data.currentPage >= data.totalPages;

        if (data.turnos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-neutral-400">No hay turnos para este filtro.</td></tr>';
            return;
        }

        tbody.innerHTML = data.turnos.map(t => {
            let badgeClass = 'bg-neutral-100 text-neutral-600';
            if (t.estado === 'asistio') badgeClass = 'bg-green-100 text-green-700';
            if (t.estado === 'cancelado' || t.estado === 'ausente') badgeClass = 'bg-red-100 text-red-700';

            return `
            <tr class="hover:bg-neutral-50">
                <td class="px-4 py-3 text-neutral-900 whitespace-nowrap">${t.fecha_hora}</td>
                <td class="px-4 py-3 text-neutral-600">${t.animal} <span class="text-xs text-neutral-400">(${t.especie})</span></td>
                <td class="px-4 py-3 text-neutral-600">${t.dueno} <br><span class="text-xs text-neutral-400">${t.telefono || ''}</span></td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs font-medium ${badgeClass}">${t.estado.toUpperCase()}</span></td>
                <td class="px-4 py-3 text-right space-x-2">
                    <button onclick='verDetalles(${JSON.stringify(t)})' class="text-xs font-medium text-neutral-600 hover:text-black underline">Ver</button>
                    <button onclick='abrirEditar(${JSON.stringify(t)})' class="text-xs font-medium text-blue-600 hover:text-blue-800 underline">Editar</button>
                    <button onclick="eliminarTurno('${t.id}')" class="text-xs font-medium text-red-600 hover:text-red-800 underline">Eliminar</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">Error de conexión.</td></tr>';
    }
}

// --- ACCIONES ---
window.verDetalles = (turno) => {
    document.getElementById('contenido-ver').innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div><span class="text-neutral-500 block text-xs">Fecha/Hora</span> <strong>${turno.fecha_hora}</strong></div>
            <div><span class="text-neutral-500 block text-xs">Estado</span> <strong>${turno.estado.toUpperCase()}</strong></div>
            <div><span class="text-neutral-500 block text-xs">Animal</span> ${turno.animal} (${turno.especie} - ${turno.sexo})</div>
            <div><span class="text-neutral-500 block text-xs">Responsable</span> ${turno.dueno}</div>
            <div><span class="text-neutral-500 block text-xs">Teléfono</span> ${turno.telefono || '-'}</div>
            <div><span class="text-neutral-500 block text-xs">Dirección</span> ${turno.direccion || '-'}</div>
        </div>
        <div class="mt-4 pt-4 border-t">
            <span class="text-neutral-500 block text-xs mb-1">Observaciones</span>
            <p class="bg-neutral-50 p-2 rounded text-neutral-700 min-h-[40px]">${turno.observaciones || 'Sin observaciones.'}</p>
        </div>
    `;
    document.getElementById('modal-ver').classList.replace('hidden', 'flex');
};

window.abrirEditar = (t) => {
    document.getElementById('edit-id').value = t.id;
    const [fecha, horaCompleta] = t.fecha_hora.split(' ');
    document.getElementById('edit-fecha').value = fecha;
    document.getElementById('edit-hora').value = horaCompleta ? horaCompleta.substring(0, 5) : '';
    document.getElementById('edit-estado').value = t.estado;
    document.getElementById('edit-observaciones').value = t.observaciones || '';
    document.getElementById('modal-editar').classList.replace('hidden', 'flex');
};

window.eliminarTurno = async (id) => {
    if (!confirm("¿Eliminar este turno? El animal y la persona quedarán en el directorio.")) return;
    try {
        const res = await fetch(API_URL, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turnoId: id })
        });
        if (res.ok) loadTurnos();
    } catch (e) { alert("Error al eliminar"); }
};

// --- FORMULARIOS ---
document.getElementById('form-editar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        turnoId: document.getElementById('edit-id').value,
        fecha: document.getElementById('edit-fecha').value,
        hora: document.getElementById('edit-hora').value,
        estado: document.getElementById('edit-estado').value,
        observaciones: document.getElementById('edit-observaciones').value
    };
    const res = await fetch(API_URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { cerrarModal('modal-editar'); loadTurnos(); }
});

document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.textContent = "Guardando...";
    
    const payload = {
        personaExistenteId: document.getElementById('buscador-persona').value,
        nombre: document.getElementById('i-nombre').value,
        apellido: document.getElementById('i-apellido').value,
        telefono: document.getElementById('i-telefono').value,
        direccion: document.getElementById('i-direccion').value,
        animal: document.getElementById('i-animal-nombre').value,
        especie: document.getElementById('i-especie').value,
        sexo: document.getElementById('i-sexo').value,
        fecha: document.getElementById('i-fecha').value,
        hora: document.getElementById('i-hora').value,
        observaciones: document.getElementById('i-observaciones').value
    };

    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
        cerrarModal('modal-ingreso');
        e.target.reset();
        document.getElementById('i-fecha').valueAsDate = new Date();
        cargarPersonasEnBuscador();
        loadTurnos();
    }
    btn.textContent = "Confirmar e Ingresar";
});

// --- HELPERS ---
async function cargarPersonasEnBuscador() {
    const res = await fetch(`${API_URL}?tipo=directorio`); // Mantenemos esta llamada o podemos hacer un GET específico
    // Nota: Como cambiamos el backend para paginar, esta llamada dará error si no la adaptamos.
    // Para safar ahora: simulamos que traemos todas las personas de la página 1 (Si hay muchas, habría que crear un endpoint GET /api/personas).
    // Como estamos usando el backend unificado, vamos a pedir turnos y extraer las personas únicas (parche rápido).
    // Lo ideal a futuro es un endpoint /api/personas
    try {
        // Simulamos traer personas desde el directorio
        // HACK TEMPORAL PARA QUE FUNCIONE EL FORMULARIO
        const select = document.getElementById('buscador-persona');
        // Como no tenemos endpoint de personas, dejamos el select solo con la opción de nueva persona por ahora.
        select.innerHTML = '<option value="">-- Registrar nueva persona --</option>';
    } catch(e) {}
}

document.getElementById('buscador-persona').addEventListener('change', (e) => {
    const seccion = document.getElementById('seccion-persona');
    const inputs = seccion.querySelectorAll('input');
    if (e.target.value) {
        seccion.classList.add('opacity-50', 'pointer-events-none');
        inputs.forEach(i => i.required = false);
    } else {
        seccion.classList.remove('opacity-50', 'pointer-events-none');
        inputs.forEach(i => i.required = true);
    }
});

// --- DIRECTORIO ---
async function loadDirectorio() {
    // (Mismo código de antes)
    document.getElementById('tabla-personas').innerHTML = '<tr><td colspan="2" class="text-center py-4 text-neutral-400">No disponible en esta versión.</td></tr>';
    document.getElementById('tabla-animales').innerHTML = '<tr><td colspan="3" class="text-center py-4 text-neutral-400">No disponible en esta versión.</td></tr>';
}