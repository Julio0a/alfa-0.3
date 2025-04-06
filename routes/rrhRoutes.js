// Rutas de recursos humanos
const express = require("express")
const router = express.Router()
const rrhController = require("../controllers/rrhController")
const { estaAutenticado, esRRHH } = require("../middlewares/authMiddleware")

// Aplicar middleware a todas las rutas
router.use(estaAutenticado)
router.use(esRRHH)

// Dashboard
router.get("/dashboard", rrhController.dashboard)

// Empleados
router.get("/empleados", rrhController.listarEmpleados)
router.get("/empleados/nuevo", rrhController.mostrarFormularioEmpleado)
router.post("/empleados/nuevo", rrhController.crearEmpleado)
router.get("/empleados/editar/:id", rrhController.mostrarFormularioEditarEmpleado)
router.post("/empleados/editar/:id", rrhController.actualizarEmpleado)

// Puestos
router.get("/puestos", rrhController.listarPuestos)
router.get("/puestos/nuevo", rrhController.mostrarFormularioPuesto)
router.post("/puestos/nuevo", rrhController.crearPuesto)
router.get("/puestos/editar/:id", rrhController.mostrarFormularioEditarPuesto)
router.post("/puestos/editar/:id", rrhController.actualizarPuesto)

// Turnos
router.get("/turnos", rrhController.listarTurnos)
router.get("/turnos/nuevo", rrhController.mostrarFormularioTurno)
router.post("/turnos/nuevo", rrhController.crearTurno)
router.get("/turnos/editar/:id", rrhController.mostrarFormularioEditarTurno)
router.post("/turnos/editar/:id", rrhController.actualizarTurno)

// Asignación de turnos
router.get("/asignaciones-turnos", rrhController.listarAsignacionesTurnos)
router.get("/asignaciones-turnos/nueva", rrhController.mostrarFormularioAsignacionTurno)
router.post("/asignaciones-turnos/nueva", rrhController.crearAsignacionTurno)
router.post("/asignaciones-turnos/:id/eliminar", rrhController.eliminarAsignacionTurno)

module.exports = router

