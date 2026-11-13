import { createClient } from "@libsql/client/web";

export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!process.env.TURSO_TOKEN) {
    return res.status(500).json({ error: "Falta configurar TURSO_TOKEN en Vercel" });
  }

  const db = createClient({
    url: "libsql://castraciones-tiagarominelli.aws-sa-east-1.turso.io",
    authToken: process.env.TURSO_TOKEN,
  });

  try {
    if (req.method === 'GET') {
      const { tipo } = req.query;
      
      if (tipo === 'directorio') {
        const personas = await db.execute("SELECT * FROM personas ORDER BY apellido ASC");
        const animales = await db.execute(`
          SELECT a.*, p.nombre || ' ' || p.apellido AS dueno 
          FROM animales a JOIN personas p ON p.id = a.persona_id 
          ORDER BY a.creado_en DESC
        `);
        return res.status(200).json({ personas: personas.rows, animales: animales.rows });
      } 
      
      const result = await db.execute(`
        SELECT t.id, t.fecha_hora, t.estado, a.nombre AS animal, p.nombre || ' ' || p.apellido AS dueno, p.telefono
        FROM turnos t
        JOIN animales a ON a.id = t.animal_id
        JOIN personas p ON p.id = a.persona_id
        ORDER BY t.fecha_hora DESC
      `);
      return res.status(200).json({ turnos: result.rows });
    }

    if (req.method === 'POST') {
      const { nombre, apellido, telefono, direccion, animal, especie, sexo, fecha, hora, personaExistenteId } = req.body;
      
      let personaId = personaExistenteId;
      let animalId = crypto.randomUUID();
      let turnoId = crypto.randomUUID();
      const fechaHora = `${fecha} ${hora}:00`;

      const queries = [];

      if (!personaId) {
        personaId = crypto.randomUUID();
        queries.push({ 
          sql: "INSERT INTO personas (id, nombre, apellido, telefono, direccion) VALUES (?, ?, ?, ?, ?)", 
          args: [personaId, nombre, apellido, telefono, direccion] 
        });
      }

      queries.push({ 
        sql: "INSERT INTO animales (id, persona_id, nombre, especie, sexo) VALUES (?, ?, ?, ?, ?)", 
        args: [animalId, personaId, animal, especie, sexo] 
      });
      queries.push({ 
        sql: "INSERT INTO turnos (id, animal_id, fecha_hora, estado) VALUES (?, ?, ?, 'pendiente')", 
        args: [turnoId, animalId, fechaHora] 
      });

      await db.batch(queries, "write");
      return res.status(201).json({ mensaje: "Ingreso registrado" });
    }

    if (req.method === 'PUT') {
      const { turnoId } = req.body;
      await db.batch([
        { sql: "UPDATE turnos SET estado = 'asistio' WHERE id = ?", args: [turnoId] },
        { sql: "UPDATE animales SET castrado = 1 WHERE id = (SELECT animal_id FROM turnos WHERE id = ?)", args: [turnoId] }
      ], "write");
      return res.status(200).json({ mensaje: "Asistencia confirmada" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("Error en la BD:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}