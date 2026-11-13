import { createClient } from "@libsql/client";

// Vercel va a inyectar esta variable de entorno de forma segura
const db = createClient({
  url: "libsql://castraciones-tiagarominelli.aws-sa-east-1.turso.io",
  authToken: process.env.TURSO_TOKEN, 
});

export default async function handler(req, res) {
  // Manejo de CORS para que tu frontend pueda consultar la API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET: Obtener todos los turnos
    if (req.method === 'GET') {
      const result = await db.execute(`
        SELECT t.id, p.nombre || ' ' || p.apellido AS dueno, 
               a.nombre AS animal, a.especie, t.fecha_hora, t.estado
        FROM turnos t
        JOIN animales a ON a.id = t.animal_id
        JOIN personas p ON p.id = a.persona_id
        ORDER BY t.fecha_hora ASC
      `);
      return res.status(200).json({ turnos: result.rows });
    }

    // POST: Crear un nuevo turno
    if (req.method === 'POST') {
      const { nombre, apellido, telefono, animal, especie, sexo } = req.body;
      
      const personaId = crypto.randomUUID();
      const animalId = crypto.randomUUID();
      const turnoId = crypto.randomUUID();
      
      // Fecha de mañana a las 10:00
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(10, 0, 0, 0);
      const fechaHora = manana.toISOString().replace('T', ' ').substring(0, 19);

      // Ejecutamos las 3 inserciones en bloque
      await db.batch([
        { sql: "INSERT INTO personas (id, nombre, apellido, telefono) VALUES (?, ?, ?, ?)", args: [personaId, nombre, apellido, telefono] },
        { sql: "INSERT INTO animales (id, persona_id, nombre, especie, sexo) VALUES (?, ?, ?, ?, ?)", args: [animalId, personaId, animal, especie, sexo] },
        { sql: "INSERT INTO turnos (id, animal_id, fecha_hora) VALUES (?, ?, ?)", args: [turnoId, animalId, fechaHora] }
      ], "write");

      return res.status(201).json({ mensaje: "Turno creado con éxito" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("Error en la BD:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}