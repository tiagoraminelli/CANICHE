import { createClient } from "@libsql/client/web";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const db = createClient({
    url: "libsql://castraciones-tiagoraminelli.aws-sa-east-1.turso.io",
    authToken: process.env.TURSO_TOKEN,
  });

  try {
    // --- GET: Listado Paginado y Filtrado ---
    if (req.method === 'GET') {
      const { pagina = 1, busqueda = '', mes = '' } = req.query;
      const limit = 10; // Turnos por página
      const offset = (parseInt(pagina) - 1) * limit;

      let baseSql = `
        FROM turnos t
        JOIN animales a ON a.id = t.animal_id
        JOIN personas p ON p.id = a.persona_id
      `;
      let args = [];
      let conditions = [];

      // Filtro por mes (ej: "2026-11")
      if (mes) {
        conditions.push("strftime('%Y-%m', t.fecha_hora) = ?");
        args.push(mes);
      }

      // Filtro de búsqueda (nombre dueño o animal)
      if (busqueda) {
        conditions.push("(p.nombre LIKE ? OR p.apellido LIKE ? OR a.nombre LIKE ?)");
        const like = `%${busqueda}%`;
        args.push(like, like, like);
      }

      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

      // 1. Contar total para la paginación
      const countSql = `SELECT COUNT(*) as total ${baseSql} ${whereClause}`;
      const countResult = await db.execute({ sql: countSql, args });
      const total = countResult.rows[0].total;
      const totalPages = Math.ceil(total / limit);

      // 2. Traer los datos de esta página
      const dataSql = `
        SELECT t.id, t.fecha_hora, t.estado, t.observaciones, a.nombre AS animal, a.especie, a.sexo, p.nombre || ' ' || p.apellido AS dueno, p.telefono, p.direccion
        ${baseSql} ${whereClause}
        ORDER BY t.fecha_hora DESC
        LIMIT ? OFFSET ?
      `;
      const dataResult = await db.execute({ sql: dataSql, args: [...args, limit, offset] });

      return res.status(200).json({ 
        turnos: dataResult.rows, 
        total, 
        totalPages, 
        currentPage: parseInt(pagina) 
      });
    }

    // --- POST: Crear Ingreso ---
    if (req.method === 'POST') {
      const { nombre, apellido, telefono, direccion, animal, especie, sexo, fecha, hora, personaExistenteId, observaciones } = req.body;
      
      let personaId = personaExistenteId;
      let animalId = crypto.randomUUID();
      let turnoId = crypto.randomUUID();
      const fechaHora = `${fecha} ${hora}:00`;
      const queries = [];

      if (!personaId) {
        personaId = crypto.randomUUID();
        queries.push({ sql: "INSERT INTO personas (id, nombre, apellido, telefono, direccion) VALUES (?, ?, ?, ?, ?)", args: [personaId, nombre, apellido, telefono, direccion] });
      }
      queries.push({ sql: "INSERT INTO animales (id, persona_id, nombre, especie, sexo) VALUES (?, ?, ?, ?, ?)", args: [animalId, personaId, animal, especie, sexo] });
      queries.push({ sql: "INSERT INTO turnos (id, animal_id, fecha_hora, estado, observaciones) VALUES (?, ?, ?, 'pendiente', ?)", args: [turnoId, animalId, fechaHora, observaciones || ''] });

      await db.batch(queries, "write");
      return res.status(201).json({ mensaje: "Ingreso registrado" });
    }

    // --- PUT: Editar Turno ---
    if (req.method === 'PUT') {
      const { turnoId, fecha, hora, estado, observaciones } = req.body;
      const fechaHora = `${fecha} ${hora}:00`;

      if (estado === 'asistio') {
        await db.batch([
          { sql: "UPDATE turnos SET fecha_hora = ?, estado = ?, observaciones = ? WHERE id = ?", args: [fechaHora, estado, observaciones, turnoId] },
          { sql: "UPDATE animales SET castrado = 1 WHERE id = (SELECT animal_id FROM turnos WHERE id = ?)", args: [turnoId] }
        ], "write");
      } else {
        await db.execute({ 
          sql: "UPDATE turnos SET fecha_hora = ?, estado = ?, observaciones = ? WHERE id = ?", 
          args: [fechaHora, estado, observaciones, turnoId] 
        });
      }
      return res.status(200).json({ mensaje: "Turno actualizado" });
    }

    // --- DELETE: Eliminar Turno ---
    if (req.method === 'DELETE') {
      const { turnoId } = req.body;
      // Solo eliminamos el turno (el animal y persona quedan en el directorio)
      await db.execute({ sql: "DELETE FROM turnos WHERE id = ?", args: [turnoId] });
      return res.status(200).json({ mensaje: "Turno eliminado" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("Error en la BD:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}