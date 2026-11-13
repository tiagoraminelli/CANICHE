const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_URL = isLocal 
    ? "https://castraciones-tiagoraminelli.aws-sa-east-1.vercel.app/api/turnos" 
    : "/api/turnos";

let paginaActual = 1;
let timeoutBusqueda;
let personasCacheadas = [];

// ==========================================
// HELPER PARA WHATSAPP
// ==========================================
function generarEnlaceWhatsApp(telefono, nombre) {
    if (!telefono) return null;
    
    // Limpiamos el número de espacios, guiones, paréntesis y el "+"
    let numeroLimpio = telefono.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // Normalización Argentina: Si empieza con 0 (ej. 0340...), se lo quitamos
    if (numeroLimpio.startsWith('0')) {
        numeroLimpio = numeroLimpio.substring(1);
    }
    
    // Si no tiene el prefijo de Argentina (54), se lo agregamos
    if (!numeroLimpio.startsWith('54')) {
        numeroLimpio = '54' + numeroLimpio;
    }
    
    // Mensaje predefinido
    const mensaje = `Hola ${nombre}, ¿cómo estás? Te contactamos desde Guardia Vet para comunicarnos con vos. ¡Saludos!`;
    
    // Codificamos el mensaje
    const mensajeCodificado = encodeURIComponent(mensaje);
    
    return `https://wa.me/${numeroLimpio}?text=${mensajeCodificado}`;
}


document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date();
    document.getElementById('i-fecha').valueAsDate = hoy;
    document.getElementById('filtro-mes').value = hoy.toISOString().slice(0, 7);
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
        document.getElementById('status-db').classList.replace('text-neutral-400', 'text-red-600');
    }
}

// --- NAVEGACIÓN TABS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('bg-neutral-100', 'text-neutral-900');
            el.classList.add('text-neutral-500', 'hover:bg-neutral-50');
        });
        e.target.classList.remove('text-neutral-500', 'hover:bg-neutral-50');
        e.target.classList.add('bg-neutral-100', 'text-neutral-900');

        if (tabId === 'directorio') loadDirectorio();
        if (tabId === 'listado') loadTurnos();
    });
});

// --- MODALES ---
window.abrirModalIngreso = () => {
    const form = document.getElementById('form-ingreso');
    form.reset();
    document.getElementById('i-fecha').valueAsDate = new Date();
    limpiarPersonaSeleccionada(); 
    document.getElementById('modal-ingreso').classList.replace('hidden', 'flex');
};

window.cerrarModal = (id) => { document.getElementById(id).classList.replace('flex', 'hidden'); };

// --- FILTROS Y PAGINACIÓN (TURNOS) ---
document.getElementById('filtro-mes').addEventListener('change', () => { paginaActual = 1; loadTurnos(); });
document.getElementById('filtro-busqueda').addEventListener('input', () => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => { paginaActual = 1; loadTurnos(); }, 400);
});
window.cambiarPagina = (delta) => { paginaActual += delta; loadTurnos(); };

async function loadTurnos() {
    const tbody = document.getElementById('tabla-turnos');
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-neutral-400">Cargando...</td></tr>';

    const mes = document.getElementById('filtro-mes').value;
    const busqueda = document.getElementById('filtro-busqueda').value;

    try {
        const res = await fetch(`${API_URL}?pagina=${paginaActual}&mes=${mes}&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        
        document.getElementById('info-paginacion').textContent = `Página ${data.currentPage} de ${data.totalPages || 1} (${data.total} turnos)`;
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

            // Integramos WhatsApp acá también
            const waLink = generarEnlaceWhatsApp(t.telefono, t.dueno.split(' ')[0]); // Solo el primer nombre

            return `
            <tr class="hover:bg-neutral-50">
                <td class="px-4 py-3 text-neutral-900 whitespace-nowrap">${t.fecha_hora}</td>
                <td class="px-4 py-3 text-neutral-600">${t.animal} <span class="text-xs text-neutral-400">(${t.especie})</span></td>
                <td class="px-4 py-3 text-neutral-600">${t.dueno} <br><span class="text-xs text-neutral-400">${t.telefono || ''}</span></td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs font-medium ${badgeClass}">${t.estado.toUpperCase()}</span></td>
                <td class="px-4 py-3 text-right space-x-2">
                    <button onclick='verDetalles(${JSON.stringify(t)})' class="text-xs font-medium text-neutral-600 hover:text-black underline">Ver</button>
                    <button onclick='abrirEditar(${JSON.stringify(t)})' class="text-xs font-medium text-blue-600 hover:text-blue-800 underline">Editar</button>
                    ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-green-600 hover:text-green-800 underline">WhatsApp</a>` : ''}
                    <button onclick="eliminarTurno('${t.id}')" class="text-xs font-medium text-red-600 hover:text-red-800 underline">Eliminar</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">Error de conexión.</td></tr>';
    }
}

// --- ACCIONES (VER, EDITAR, ELIMINAR) ---
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
    if (!confirm("¿Eliminar este turno?")) return;
    try {
        const res = await fetch(API_URL, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turnoId: id })
        });
        if (res.ok) loadTurnos();
    } catch (e) { alert("Error al eliminar"); }
};

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

// --- CREAR TURNO (FORMULARIO) ---
document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.textContent = "Guardando...";
    btn.disabled = true;
    
    const payload = {
        personaExistenteId: document.getElementById('buscador-persona-id').value || null,
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

    try {
        const res = await fetch(API_URL, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payload) 
        });

        if (res.ok) {
            cerrarModal('modal-ingreso');
            loadTurnos();
        } else {
            alert("Error del servidor");
        }
    } catch (error) {
        alert("Error de red: " + error.message);
    } finally {
        btn.textContent = "Confirmar e Ingresar";
        btn.disabled = false;
    }
});

// --- BUSCADOR DE PERSONAS EN EL MODAL ---
async function cargarPersonasEnBuscador() {
    try {
        const res = await fetch(`${API_URL}?tipo=personas_todas`);
        const data = await res.json();
        personasCacheadas = data.personas || [];
        
        const datalist = document.getElementById('lista-personas');
        datalist.innerHTML = personasCacheadas.map(p => 
            `<option value="${p.apellido}, ${p.nombre} (${p.telefono || 'Sin tel'})" data-id="${p.id}"></option>`
        ).join('');
    } catch (e) { console.error("Error cargando personas", e); }
}

document.getElementById('buscador-persona-texto').addEventListener('input', (e) => {
    const valor = e.target.value;
    const personaEncontrada = personasCacheadas.find(p => 
        `${p.apellido}, ${p.nombre} (${p.telefono || 'Sin tel'})` === valor
    );

    if (personaEncontrada) {
        document.getElementById('buscador-persona-id').value = personaEncontrada.id;
        document.getElementById('persona-seleccionada').classList.remove('hidden');
        document.getElementById('texto-persona-seleccionada').textContent = `Seleccionado: ${personaEncontrada.apellido}, ${personaEncontrada.nombre}`;
        
        const seccion = document.getElementById('seccion-persona');
        seccion.classList.add('opacity-50', 'pointer-events-none');
        seccion.querySelectorAll('input').forEach(i => i.required = false);
    } else {
        limpiarPersonaSeleccionada(false);
    }
});

window.limpiarPersonaSeleccionada = (borrarTexto = true) => {
    document.getElementById('buscador-persona-id').value = "";
    document.getElementById('persona-seleccionada').classList.add('hidden');
    if (borrarTexto) document.getElementById('buscador-persona-texto').value = "";
    
    const seccion = document.getElementById('seccion-persona');
    seccion.classList.remove('opacity-50', 'pointer-events-none');
    seccion.querySelectorAll('input').forEach(i => i.required = true);
};

// --- DIRECTORIO CON BÚSQUEDA Y WHATSAPP ---
let timeoutDirectorio;

document.getElementById('filtro-directorio').addEventListener('input', (e) => {
    clearTimeout(timeoutDirectorio);
    timeoutDirectorio = setTimeout(() => {
        loadDirectorio(e.target.value);
    }, 400);
});

async function loadDirectorio(busqueda = "") {
    const tbodyPersonas = document.getElementById('tabla-personas');
    const tbodyAnimales = document.getElementById('tabla-animales');
    
    tbodyPersonas.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-neutral-400">Buscando...</td></tr>';
    tbodyAnimales.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-neutral-400">Buscando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}?tipo=directorio&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        
        if (data.personas.length === 0) {
            tbodyPersonas.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-neutral-400">No se encontraron personas.</td></tr>';
        } else {
            tbodyPersonas.innerHTML = data.personas.map(p => {
                // Generamos el link de WhatsApp
                const waLink = generarEnlaceWhatsApp(p.telefono, p.nombre);
                
                return `
                <tr class="hover:bg-neutral-50">
                    <td class="px-4 py-3 text-neutral-900">${p.apellido}, ${p.nombre}</td>
                    <td class="px-4 py-3 text-neutral-500">${p.telefono || '-'}</td>
                    <td class="px-4 py-3 text-right">
                        ${waLink ? `
                            <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-green-600 hover:text-green-800 underline" title="Enviar WhatsApp">
                                WhatsApp
                            </a>
                        ` : '<span class="text-xs text-neutral-300">Sin tel.</span>'}
                    </td>
                </tr>
                `;
            }).join('');
        }
        
        if (data.animales.length === 0) {
            tbodyAnimales.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-neutral-400">No se encontraron animales.</td></tr>';
        } else {
            tbodyAnimales.innerHTML = data.animales.map(a => `
                <tr class="hover:bg-neutral-50">
                    <td class="px-4 py-3 text-neutral-900">${a.nombre || 'S/N'} <span class="text-xs text-neutral-400">(${a.especie})</span></td>
                    <td class="px-4 py-3 text-neutral-500">${a.dueno}</td>
                    <td class="px-4 py-3"><span class="text-xs ${a.castrado ? 'text-green-600' : 'text-amber-600'}">${a.castrado ? 'Castrado' : 'Pendiente'}</span></td>
                </tr>
            `).join('');
        }
    } catch (e) { 
        console.error("Error cargando directorio", e); 
        tbodyPersonas.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-red-500">Error de conexión</td></tr>';
        tbodyAnimales.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-red-500">Error de conexión</td></tr>';
    }
}