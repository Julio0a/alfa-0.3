// Archivo principal de la aplicación
const express = require("express")
const path = require("path")
const session = require("express-session")
const flash = require("connect-flash")
const app = express()
const port = process.env.PORT || 3000

// Configuración de la conexión a la base de datos
const dbConfig = require("./config/dbConfig")

// Configuración de vistas
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// Configuración de sesiones
app.use(
  session({
    secret: "hotelzafiro504secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }, // 1 hora
  }),
)

// Configuración de mensajes flash
app.use(flash())

// Middleware para variables globales
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null
  res.locals.mensajes = req.flash()
  next()
})

// Rutas
const authRoutes = require("./routes/authRoutes")
const adminRoutes = require("./routes/adminRoutes")
const clienteRoutes = require("./routes/clienteRoutes")
const recepcionRoutes = require("./routes/recepcionRoutes")
const rrhRoutes = require("./routes/rrhRoutes")

app.use("/", authRoutes)
app.use("/admin", adminRoutes)
app.use("/cliente", clienteRoutes)
app.use("/recepcion", recepcionRoutes)
app.use("/rrh", rrhRoutes)

// Ruta principal
app.get("/", (req, res) => {
  res.render("index", {
    titulo: "Hotel Zafiro 504 - Bienvenido",
    usuario: req.session.usuario,
  })
})

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).render("error", {
    titulo: "Página no encontrada",
    mensaje: "La página que buscas no existe",
  })
})

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`)
})

