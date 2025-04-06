// Rutas de recepcionista
const express = require("express")
const router = express.Router()
const recepcionController = require("../controllers/recepcionController")
const { estaAutenticado, esRecepcionista } = require("../middlewares/authMiddleware")

// Aplicar middleware a todas las rutas
router.use(estaAutenticado)
router.use(esRecepcionista)

// Dashboard
router.get("/dashboard", recepcionController.dashboard)

// Reservas
router.get("/reservas", recepcionController.listarReservas)
router.get("/reservas/:id", recepcionController.verReserva)
router.post("/reservas/:id/estado", recepcionController.cambiarEstadoReserva)
router.post("/reservas/:id/servicio", recepcionController.agregarServicio)
router.post("/reservas/:id/factura", recepcionController.generarFactura)

// Clientes
router.get("/clientes", recepcionController.listarClientes)
router.get("/clientes/:id", recepcionController.verCliente)

// Habitaciones
router.get("/habitaciones", recepcionController.listarHabitaciones)
router.post("/habitaciones/:id/estado", recepcionController.cambiarEstadoHabitacion)

module.exports = router

