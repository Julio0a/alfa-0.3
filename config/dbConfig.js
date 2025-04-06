// Configuración de la conexión a SQL Server
const sql = require("mssql")

const config = {
  user: "julio", // Cambia esto por tu usuario
  password: "Pasti2016", // Cambia esto por tu contraseña
  server: "localhost", // Cambia esto por tu servidor
  database: "HotelZafiiro504",
  options: {
    encrypt: true, // Para conexiones Azure
    trustServerCertificate: true, // Cambiar a false en producción
  },
}

// Crear un pool global para reutilizarlo
let poolConnection = null

// Función para conectar a la base de datos
async function conectar() {
  try {
    if (!poolConnection) {
      poolConnection = await sql.connect(config)
      console.log("Conexión exitosa a SQL Server")
    }
    return poolConnection
  } catch (error) {
    console.error("Error al conectar a SQL Server:", error)
    throw error
  }
}

// Función para ejecutar consultas
async function ejecutarQuery(query, params = []) {
  try {
    const pool = await conectar()
    const request = new sql.Request(pool)

    // Agregar parámetros si existen
    if (params && params.length > 0) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param.valor)
      })
    }

    const result = await request.query(query)
    return result
  } catch (error) {
    console.error("Error al ejecutar consulta:", error)
    throw error
  }
}

module.exports = {
  conectar,
  ejecutarQuery,
  sql,
}

