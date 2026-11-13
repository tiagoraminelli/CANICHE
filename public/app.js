const API_URL = "/api/turnos";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('i-fecha').valueAsDate = new Date();
    initApp();
});

async function initApp() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            document.getElementById('status-db').textContent = "Online";
            document.getElementById('status-db').classList.replace('text-neutral-400', 'text-green-600');
            loadTurnos();
            cargarPersonasEnBuscador();
        } else throw new Error();
    } catch {
        document.getElementById('status-db').textContent = "Error de conexión";
        document.getElementById('status-db').classList.replace('text-neutral-400', 'text-red-600');
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        switchTab(tabId);
    });
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-neutral-100', 'text-neutral-900');
        el.classList.add('text-neutral-500', 'hover:bg-neutral-50');
    });
    
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-neutral-500', 'hover:bg-neutral-50');
        activeBtn.classList.add('bg-neutral-100', 'text-neutral-900');
    }

    const titles = { ingreso: 'Recepción', listado: 'Turnos Agendados', directorio: 'Directorio' };
    document.getElementById('page-title').textContent = titles[tabId];

    if (tabId === 'listado') loadTurnos();
    if (tabId === 'directorio') loadDirectorio();
}

async function cargarPersonasEnBuscador() {
    const res = await fetch(`${API_URL}?tipo=directorio`);
    const data = await res.json();
    
    const select = document.getElementById('buscador-persona');
    select.innerHTML = '<option value="">-- Registrar nueva persona --</option>' + 
        (data.personas || []).map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.telefono || 'Sin tel'})</option>`).join('');
}

document.getElementById('buscador-persona').addEventListener('change', (e) => {
    const seccionPersona = document.getElementById('seccion-persona');
    const inputsPersona = seccionPersona.querySelectorAll('input');
    
    if (e.target.value) {
        seccionPersona.classList.add('opacity-50', 'pointer-events-none');
        inputsPersona.forEach(i => i.required = false);
    } else {
        seccionPersona.classList.remove('opacity-50', 'pointer-events-none');
        inputsPersona.forEach(i => i.required = true);
    }
});

document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.textContent = "Guardando...";
    btn.disabled = true;

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
        hora: document.getElementById('i-hora').value
    };

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error en el servidor");

        e.target.reset();
        document.getElementById('i-fecha').valueAsDate = new Date();
        document.getElementById('seccion-persona').classList.remove('opacity-50', 'pointer-events-none');
        document.querySelectorAll('#seccion-persona input').forEach(i => i.required = true);
        
        alert("¡Ingreso registrado!");
        cargarPersonasEnBuscador();
        switchTab('listado');

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.textContent = "Confirmar e Ingresar";
        btn.disabled = false;
    }
});

async function loadTurnos() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        const tbody = document.getElementById('tabla-turnos');
        
        if (!data.turnos || data.turnos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-neutral-400">No hay turnos.</td></tr>';
            return;
        }
        tbody.innerHTML = data.turnos.map(t => `
            <tr class="hover:bg-neutral-50">
                <td class="px-4 py-3 text-neutral-900 whitespace-nowrap">${t.fecha_hora}</td>
                <td class="px-4 py-3 text-neutral-600">${t.animal}</td>
                <td class="px-4 py-3 text-neutral-600">${t.dueno} <br><span class="text-xs text-neutral-400">${t.telefono || ''}</span></td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs font-medium ${t.estado === 'asistio' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}">${t.estado.toUpperCase()}</span></td>
                <td class="px-4 py-3 text-right">${t.estado === 'pendiente' ? `<button onclick="marcarAsistio('${t.id}')" class="text-xs font-medium underline hover:text-black">Asistió</button>` : ''}</td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function loadDirectorio() {
    try {
        const res = await fetch(`${API_URL}?tipo=directorio`);
        const data = await res.json();
        
        document.getElementById('tabla-personas').innerHTML = (data.personas || []).map(p => `
            <tr class="hover:bg-neutral-50"><td class="px-4 py-3 text-neutral-900">${p.apellido}, ${p.nombre}</td><td class="px-4 py-3 text-neutral-500">${p.telefono || '-'}</td></tr>
        `).join('');
        
        document.getElementById('tabla-animales').innerHTML = (data.animales || []).map(a => `
            <tr class="hover:bg-neutral-50">
                <td class="px-4 py-3 text-neutral-900">${a.nombre || 'S/N'} <span class="text-xs text-neutral-400">(${a.especie})</span></td>
                <td class="px-4 py-3 text-neutral-500">${a.dueno}</td>
                <td class="px-4 py-3"><span class="text-xs ${a.castrado ? 'text-green-600' : 'text-amber-600'}">${a.castrado ? 'Castrado' : 'Pendiente'}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

window.marcarAsistio = async function(turnoId) {
    if(!confirm("¿Marcar como asistido? El animal pasará a estado castrado.")) return;
    try {
        await fetch(API_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turnoId })
        });
        loadTurnos();
    } catch (error) { alert('Error actualizando turno'); }
}