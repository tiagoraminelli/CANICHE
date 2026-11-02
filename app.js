const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwvCTquZtLVsGhyrx6etsrtfgTjoHjCyntTxZEH5-2x42GjdEKAVczeyU3o0nvjMzpO/exec";

document.addEventListener('DOMContentLoaded', () => {
    let registrosGlobales = []; 
    let registrosFiltrados = [];
    let paginaActual = 1;
    const itemsPorPagina = 15;
    let registroAEditar = null;

    const mostrarAlerta = (mensaje, tipo = 'error') => {
        const color = tipo === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800';
        const div = document.createElement('div');
        div.className = `fixed top-4 right-4 ${color} px-4 py-3 rounded shadow-lg z-50 text-sm font-medium transition-opacity`;
        div.innerHTML = mensaje;
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 4000);
    };

    window.cambiarVista = (vista, e) => {
        document.querySelectorAll('.vista').forEach(v => { v.classList.add('hidden'); v.classList.remove('block'); });
        document.querySelectorAll('.nav-links li').forEach(l => {
            l.classList.remove('active');
            const btn = l.querySelector('button');
            if(btn) { btn.classList.remove('bg-gray-50', 'text-brand'); btn.classList.add('text-gray-500', 'hover:bg-gray-50'); }
        });
        
        document.getElementById(`vista-${vista}`).classList.remove('hidden');
        document.getElementById(`vista-${vista}`).classList.add('block');
        
        if (e && e.currentTarget) {
            e.currentTarget.classList.add('active');
            const btn = e.currentTarget.querySelector('button');
            if(btn) { btn.classList.remove('text-gray-500', 'hover:bg-gray-50'); btn.classList.add('bg-gray-50', 'text-brand'); }
        }
        const titulos = { listado: 'Listado General', formulario: 'Carga de Datos' };
        document.getElementById('titulo-vista').innerText = titulos[vista];

        if(vista === 'formulario' && !registroAEditar) {
            document.getElementById('formCastracion').reset();
            document.getElementById('edit-row').value = "";
            document.getElementById('btn-guardar').innerText = "Guardar Registro";
            document.getElementById('menu-form-texto').innerText = "Nueva Carga";
            limpiarCanvas();
        }
    };

    const obtenerValor = (fila, posiblesNombres) => {
        for (const key of Object.keys(fila)) {
            const keyLimpia = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            for (const nombre of posiblesNombres) {
                if (keyLimpia === nombre) return fila[key];
            }
        }
        return null;
    };

    const limpiarTelefono = (tel) => {
        let num = String(tel).replace(/\D/g, ''); 
        if (num && !num.startsWith('54')) { num = '54' + num; }
        return num;
    };

    const cargarDatos = async () => {
        const btn = document.getElementById('btnActualizar');
        const iconoOriginal = btn.innerHTML;
        btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        try {
            const respuesta = await fetch(URL_GOOGLE_SCRIPT);
            const data = await respuesta.json();
            
            registrosGlobales = (Array.isArray(data) ? data : []).filter(r => {
                const nombre = obtenerValor(r, ['nombre']) || '';
                const direccion = obtenerValor(r, ['direccion']) || '';
                // Si por alguna razón el nombre quedó vacío pero hay dirección, lo mostramos
                return String(nombre).trim() !== '' || String(direccion).trim() !== '';
            });

            aplicarFiltros();
        } catch (error) {
            console.error(error);
            mostrarAlerta("❌ Error al cargar datos.", 'error');
        } finally {
            btn.innerHTML = iconoOriginal;
        }
    };

    document.getElementById('btnActualizar').addEventListener('click', cargarDatos);

    const aplicarFiltros = () => {
        const textoBusqueda = String(document.getElementById('buscador').value).toLowerCase().trim();
        const filtroEstado = document.getElementById('filtro-estado').value;

        registrosFiltrados = registrosGlobales.filter(r => {
            const nombre = String(obtenerValor(r, ['nombre']) || '').toLowerCase();
            const dir = String(obtenerValor(r, ['direccion']) || '').toLowerCase();
            const estado = String(obtenerValor(r, ['confirmo']) || '').toLowerCase();

            const coincideBusqueda = nombre.includes(textoBusqueda) || dir.includes(textoBusqueda);
            
            let coincideEstado = true;
            if (filtroEstado === 'si') coincideEstado = estado.includes('si') && !estado.includes('no');
            if (filtroEstado === 'no') coincideEstado = estado.includes('no');
            if (filtroEstado === 'pendiente') coincideEstado = estado === '' || estado.includes('pendiente');

            return coincideBusqueda && coincideEstado;
        });

        paginaActual = 1;
        renderizarTabla();
    };

    document.getElementById('buscador').addEventListener('input', aplicarFiltros);
    document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);

    const renderizarTabla = () => {
        const tbody = document.getElementById('tabla-registros');
        tbody.innerHTML = '';

        const inicio = (paginaActual - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        const registrosPagina = registrosFiltrados.slice(inicio, fin);

        if (registrosPagina.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400 text-sm">No se encontraron registros.</td></tr>`;
            document.getElementById('info-paginacion').innerText = `Mostrando 0 de 0 registros`;
            document.getElementById('btn-prev').disabled = true;
            document.getElementById('btn-next').disabled = true;
            return;
        }

        registrosPagina.forEach(r => {
            // Autocompletado visual si hay vacíos
            const nombre = obtenerValor(r, ['nombre']) || 'Falta completar';
            const dir = obtenerValor(r, ['direccion']) || 'Sin asignar';
            const telRaw = obtenerValor(r, ['telefono']) || '-';
            
            const can = parseInt(obtenerValor(r, ['caninos'])) || 0;
            const fel = parseInt(obtenerValor(r, ['felinos'])) || 0;
            const otr = parseInt(obtenerValor(r, ['otros'])) || 0;
            const h = parseInt(obtenerValor(r, ['hembras'])) || 0;
            const m = parseInt(obtenerValor(r, ['machos'])) || 0;
            
            const estadoRaw = String(obtenerValor(r, ['confirmo']) || '').trim();
            const obs = obtenerValor(r, ['observaciones']) || '-';

            const mensajeWA = encodeURIComponent(`Hola ${nombre}, te escribimos de la campaña de castraciones. Queríamos confirmar el turno para el operativo de noviembre. ¿Nos podés confirmar? ¡Muchas gracias!`);
            const numLimpio = limpiarTelefono(telRaw);
            const linkWA = (numLimpio && numLimpio !== '54') ? `https://wa.me/${numLimpio}?text=${mensajeWA}` : null;

            let estadoBadge = `<span class="text-gray-400">Pendiente</span>`;
            const estadoLower = estadoRaw.toLowerCase();
            if (estadoLower.includes('si') && !estadoLower.includes('no')) {
                estadoBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">Confirmado</span>`;
            } else if (estadoLower.includes('no')) {
                estadoBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-rose-50 text-rose-700">Rechazado</span>`;
            }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors group";
            tr.innerHTML = `
                <td class="py-3 px-4">
                    <div class="font-medium text-brand text-sm">${nombre}</div>
                    <div class="text-xs text-gray-500">${dir}</div>
                </td>
                <td class="py-3 px-4 text-sm">
                    ${linkWA ? `
                        <a href="${linkWA}" target="_blank" class="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 hover:underline transition-colors" title="Enviar WhatsApp">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            ${telRaw}
                        </a>
                    ` : `<span class="text-gray-400">${telRaw}</span>`}
                </td>
                <td class="py-3 px-4 text-center text-sm font-medium">
                    <span class="${can > 0 ? 'text-amber-600' : 'text-gray-300'}">${can}</span>
                    <span class="text-gray-300 mx-1">/</span>
                    <span class="${fel > 0 ? 'text-indigo-600' : 'text-gray-300'}">${fel}</span>
                    <span class="text-gray-300 mx-1">/</span>
                    <span class="${otr > 0 ? 'text-gray-600' : 'text-gray-300'}">${otr}</span>
                </td>
                <td class="py-3 px-4 text-center text-sm font-medium">
                    <span class="${h > 0 ? 'text-rose-500' : 'text-gray-300'}">${h}</span>
                    <span class="text-gray-300 mx-1">/</span>
                    <span class="${m > 0 ? 'text-blue-500' : 'text-gray-300'}">${m}</span>
                </td>
                <td class="py-3 px-4">${estadoBadge}</td>
                <td class="py-3 px-4 text-right">
                    <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick='prepararEdicion(${JSON.stringify(r).replace(/'/g, "&#39;")})' class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="eliminarRegistro(${r['_rowNumber']}, '${nombre}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Eliminar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('info-paginacion').innerText = `Mostrando ${inicio + 1} - ${Math.min(fin, registrosFiltrados.length)} de ${registrosFiltrados.length} registros`;
        document.getElementById('btn-prev').disabled = paginaActual === 1;
        document.getElementById('btn-next').disabled = fin >= registrosFiltrados.length;
    };

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (paginaActual > 1) { paginaActual--; renderizarTabla(); }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        if (paginaActual * itemsPorPagina < registrosFiltrados.length) { paginaActual++; renderizarTabla(); }
    });

    // --- FUNCIONES DE ACCIÓN ---
    window.prepararEdicion = (registro) => {
        registroAEditar = registro;
        document.getElementById('edit-row').value = registro['_rowNumber'];
        document.getElementById('manzana').value = obtenerValor(registro, ['manzana']) === 'Sin asignar' ? '' : (obtenerValor(registro, ['manzana']) || '');
        document.getElementById('direccion').value = obtenerValor(registro, ['direccion']) === 'Falta completar' ? '' : (obtenerValor(registro, ['direccion']) || '');
        document.getElementById('nombre').value = obtenerValor(registro, ['nombre']) === 'Sin nombre' ? '' : (obtenerValor(registro, ['nombre']) || '');
        document.getElementById('telefono').value = obtenerValor(registro, ['telefono']) === 'Sin teléfono' ? '' : (obtenerValor(registro, ['telefono']) || '');
        document.getElementById('caninos').value = obtenerValor(registro, ['caninos']) || 0;
        document.getElementById('felinos').value = obtenerValor(registro, ['felinos']) || 0;
        document.getElementById('otros').value = obtenerValor(registro, ['otros']) || 0;
        document.getElementById('hembras').value = obtenerValor(registro, ['hembras']) || 0;
        document.getElementById('machos').value = obtenerValor(registro, ['machos']) || 0;
        document.getElementById('observaciones').value = obtenerValor(registro, ['observaciones']) || '';
        document.getElementById('turno').value = obtenerValor(registro, ['turno']) || '';
        document.getElementById('confirmo').value = obtenerValor(registro, ['confirmo']) || 'Pendiente';
        
        document.getElementById('btn-guardar').innerText = "Actualizar Registro";
        document.getElementById('menu-form-texto').innerText = "Editar Registro";
        
        window.cambiarVista('formulario', {currentTarget: document.querySelector('.nav-links li:nth-child(2)')});
    };

    window.eliminarRegistro = async (rowNumber, nombre) => {
        if (!confirm(`¿Estás seguro que querés eliminar el registro de ${nombre}?`)) return;
        
        try {
            const res = await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST',
                body: JSON.stringify({ action: 'delete', _rowNumber: rowNumber })
            });
            const json = await res.json();
            if(json.status === 'success') {
                mostrarAlerta('🗑️ Registro eliminado', 'ok');
                cargarDatos();
            } else {
                mostrarAlerta('❌ Error al eliminar: ' + json.message, 'error');
            }
        } catch (err) { mostrarAlerta('❌ Error de red', 'error'); }
    };

    // --- LÓGICA DEL FORMULARIO (Firma y envío) ---
    const canvas = document.getElementById('firmaCanvas');
    const ctx = canvas.getContext('2d');
    let dibujando = false;
    
    const limpiarCanvas = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

    setTimeout(() => {
        canvas.width = canvas.offsetWidth; 
        canvas.height = canvas.offsetHeight;
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    }, 100);

    const iniciarDibujo = (e) => { dibujando = true; dibujar(e); };
    const terminarDibujo = () => { dibujando = false; ctx.beginPath(); };
    const dibujar = (e) => {
        if (!dibujando) return; e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
    };
    canvas.addEventListener('mousedown', iniciarDibujo); canvas.addEventListener('mousemove', dibujar); canvas.addEventListener('mouseup', terminarDibujo); canvas.addEventListener('mouseout', terminarDibujo);
    canvas.addEventListener('touchstart', iniciarDibujo); canvas.addEventListener('touchmove', dibujar); canvas.addEventListener('touchend', terminarDibujo);
    document.getElementById('limpiarFirma').addEventListener('click', limpiarCanvas);

    document.getElementById('telefono').addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });

    document.getElementById('formCastracion').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const can = parseInt(document.getElementById('caninos').value) || 0;
        const fel = parseInt(document.getElementById('felinos').value) || 0;
        const otr = parseInt(document.getElementById('otros').value) || 0;
        const h = parseInt(document.getElementById('hembras').value) || 0;
        const m = parseInt(document.getElementById('machos').value) || 0;
        
        if (can === 0 && fel === 0 && otr === 0 && h === 0 && m === 0) return alert("Debés cargar al menos 1 animal.");

        const btn = e.target.querySelector('button[type="submit"]');
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = `Guardando...`;
        btn.disabled = true;

        const rowNumber = document.getElementById('edit-row').value;
        const action = rowNumber ? 'update' : 'create';

        // AUTOCOMPLETADO DE CAMPOS VACÍOS ANTES DE ENVIAR
        const data = {
            action: action,
            _rowNumber: rowNumber,
            manzana: document.getElementById('manzana').value.trim() || "Sin asignar",
            direccion: document.getElementById('direccion').value.trim() || "Falta completar",
            nombre: document.getElementById('nombre').value.trim() || "Sin nombre",
            telefono: document.getElementById('telefono').value.trim() || "Sin teléfono",
            caninos: can, felinos: fel, otros: otr,
            hembras: h, machos: m,
            observaciones: document.getElementById('observaciones').value.trim() || "-",
            confirmo: document.getElementById('confirmo').value,
            turno: document.getElementById('turno').value.trim() || "-",
            firma: canvas.toDataURL()
        };

        try {
            const res = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify(data) });
            const json = await res.json();
            if (json.status === 'success') {
                mostrarAlerta(`✅ ${action === 'update' ? 'Actualizado' : 'Guardado'} exitosamente!`, 'ok');
                registroAEditar = null;
                document.getElementById('formCastracion').reset(); 
                limpiarCanvas();
                cargarDatos(); 
                window.cambiarVista('listado', {currentTarget: document.querySelector('.nav-links li:first-child')});
            } else { mostrarAlerta('❌ Error: ' + json.message, 'error'); }
        } catch (err) { console.error(err); mostrarAlerta('❌ Error de red.', 'error'); } 
        finally { btn.innerHTML = textoOriginal; btn.disabled = false; }
    });

    cargarDatos();
});