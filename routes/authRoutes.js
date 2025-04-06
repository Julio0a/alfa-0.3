// Rutas de autenticación
const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")

// Mostrar formulario de login
router.get("/login", authController.mostrarLogin)

// Procesar login
router.post("/login", authController.procesarLogin)

// Mostrar formulario de registro
router.get("/registro", authController.mostrarRegistro)

// Procesar registro
router.post("/registro", authController.procesarRegistro)

// Cerrar sesión
router.get("/logout", authController.cerrarSesion)

module.exports = router

