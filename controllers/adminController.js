// Controlador para administrador
const db = require("../config/dbConfig")
const bcrypt = require("bcrypt")

// Dashboard de administrador
exports.dashboard = async (req, res) => {
  try {
    // Obtener estadísticas para el dashboard
    const queryHabitaciones = `
      SELECT 
        COUNT(*) AS TotalHabitaciones,
        SUM(CASE WHEN Estado = 'Disponible' THEN 1 ELSE 0 END) AS Disponibles,
        SUM(CASE WHEN Estado = 'Ocupada' THEN 1 ELSE 0 END) AS Ocupadas,
        SUM(CASE WHEN Estado = 'Mantenimiento' THEN 1 ELSE 0 END) AS Mantenimiento
      FROM Habitaciones
    `

    const queryReservas = `
      SELECT 
        COUNT(*) AS TotalReservas,
        SUM(CASE WHEN EstadoReserva = 'Pendiente' THEN 1 ELSE 0 END) AS Pendientes,
        SUM(CASE WHEN EstadoReserva = 'Confirmada' THEN 1 ELSE 0 END) AS Confirmadas,
        SUM(CASE WHEN EstadoReserva = 'Cancelada' THEN 1 ELSE 0 END) AS Canceladas,
        SUM(CASE WHEN EstadoReserva = 'Completada' THEN 1 ELSE 0 END) AS Completadas
      FROM Reservas
    `

    const queryFacturas = `
      SELECT 
        COUNT(*) AS TotalFacturas,
        SUM(Total) AS MontoTotal
      FROM Facturas
    `

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones)
    const resultReservas = await db.ejecutarQuery(queryReservas)
    const resultFacturas = await db.ejecutarQuery(queryFacturas)

    const estadisticas = {
      habitaciones: resultHabitaciones.recordset[0],
      reservas: resultReservas.recordset[0],
      facturas: resultFacturas.recordset[0],
    }

    res.render("admin/dashboard", {
      titulo: "Panel de Administración",
      estadisticas,
    })
  } catch (error) {
    console.error("Error en dashboard admin:", error)
    req.flash("error", "Error al cargar el dashboard")
    res.redirect("/")
  }
}

// Listar habitaciones
exports.listarHabitaciones = async (req, res) => {
  try {
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    const sucursalID = req.query.sucursal || ""
    const estado = req.query.estado || ""

    let queryHabitaciones = `
      SELECT h.HabitacionID, h.NumeroHabitacion, h.Estado, 
             s.NombreSucursal, t.NombreTipo, t.Capacidad, t.PrecioPorNoche
      FROM Habitaciones h
      INNER JOIN Sucursales s ON h.SucursalID = s.SucursalID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE 1=1
    `

    const params = []

    if (sucursalID) {
      queryHabitaciones += ` AND h.SucursalID = @param${params.length}`
      params.push({ valor: sucursalID })
    }

    if (estado) {
      queryHabitaciones += ` AND h.Estado = @param${params.length}`
      params.push({ valor: estado })
    }

    queryHabitaciones += ` ORDER BY s.NombreSucursal, h.NumeroHabitacion`

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones, params)

    res.render("admin/habitaciones", {
      titulo: "Gestión de Habitaciones",
      habitaciones: resultHabitaciones.recordset,
      sucursales: resultSucursales.recordset,
      filtros: {
        sucursal: sucursalID,
        estado: estado,
      },
    })
  } catch (error) {
    console.error("Error al listar habitaciones:", error)
    req.flash("error", "Error al cargar las habitaciones")
    res.redirect("/admin/dashboard")
  }
}

// Mostrar formulario para crear habitación
exports.mostrarFormularioHabitacion = async (req, res) => {
  try {
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const queryTipos = `SELECT TipoHabitacionID, NombreTipo FROM TipoHabitaciones`

    const resultSucursales = await db.ejecutarQuery(querySucursales)
    const resultTipos = await db.ejecutarQuery(queryTipos)

    res.render("admin/habitacion-form", {
      titulo: "Nueva Habitación",
      habitacion: {},
      sucursales: resultSucursales.recordset,
      tipos: resultTipos.recordset,
      editar: false,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de habitación:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/habitaciones")
  }
}

// Crear habitación
exports.crearHabitacion = async (req, res) => {
  const { sucursalID, numeroHabitacion, tipoHabitacionID, estado } = req.body

  try {
    const query = `
      INSERT INTO Habitaciones (SucursalID, NumeroHabitacion, TipoHabitacionID, Estado)
      VALUES (@param0, @param1, @param2, @param3)
    `

    await db.ejecutarQuery(query, [
      { valor: sucursalID },
      { valor: numeroHabitacion },
      { valor: tipoHabitacionID },
      { valor: estado },
    ])

    req.flash("exito", "Habitación creada exitosamente")
    res.redirect("/admin/habitaciones")
  } catch (error) {
    console.error("Error al crear habitación:", error)
    req.flash("error", "Error al crear la habitación")
    res.redirect("/admin/habitaciones/nueva")
  }
}

// Mostrar formulario para editar habitación
exports.mostrarFormularioEditarHabitacion = async (req, res) => {
  const { id } = req.params

  try {
    const queryHabitacion = `
      SELECT HabitacionID, SucursalID, NumeroHabitacion, TipoHabitacionID, Estado
      FROM Habitaciones
      WHERE HabitacionID = @param0
    `

    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const queryTipos = `SELECT TipoHabitacionID, NombreTipo FROM TipoHabitaciones`

    const resultHabitacion = await db.ejecutarQuery(queryHabitacion, [{ valor: id }])
    const resultSucursales = await db.ejecutarQuery(querySucursales)
    const resultTipos = await db.ejecutarQuery(queryTipos)

    if (resultHabitacion.recordset.length === 0) {
      req.flash("error", "Habitación no encontrada")
      return res.redirect("/admin/habitaciones")
    }

    res.render("admin/habitacion-form", {
      titulo: "Editar Habitación",
      habitacion: resultHabitacion.recordset[0],
      sucursales: resultSucursales.recordset,
      tipos: resultTipos.recordset,
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/habitaciones")
  }
}

// Actualizar habitación
exports.actualizarHabitacion = async (req, res) => {
  const { id } = req.params
  const { sucursalID, numeroHabitacion, tipoHabitacionID, estado } = req.body

  try {
    const query = `
      UPDATE Habitaciones
      SET SucursalID = @param0,
          NumeroHabitacion = @param1,
          TipoHabitacionID = @param2,
          Estado = @param3
      WHERE HabitacionID = @param4
    `

    await db.ejecutarQuery(query, [
      { valor: sucursalID },
      { valor: numeroHabitacion },
      { valor: tipoHabitacionID },
      { valor: estado },
      { valor: id },
    ])

    req.flash("exito", "Habitación actualizada exitosamente")
    res.redirect("/admin/habitaciones")
  } catch (error) {
    console.error("Error al actualizar habitación:", error)
    req.flash("error", "Error al actualizar la habitación")
    res.redirect(`/admin/habitaciones/editar/${id}`)
  }
}

// Agregar la función para eliminar habitación
exports.eliminarHabitacion = async (req, res) => {
  const { id } = req.params

  try {
    // Verificar si la habitación está siendo utilizada en alguna reserva
    const queryVerificar = `
      SELECT COUNT(*) AS Reservas
      FROM HabitacionesReservas
      WHERE HabitacionID = @param0
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }])

    if (resultVerificar.recordset[0].Reservas > 0) {
      req.flash("error", "No se puede eliminar la habitación porque está asociada a reservas")
      return res.redirect("/admin/habitaciones")
    }

    // Eliminar la habitación
    const query = `
      DELETE FROM Habitaciones
      WHERE HabitacionID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Habitación eliminada exitosamente")
    res.redirect("/admin/habitaciones")
  } catch (error) {
    console.error("Error al eliminar habitación:", error)
    req.flash("error", "Error al eliminar la habitación")
    res.redirect("/admin/habitaciones")
  }
}

// Listar tipos de habitaciones
exports.listarTiposHabitaciones = async (req, res) => {
  try {
    const query = `
      SELECT TipoHabitacionID, NombreTipo, Descripcion, Capacidad, PrecioPorNoche
      FROM TipoHabitaciones
      ORDER BY NombreTipo
    `

    const result = await db.ejecutarQuery(query)

    res.render("admin/tipos-habitaciones", {
      titulo: "Tipos de Habitaciones",
      tipos: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar tipos de habitaciones:", error)
    req.flash("error", "Error al cargar los tipos de habitaciones")
    res.redirect("/admin/dashboard")
  }
}

// Mostrar formulario para crear tipo de habitación
exports.mostrarFormularioTipoHabitacion = (req, res) => {
  res.render("admin/tipo-habitacion-form", {
    titulo: "Nuevo Tipo de Habitación",
    tipo: {},
    editar: false,
  })
}

// Crear tipo de habitación
exports.crearTipoHabitacion = async (req, res) => {
  const { nombreTipo, descripcion, capacidad, precioPorNoche } = req.body

  try {
    const query = `
      INSERT INTO TipoHabitaciones (NombreTipo, Descripcion, Capacidad, PrecioPorNoche)
      VALUES (@param0, @param1, @param2, @param3)
    `

    await db.ejecutarQuery(query, [
      { valor: nombreTipo },
      { valor: descripcion },
      { valor: capacidad },
      { valor: precioPorNoche },
    ])

    req.flash("exito", "Tipo de habitación creado exitosamente")
    res.redirect("/admin/tipos-habitaciones")
  } catch (error) {
    console.error("Error al crear tipo de habitación:", error)
    req.flash("error", "Error al crear el tipo de habitación")
    res.redirect("/admin/tipos-habitaciones/nuevo")
  }
}

// Mostrar formulario para editar tipo de habitación
exports.mostrarFormularioEditarTipoHabitacion = async (req, res) => {
  const { id } = req.params

  try {
    const query = `
      SELECT TipoHabitacionID, NombreTipo, Descripcion, Capacidad, PrecioPorNoche
      FROM TipoHabitaciones
      WHERE TipoHabitacionID = @param0
    `

    const result = await db.ejecutarQuery(query, [{ valor: id }])

    if (result.recordset.length === 0) {
      req.flash("error", "Tipo de habitación no encontrado")
      return res.redirect("/admin/tipos-habitaciones")
    }

    res.render("admin/tipo-habitacion-form", {
      titulo: "Editar Tipo de Habitación",
      tipo: result.recordset[0],
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/tipos-habitaciones")
  }
}

// Actualizar tipo de habitación
exports.actualizarTipoHabitacion = async (req, res) => {
  const { id } = req.params
  const { nombreTipo, descripcion, capacidad, precioPorNoche } = req.body

  try {
    const query = `
      UPDATE TipoHabitaciones
      SET NombreTipo = @param0,
          Descripcion = @param1,
          Capacidad = @param2,
          PrecioPorNoche = @param3
      WHERE TipoHabitacionID = @param4
    `

    await db.ejecutarQuery(query, [
      { valor: nombreTipo },
      { valor: descripcion },
      { valor: capacidad },
      { valor: precioPorNoche },
      { valor: id },
    ])

    req.flash("exito", "Tipo de habitación actualizado exitosamente")
    res.redirect("/admin/tipos-habitaciones")
  } catch (error) {
    console.error("Error al actualizar tipo de habitación:", error)
    req.flash("error", "Error al actualizar el tipo de habitación")
    res.redirect(`/admin/tipos-habitaciones/editar/${id}`)
  }
}

// Agregar la función para eliminar tipo de habitación
exports.eliminarTipoHabitacion = async (req, res) => {
  const { id } = req.params

  try {
    // Verificar si el tipo de habitación está siendo utilizado
    const queryVerificar = `
      SELECT COUNT(*) AS Habitaciones
      FROM Habitaciones
      WHERE TipoHabitacionID = @param0
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }])

    if (resultVerificar.recordset[0].Habitaciones > 0) {
      req.flash("error", "No se puede eliminar el tipo de habitación porque está siendo utilizado")
      return res.redirect("/admin/tipos-habitaciones")
    }

    // Eliminar el tipo de habitación
    const query = `
      DELETE FROM TipoHabitaciones
      WHERE TipoHabitacionID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Tipo de habitación eliminado exitosamente")
    res.redirect("/admin/tipos-habitaciones")
  } catch (error) {
    console.error("Error al eliminar tipo de habitación:", error)
    req.flash("error", "Error al eliminar el tipo de habitación")
    res.redirect("/admin/tipos-habitaciones")
  }
}

// Listar servicios adicionales
exports.listarServicios = async (req, res) => {
  try {
    const query = `
      SELECT ServicioID, NombreServicio, Precio
      FROM ServiciosAdicionales
      ORDER BY NombreServicio
    `

    const result = await db.ejecutarQuery(query)

    res.render("admin/servicios", {
      titulo: "Servicios Adicionales",
      servicios: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar servicios:", error)
    req.flash("error", "Error al cargar los servicios")
    res.redirect("/admin/dashboard")
  }
}

// Mostrar formulario para crear servicio
exports.mostrarFormularioServicio = (req, res) => {
  res.render("admin/servicio-form", {
    titulo: "Nuevo Servicio",
    servicio: {},
    editar: false,
  })
}

// Crear servicio
exports.crearServicio = async (req, res) => {
  const { nombreServicio, precio } = req.body

  try {
    const query = `
      INSERT INTO ServiciosAdicionales (NombreServicio, Precio)
      VALUES (@param0, @param1)
    `

    await db.ejecutarQuery(query, [{ valor: nombreServicio }, { valor: precio }])

    req.flash("exito", "Servicio creado exitosamente")
    res.redirect("/admin/servicios")
  } catch (error) {
    console.error("Error al crear servicio:", error)
    req.flash("error", "Error al crear el servicio")
    res.redirect("/admin/servicios/nuevo")
  }
}

// Mostrar formulario para editar servicio
exports.mostrarFormularioEditarServicio = async (req, res) => {
  const { id } = req.params

  try {
    const query = `
      SELECT ServicioID, NombreServicio, Precio
      FROM ServiciosAdicionales
      WHERE ServicioID = @param0
    `

    const result = await db.ejecutarQuery(query, [{ valor: id }])

    if (result.recordset.length === 0) {
      req.flash("error", "Servicio no encontrado")
      return res.redirect("/admin/servicios")
    }

    res.render("admin/servicio-form", {
      titulo: "Editar Servicio",
      servicio: result.recordset[0],
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/servicios")
  }
}

// Actualizar servicio
exports.actualizarServicio = async (req, res) => {
  const { id } = req.params
  const { nombreServicio, precio } = req.body

  try {
    const query = `
      UPDATE ServiciosAdicionales
      SET NombreServicio = @param0,
          Precio = @param1
      WHERE ServicioID = @param2
    `

    await db.ejecutarQuery(query, [{ valor: nombreServicio }, { valor: precio }, { valor: id }])

    req.flash("exito", "Servicio actualizado exitosamente")
    res.redirect("/admin/servicios")
  } catch (error) {
    console.error("Error al actualizar servicio:", error)
    req.flash("error", "Error al actualizar el servicio")
    res.redirect(`/admin/servicios/editar/${id}`)
  }
}

// Agregar la función para eliminar servicio
exports.eliminarServicio = async (req, res) => {
  const { id } = req.params

  try {
    // Verificar si el servicio está siendo utilizado
    const queryVerificar = `
      SELECT COUNT(*) AS Consumos
      FROM ConsumoServicios
      WHERE ServicioID = @param0
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }])

    if (resultVerificar.recordset[0].Consumos > 0) {
      req.flash("error", "No se puede eliminar el servicio porque está siendo utilizado")
      return res.redirect("/admin/servicios")
    }

    // Eliminar el servicio de los departamentos
    const queryEliminarDepartamentos = `
      DELETE FROM ServiciosPorDepartamento
      WHERE ServicioID = @param0
    `

    await db.ejecutarQuery(queryEliminarDepartamentos, [{ valor: id }])

    // Eliminar el servicio
    const query = `
      DELETE FROM ServiciosAdicionales
      WHERE ServicioID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Servicio eliminado exitosamente")
    res.redirect("/admin/servicios")
  } catch (error) {
    console.error("Error al eliminar servicio:", error)
    req.flash("error", "Error al eliminar el servicio")
    res.redirect("/admin/servicios")
  }
}

// Listar usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const query = `
      SELECT u.UsuarioID, u.NombreUsuario, p.PrimerNombre, p.PrimerApellido, p.Correo, u.FechaCreacion
      FROM Usuarios u
      INNER JOIN Personas p ON u.PersonaID = p.PersonaID
      ORDER BY u.NombreUsuario
    `

    const result = await db.ejecutarQuery(query)

    // Obtener roles para cada usuario
    for (const usuario of result.recordset) {
      const queryRoles = `
        SELECT r.NombreRol
        FROM Roles r
        INNER JOIN UsuariosRoles ur ON r.RolID = ur.RolID
        WHERE ur.UsuarioID = @param0
      `

      const resultRoles = await db.ejecutarQuery(queryRoles, [{ valor: usuario.UsuarioID }])
      usuario.roles = resultRoles.recordset.map((rol) => rol.NombreRol)
    }

    res.render("admin/usuarios", {
      titulo: "Gestión de Usuarios",
      usuarios: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar usuarios:", error)
    req.flash("error", "Error al cargar los usuarios")
    res.redirect("/admin/dashboard")
  }
}

// Agregar funciones para gestionar usuarios

// Mostrar formulario para crear usuario
exports.mostrarFormularioUsuario = async (req, res) => {
  try {
    // Obtener roles disponibles
    const queryRoles = `SELECT RolID, NombreRol FROM Roles`
    const resultRoles = await db.ejecutarQuery(queryRoles)

    res.render("admin/usuario-form", {
      titulo: "Nuevo Usuario",
      usuario: {},
      roles: resultRoles.recordset,
      editar: false,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de usuario:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/usuarios")
  }
}

// Crear usuario
exports.crearUsuario = async (req, res) => {
  const {
    primerNombre,
    segundoNombre,
    primerApellido,
    segundoApellido,
    numeroIdentidad,
    correo,
    telefono,
    nombreUsuario,
    contrasena,
    roles,
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

      // 4. Asignar roles
      if (roles && roles.length > 0) {
        for (const rolID of roles) {
          const queryRol = `
            INSERT INTO UsuariosRoles (UsuarioID, RolID)
            VALUES (@param0, @param1)
          `

          const requestRol = new db.sql.Request(transaction)
          requestRol.input("param0", usuarioID)
          requestRol.input("param1", rolID)
          await requestRol.query(queryRol)
        }
      }

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Usuario creado exitosamente")
      res.redirect("/admin/usuarios")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en creación de usuario:", error)
      req.flash("error", "Error al crear el usuario")
      res.redirect("/admin/usuarios/nuevo")
    }
  } catch (error) {
    console.error("Error en creación de usuario:", error)
    req.flash("error", "Error al crear el usuario")
    res.redirect("/admin/usuarios/nuevo")
  }
}

// Mostrar formulario para editar usuario
exports.mostrarFormularioEditarUsuario = async (req, res) => {
  const { id } = req.params

  try {
    // Obtener información del usuario
    const queryUsuario = `
      SELECT u.UsuarioID, u.NombreUsuario, p.PersonaID, p.PrimerNombre, p.SegundoNombre, 
             p.PrimerApellido, p.SegundoApellido, p.NumeroIdentidad, p.Correo
      FROM Usuarios u
      INNER JOIN Personas p ON u.PersonaID = p.PersonaID
      WHERE u.UsuarioID = @param0
    `

    const resultUsuario = await db.ejecutarQuery(queryUsuario, [{ valor: id }])

    if (resultUsuario.recordset.length === 0) {
      req.flash("error", "Usuario no encontrado")
      return res.redirect("/admin/usuarios")
    }

    const usuario = resultUsuario.recordset[0]

    // Obtener teléfono del usuario
    const queryTelefono = `
      SELECT Telefono
      FROM Telefonos
      WHERE PersonaID = @param0
    `

    const resultTelefono = await db.ejecutarQuery(queryTelefono, [{ valor: usuario.PersonaID }])

    if (resultTelefono.recordset.length > 0) {
      usuario.telefono = resultTelefono.recordset[0].Telefono
    }

    // Obtener roles del usuario
    const queryRolesUsuario = `
      SELECT RolID
      FROM UsuariosRoles
      WHERE UsuarioID = @param0
    `

    const resultRolesUsuario = await db.ejecutarQuery(queryRolesUsuario, [{ valor: id }])
    usuario.roles = resultRolesUsuario.recordset.map((rol) => rol.RolID)

    // Obtener todos los roles disponibles
    const queryRoles = `SELECT RolID, NombreRol FROM Roles`
    const resultRoles = await db.ejecutarQuery(queryRoles)

    res.render("admin/usuario-form", {
      titulo: "Editar Usuario",
      usuario: usuario,
      roles: resultRoles.recordset,
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición de usuario:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/usuarios")
  }
}

// Actualizar usuario
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params
  const {
    personaID,
    primerNombre,
    segundoNombre,
    primerApellido,
    segundoApellido,
    numeroIdentidad,
    correo,
    telefono,
    nombreUsuario,
    contrasena,
    roles,
  } = req.body

  try {
    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // 1. Actualizar persona
      const queryPersona = `
        UPDATE Personas
        SET PrimerNombre = @param0,
            SegundoNombre = @param1,
            PrimerApellido = @param2,
            SegundoApellido = @param3,
            NumeroIdentidad = @param4,
            Correo = @param5
        WHERE PersonaID = @param6
      `

      const requestPersona = new db.sql.Request(transaction)
      requestPersona.input("param0", primerNombre)
      requestPersona.input("param1", segundoNombre || null)
      requestPersona.input("param2", primerApellido)
      requestPersona.input("param3", segundoApellido || null)
      requestPersona.input("param4", numeroIdentidad)
      requestPersona.input("param5", correo)
      requestPersona.input("param6", personaID)
      await requestPersona.query(queryPersona)

      // 2. Actualizar teléfono
      const queryTelefono = `
        UPDATE Telefonos
        SET Telefono = @param0
        WHERE PersonaID = @param1
      `

      const requestTelefono = new db.sql.Request(transaction)
      requestTelefono.input("param0", telefono)
      requestTelefono.input("param1", personaID)
      await requestTelefono.query(queryTelefono)

      // 3. Actualizar usuario
      const queryUsuario = `
        UPDATE Usuarios
        SET NombreUsuario = @param0,
            FechaModificacion = GETDATE()
        WHERE UsuarioID = @param1
      `

      const requestUsuario = new db.sql.Request(transaction)
      requestUsuario.input("param0", nombreUsuario)
      requestUsuario.input("param1", id)
      await requestUsuario.query(queryUsuario)

      // 4. Actualizar contraseña si se proporcionó una nueva
      if (contrasena && contrasena.trim() !== "") {
        const hashedPassword = await bcrypt.hash(contrasena, 10)

        const queryContrasena = `
          UPDATE Usuarios
          SET Contrasena = @param0
          WHERE UsuarioID = @param1
        `

        const requestContrasena = new db.sql.Request(transaction)
        requestContrasena.input("param0", hashedPassword)
        requestContrasena.input("param1", id)
        await requestContrasena.query(queryContrasena)
      }

      // 5. Actualizar roles
      // Primero eliminar roles existentes
      const queryEliminarRoles = `
        DELETE FROM UsuariosRoles
        WHERE UsuarioID = @param0
      `

      const requestEliminarRoles = new db.sql.Request(transaction)
      requestEliminarRoles.input("param0", id)
      await requestEliminarRoles.query(queryEliminarRoles)

      // Luego asignar nuevos roles
      if (roles && roles.length > 0) {
        for (const rolID of roles) {
          const queryRol = `
            INSERT INTO UsuariosRoles (UsuarioID, RolID)
            VALUES (@param0, @param1)
          `

          const requestRol = new db.sql.Request(transaction)
          requestRol.input("param0", id)
          requestRol.input("param1", rolID)
          await requestRol.query(queryRol)
        }
      }

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Usuario actualizado exitosamente")
      res.redirect("/admin/usuarios")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en actualización de usuario:", error)
      req.flash("error", "Error al actualizar el usuario")
      res.redirect(`/admin/usuarios/editar/${id}`)
    }
  } catch (error) {
    console.error("Error en actualización de usuario:", error)
    req.flash("error", "Error al actualizar el usuario")
    res.redirect(`/admin/usuarios/editar/${id}`)
  }
}

// Agregar funciones para gestionar departamentos de servicios

// Listar departamentos de servicios
exports.listarDepartamentosServicios = async (req, res) => {
  try {
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    const sucursalID = req.query.sucursal || ""

    let queryDepartamentos = `
      SELECT ds.DepartamentoID, ds.NombreDepartamento, ds.Descripcion, s.NombreSucursal
      FROM DepartamentosServicios ds
      INNER JOIN Sucursales s ON ds.SucursalID = s.SucursalID
      WHERE 1=1
    `

    const params = []

    if (sucursalID) {
      queryDepartamentos += ` AND ds.SucursalID = @param${params.length}`
      params.push({ valor: sucursalID })
    }

    queryDepartamentos += ` ORDER BY s.NombreSucursal, ds.NombreDepartamento`

    const resultDepartamentos = await db.ejecutarQuery(queryDepartamentos, params)

    res.render("admin/departamentos-servicios", {
      titulo: "Departamentos de Servicios",
      departamentos: resultDepartamentos.recordset,
      sucursales: resultSucursales.recordset,
      filtros: {
        sucursal: sucursalID,
      },
    })
  } catch (error) {
    console.error("Error al listar departamentos de servicios:", error)
    req.flash("error", "Error al cargar los departamentos de servicios")
    res.redirect("/admin/dashboard")
  }
}

// Mostrar formulario para crear departamento de servicio
exports.mostrarFormularioDepartamentoServicio = async (req, res) => {
  try {
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    res.render("admin/departamento-servicio-form", {
      titulo: "Nuevo Departamento de Servicio",
      departamento: {},
      sucursales: resultSucursales.recordset,
      editar: false,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de departamento de servicio:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/departamentos-servicios")
  }
}

// Crear departamento de servicio
exports.crearDepartamentoServicio = async (req, res) => {
  const { sucursalID, nombreDepartamento, descripcion } = req.body

  try {
    const query = `
      INSERT INTO DepartamentosServicios (SucursalID, NombreDepartamento, Descripcion)
      VALUES (@param0, @param1, @param2)
    `

    await db.ejecutarQuery(query, [{ valor: sucursalID }, { valor: nombreDepartamento }, { valor: descripcion }])

    req.flash("exito", "Departamento de servicio creado exitosamente")
    res.redirect("/admin/departamentos-servicios")
  } catch (error) {
    console.error("Error al crear departamento de servicio:", error)
    req.flash("error", "Error al crear el departamento de servicio")
    res.redirect("/admin/departamentos-servicios/nuevo")
  }
}

// Mostrar formulario para editar departamento de servicio
exports.mostrarFormularioEditarDepartamentoServicio = async (req, res) => {
  const { id } = req.params

  try {
    const queryDepartamento = `
      SELECT DepartamentoID, SucursalID, NombreDepartamento, Descripcion
      FROM DepartamentosServicios
      WHERE DepartamentoID = @param0
    `

    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`

    const resultDepartamento = await db.ejecutarQuery(queryDepartamento, [{ valor: id }])
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    if (resultDepartamento.recordset.length === 0) {
      req.flash("error", "Departamento de servicio no encontrado")
      return res.redirect("/admin/departamentos-servicios")
    }

    res.render("admin/departamento-servicio-form", {
      titulo: "Editar Departamento de Servicio",
      departamento: resultDepartamento.recordset[0],
      sucursales: resultSucursales.recordset,
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/departamentos-servicios")
  }
}

// Actualizar departamento de servicio
exports.actualizarDepartamentoServicio = async (req, res) => {
  const { id } = req.params
  const { sucursalID, nombreDepartamento, descripcion } = req.body

  try {
    const query = `
      UPDATE DepartamentosServicios
      SET SucursalID = @param0,
          NombreDepartamento = @param1,
          Descripcion = @param2
      WHERE DepartamentoID = @param3
    `

    await db.ejecutarQuery(query, [
      { valor: sucursalID },
      { valor: nombreDepartamento },
      { valor: descripcion },
      { valor: id },
    ])

    req.flash("exito", "Departamento de servicio actualizado exitosamente")
    res.redirect("/admin/departamentos-servicios")
  } catch (error) {
    console.error("Error al actualizar departamento de servicio:", error)
    req.flash("error", "Error al actualizar el departamento de servicio")
    res.redirect(`/admin/departamentos-servicios/editar/${id}`)
  }
}

// Eliminar departamento de servicio
exports.eliminarDepartamentoServicio = async (req, res) => {
  const { id } = req.params

  try {
    // Verificar si el departamento tiene servicios asignados
    const queryVerificar = `
      SELECT COUNT(*) AS Servicios
      FROM ServiciosPorDepartamento
      WHERE DepartamentoID = @param0
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }])

    if (resultVerificar.recordset[0].Servicios > 0) {
      req.flash("error", "No se puede eliminar el departamento porque tiene servicios asignados")
      return res.redirect("/admin/departamentos-servicios")
    }

    // Eliminar el departamento
    const query = `
      DELETE FROM DepartamentosServicios
      WHERE DepartamentoID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Departamento de servicio eliminado exitosamente")
    res.redirect("/admin/departamentos-servicios")
  } catch (error) {
    console.error("Error al eliminar departamento de servicio:", error)
    req.flash("error", "Error al eliminar el departamento de servicio")
    res.redirect("/admin/departamentos-servicios")
  }
}

// Mostrar formulario para asignar servicios a departamento
exports.mostrarFormularioAsignarServicios = async (req, res) => {
  const { id } = req.params

  try {
    // Obtener información del departamento
    const queryDepartamento = `
      SELECT ds.DepartamentoID, ds.NombreDepartamento, s.NombreSucursal
      FROM DepartamentosServicios ds
      INNER JOIN Sucursales s ON ds.SucursalID = s.SucursalID
      WHERE ds.DepartamentoID = @param0
    `

    const resultDepartamento = await db.ejecutarQuery(queryDepartamento, [{ valor: id }])

    if (resultDepartamento.recordset.length === 0) {
      req.flash("error", "Departamento de servicio no encontrado")
      return res.redirect("/admin/departamentos-servicios")
    }

    const departamento = resultDepartamento.recordset[0]

    // Obtener servicios disponibles
    const queryServicios = `
      SELECT sa.ServicioID, sa.NombreServicio, sa.Precio,
             CASE WHEN spd.ServicioID IS NOT NULL THEN 1 ELSE 0 END AS Asignado
      FROM ServiciosAdicionales sa
      LEFT JOIN ServiciosPorDepartamento spd ON sa.ServicioID = spd.ServicioID AND spd.DepartamentoID = @param0
      ORDER BY sa.NombreServicio
    `

    const resultServicios = await db.ejecutarQuery(queryServicios, [{ valor: id }])

    res.render("admin/asignar-servicios", {
      titulo: "Asignar Servicios a Departamento",
      departamento: departamento,
      servicios: resultServicios.recordset,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de asignación de servicios:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/admin/departamentos-servicios")
  }
}

// Asignar servicios a departamento
exports.asignarServicios = async (req, res) => {
  const { id } = req.params
  const { servicios } = req.body

  try {
    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // Eliminar asignaciones existentes
      const queryEliminar = `
        DELETE FROM ServiciosPorDepartamento
        WHERE DepartamentoID = @param0
      `

      const requestEliminar = new db.sql.Request(transaction)
      requestEliminar.input("param0", id)
      await requestEliminar.query(queryEliminar)

      // Insertar nuevas asignaciones
      if (servicios && servicios.length > 0) {
        for (const servicioID of servicios) {
          const queryInsertar = `
            INSERT INTO ServiciosPorDepartamento (ServicioID, DepartamentoID)
            VALUES (@param0, @param1)
          `

          const requestInsertar = new db.sql.Request(transaction)
          requestInsertar.input("param0", servicioID)
          requestInsertar.input("param1", id)
          await requestInsertar.query(queryInsertar)
        }
      }

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Servicios asignados exitosamente")
      res.redirect("/admin/departamentos-servicios")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en asignación de servicios:", error)
      req.flash("error", "Error al asignar servicios")
      res.redirect(`/admin/departamentos-servicios/${id}/asignar-servicios`)
    }
  } catch (error) {
    console.error("Error en asignación de servicios:", error)
    req.flash("error", "Error al asignar servicios")
    res.redirect(`/admin/departamentos-servicios/${id}/asignar-servicios`)
  }
}

