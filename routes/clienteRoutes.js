// Rutas de cliente
const express = require("express")
const router = express.Router()
const clienteController = require("../controllers/clienteController")
const { estaAutenticado, esCliente } = require("../middlewares/authMiddleware")

// Aplicar middleware a todas las rutas
router.use(estaAutenticado)
router.use(esCliente)

// Dashboard
router.get("/dashboard", clienteController.dashboard)

// Buscar habitaciones
router.get("/buscar-habitaciones", clienteController.buscarHabitaciones)

// Reservas
router.get("/crear-reserva", clienteController.mostrarFormularioReserva)
router.post("/crear-reserva", clienteController.crearReserva)
router.get("/mis-reservas", clienteController.listarReservas)
router.get("/mis-reservas/:id", clienteController.verReserva)
router.get("/mis-reservas/:id", clienteController.verReserva)
router.post("/mis-reservas/:id/cancelar", clienteController.cancelarReserva)

// Agregar rutas para seleccionar y quitar habitaciones
router.post("/seleccionar-habitacion", clienteController.seleccionarHabitacion)
router.post("/quitar-habitacion", clienteController.quitarHabitacionSeleccionada)

// Facturas
router.get("/facturas", clienteController.listarFacturas)
router.get("/facturas/:id", clienteController.verFactura)

// Agregar rutas para facturas y pagos
router.post("/mis-reservas/:id/generar-factura", clienteController.generarFactura)
router.get("/facturas/:id/pagar", clienteController.mostrarFormularioPago)
router.post("/facturas/:id/pagar", clienteController.procesarPago)

module.exports = router

