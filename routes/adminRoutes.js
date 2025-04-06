// Rutas de administrador
const express = require("express")
const router = express.Router()
const adminController = require("../controllers/adminController")
const { estaAutenticado, esAdmin } = require("../middlewares/authMiddleware")

// Aplicar middleware a todas las rutas
router.use(estaAutenticado)
router.use(esAdmin)

// Dashboard
router.get("/dashboard", adminController.dashboard)

// Habitaciones
router.get("/habitaciones", adminController.listarHabitaciones)
router.get("/habitaciones/nueva", adminController.mostrarFormularioHabitacion)
router.post("/habitaciones/nueva", adminController.crearHabitacion)
router.get("/habitaciones/editar/:id", adminController.mostrarFormularioEditarHabitacion)
router.post("/habitaciones/editar/:id", adminController.actualizarHabitacion)
// Agregar rutas para eliminar habitaciones, tipos de habitaciones y servicios
router.post("/habitaciones/eliminar/:id", adminController.eliminarHabitacion)

// Tipos de habitaciones
router.get("/tipos-habitaciones", adminController.listarTiposHabitaciones)
router.get("/tipos-habitaciones/nuevo", adminController.mostrarFormularioTipoHabitacion)
router.post("/tipos-habitaciones/nuevo", adminController.crearTipoHabitacion)
router.get("/tipos-habitaciones/editar/:id", adminController.mostrarFormularioEditarTipoHabitacion)
router.post("/tipos-habitaciones/editar/:id", adminController.actualizarTipoHabitacion)
// Agregar rutas para eliminar habitaciones, tipos de habitaciones y servicios
router.post("/tipos-habitaciones/eliminar/:id", adminController.eliminarTipoHabitacion)

// Servicios adicionales
router.get("/servicios", adminController.listarServicios)
router.get("/servicios/nuevo", adminController.mostrarFormularioServicio)
router.post("/servicios/nuevo", adminController.crearServicio)
router.get("/servicios/editar/:id", adminController.mostrarFormularioEditarServicio)
router.post("/servicios/editar/:id", adminController.actualizarServicio)
// Agregar rutas para eliminar habitaciones, tipos de habitaciones y servicios
router.post("/servicios/eliminar/:id", adminController.eliminarServicio)

// Departamentos de servicios
router.get("/departamentos-servicios", adminController.listarDepartamentosServicios)
router.get("/departamentos-servicios/nuevo", adminController.mostrarFormularioDepartamentoServicio)
router.post("/departamentos-servicios/nuevo", adminController.crearDepartamentoServicio)
router.get("/departamentos-servicios/editar/:id", adminController.mostrarFormularioEditarDepartamentoServicio)
router.post("/departamentos-servicios/editar/:id", adminController.actualizarDepartamentoServicio)
router.post("/departamentos-servicios/eliminar/:id", adminController.eliminarDepartamentoServicio)
router.get("/departamentos-servicios/:id/asignar-servicios", adminController.mostrarFormularioAsignarServicios)
router.post("/departamentos-servicios/:id/asignar-servicios", adminController.asignarServicios)

// Usuarios
router.get("/usuarios", adminController.listarUsuarios)
// Agregar rutas para gestión de usuarios
router.get("/usuarios/nuevo", adminController.mostrarFormularioUsuario)
router.post("/usuarios/nuevo", adminController.crearUsuario)
router.get("/usuarios/editar/:id", adminController.mostrarFormularioEditarUsuario)
router.post("/usuarios/editar/:id", adminController.actualizarUsuario)

module.exports = router

