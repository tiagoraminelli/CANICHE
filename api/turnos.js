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
    // --- GET: Listados y Busquedas ---
    if (req.method === 'GET') {
      const { tipo, pagina = 1, busqueda = '', mes = '' } = req.query;

      // 1. ENDPOINT PARA EL DIRECTORIO (Personas y Animales)
      if (tipo === 'directorio') {
        const limit = 20;
        const offset = (parseInt(pagina) - 1) * limit;

        let sqlP = "SELECT * FROM personas";
        let argsP = [];
        if (busqueda) {
            sqlP += " WHERE (nombre LIKE ? OR apellido LIKE ?)";
            argsP = [`%${busqueda}%`, `%${busqueda}%`];
        }
        sqlP += " ORDER BY apellido ASC LIMIT ? OFFSET ?";
        argsP.push(limit, offset);
        const personas = await db.execute({ sql: sqlP, args: argsP });

        let sqlA = `
          SELECT a.*, p.nombre || ' ' || p.apellido AS dueno 
          FROM animales a JOIN personas p ON p.id = a.persona_id
        `;
        let argsA = [];
        if (busqueda) {
            sqlA += " WHERE (a.nombre LIKE ? OR p.nombre LIKE ? OR p.apellido LIKE ?)";
            argsA = [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`];
        }
        sqlA += " ORDER BY a.creado_en DESC LIMIT ? OFFSET ?";
        argsA.push(limit, offset);
        const animales = await db.execute({ sql: sqlA, args: argsA });

        return res.status(200).json({ personas: personas.rows, animales: animales.rows });
      }

      // 2. ENDPOINT PARA LISTAR TODAS LAS PERSONAS (Para el buscador del modal)
      if (tipo === 'personas_todas') {
        const personas = await db.execute("SELECT * FROM personas ORDER BY apellido ASC");
        return res.status(200).json({ personas: personas.rows });
      }

      // 3. ENDPOINT PAGINADO DE TURNOS
      const limit = 10;
      const offset = (parseInt(pagina) - 1) * limit;

      let baseSql = `
        FROM turnos t
        JOIN animales a ON a.id = t.animal_id
        JOIN personas p ON p.id = a.persona_id
      `;
      let args = [];
      let conditions = [];

      if (mes) {
        conditions.push("strftime('%Y-%m', t.fecha_hora) = ?");
        args.push(mes);
      }

      if (busqueda) {
        conditions.push("(p.nombre LIKE ? OR p.apellido LIKE ? OR a.nombre LIKE ?)");
        const like = `%${busqueda}%`;
        args.push(like, like, like);
      }

      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

      const countSql = `SELECT COUNT(*) as total ${baseSql} ${whereClause}`;
      const countResult = await db.execute({ sql: countSql, args });
      const total = countResult.rows[0].total;
      const totalPages = Math.ceil(total / limit);

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
      await db.execute({ sql: "DELETE FROM turnos WHERE id = ?", args: [turnoId] });
      return res.status(200).json({ mensaje: "Turno eliminado" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("Error en la BD:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}