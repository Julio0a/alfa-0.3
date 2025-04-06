// Controlador para autenticación
const db = require("../config/dbConfig")
const bcrypt = require("bcrypt")

// Mostrar formulario de login
exports.mostrarLogin = (req, res) => {
  res.render("auth/login", {
    titulo: "Iniciar Sesión",
  })
}

// Procesar login
exports.procesarLogin = async (req, res) => {
  const { nombreUsuario, contrasena } = req.body

  try {
    // Consultar usuario por nombre de usuario
    const queryUsuario = `
      SELECT u.UsuarioID, u.NombreUsuario, u.Contrasena, p.PrimerNombre, p.PrimerApellido, p.Correo
      FROM Usuarios u
      INNER JOIN Personas p ON u.PersonaID = p.PersonaID
      WHERE u.NombreUsuario = @param0
    `

    const resultUsuario = await db.ejecutarQuery(queryUsuario, [{ valor: nombreUsuario }])

    if (resultUsuario.recordset.length === 0) {
      req.flash("error", "Usuario o contraseña incorrectos")
      return res.redirect("/login")
    }

    const usuario = resultUsuario.recordset[0]

    // Verificar contraseña
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.Contrasena)

    if (!contrasenaValida) {
      req.flash("error", "Usuario o contraseña incorrectos")
      return res.redirect("/login")
    }

    // Consultar roles del usuario
    const queryRoles = `
      SELECT r.NombreRol
      FROM Roles r
      INNER JOIN UsuariosRoles ur ON r.RolID = ur.RolID
      WHERE ur.UsuarioID = @param0
    `

    const resultRoles = await db.ejecutarQuery(queryRoles, [{ valor: usuario.UsuarioID }])

    const roles = resultRoles.recordset.map((rol) => rol.NombreRol)

    // Guardar usuario en sesión
    req.session.usuario = {
      id: usuario.UsuarioID,
      nombreUsuario: usuario.NombreUsuario,
      nombre: `${usuario.PrimerNombre} ${usuario.PrimerApellido}`,
      correo: usuario.Correo,
      roles: roles,
    }

    // Redireccionar según rol
    if (roles.includes("Administrador")) {
      res.redirect("/admin/dashboard")
    } else if (roles.includes("Cliente")) {
      res.redirect("/cliente/dashboard")
    } else if (roles.includes("Recepcionista")) {
      res.redirect("/recepcion/dashboard")
    } else if (roles.includes("RecursosHumanos")) {
      res.redirect("/rrh/dashboard")
    } else {
      res.redirect("/")
    }
  } catch (error) {
    console.error("Error en login:", error)
    req.flash("error", "Error al iniciar sesión")
    res.redirect("/login")
  }
}

// Mostrar formulario de registro
exports.mostrarRegistro = (req, res) => {
  res.render("auth/registro", {
    titulo: "Registro de Cliente",
  })
}

// Procesar registro
exports.procesarRegistro = async (req, res) => {
  const {
    primerNombre,
    segundoNombre,
    primerApellido,
    segundoApellido,
    numeroIdentidad,
    correo,
    telefono,
    rtn,
    nombreUsuario,
    contrasena,
  } = req.body

  try {
    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // 1. Insertar persona
      const queryPersona = `
        INSERT INTO Personas (PrimerNombre, SegundoNombre, PrimerApellido, SegundoApellido, NumeroIdentidad, Correo)
        OUTPUT INSERTED.PersonaID
        VALUES (@param0, @param1, @param2, @param3, @param4, @param5)
      `

      const requestPersona = new db.sql.Request(transaction)
      requestPersona.input("param0", primerNombre)
      requestPersona.input("param1", segundoNombre || null)
      requestPersona.input("param2", primerApellido)
      requestPersona.input("param3", segundoApellido || null)
      requestPersona.input("param4", numeroIdentidad)
      requestPersona.input("param5", correo)

      const resultPersona = await requestPersona.query(queryPersona)
      const personaID = resultPersona.recordset[0].PersonaID

      // 2. Insertar teléfono
      const queryTelefono = `
        INSERT INTO Telefonos (PersonaID, TipoTelefonoID, Telefono)
        VALUES (@param0, 1, @param1)
      `

      const requestTelefono = new db.sql.Request(transaction)
      requestTelefono.input("param0", personaID)
      requestTelefono.input("param1", telefono)
      await requestTelefono.query(queryTelefono)

      // 3. Insertar usuario
      const hashedPassword = await bcrypt.hash(contrasena, 10)

      const queryUsuario = `
        INSERT INTO Usuarios (PersonaID, NombreUsuario, Contrasena, FechaCreacion)
        OUTPUT INSERTED.UsuarioID
        VALUES (@param0, @param1, @param2, GETDATE())
      `

      const requestUsuario = new db.sql.Request(transaction)
      requestUsuario.input("param0", personaID)
      requestUsuario.input("param1", nombreUsuario)
      requestUsuario.input("param2", hashedPassword)

      const resultUsuario = await requestUsuario.query(queryUsuario)
      const usuarioID = resultUsuario.recordset[0].UsuarioID

      // 4. Insertar cliente
      const queryCliente = `
        INSERT INTO Clientes (PersonaID, RTN, FechaRegistro)
        VALUES (@param0, @param1, GETDATE())
      `

      const requestCliente = new db.sql.Request(transaction)
      requestCliente.input("param0", personaID)
      requestCliente.input("param1", rtn || null)
      await requestCliente.query(queryCliente)

      // 5. Asignar rol de cliente
      const queryRolCliente = `
        INSERT INTO UsuariosRoles (UsuarioID, RolID)
        VALUES (@param0, (SELECT RolID FROM Roles WHERE NombreRol = 'Cliente'))
      `

      const requestRolCliente = new db.sql.Request(transaction)
      requestRolCliente.input("param0", usuarioID)
      await requestRolCliente.query(queryRolCliente)

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Registro exitoso. Ahora puedes iniciar sesión")
      res.redirect("/login")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en registro:", error)
      req.flash("error", "Error al registrar usuario")
      res.redirect("/registro")
    }
  } catch (error) {
    console.error("Error en registro:", error)
    req.flash("error", "Error al registrar usuario")
    res.redirect("/registro")
  }
}

// Cerrar sesión
exports.cerrarSesion = (req, res) => {
  req.session.destroy()
  res.redirect("/")
}

