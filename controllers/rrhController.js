// Controlador para recursos humanos
const db = require("../config/dbConfig")

// Dashboard de recursos humanos
exports.dashboard = async (req, res) => {
  try {
    // Obtener estadísticas para el dashboard
    const queryEmpleados = `
      SELECT COUNT(*) AS TotalEmpleados
      FROM Empleados
    `

    const queryPuestos = `
      SELECT COUNT(*) AS TotalPuestos
      FROM Puestos
    `

    const queryTurnos = `
      SELECT COUNT(*) AS TotalTurnos
      FROM Turnos
    `

    // Obtener empleados recientes
    const queryEmpleadosRecientes = `
      SELECT TOP 5 e.EmpleadoID, p.PrimerNombre, p.PrimerApellido, pu.NombrePuesto, s.NombreSucursal, e.FechaContratacion
      FROM Empleados e
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      INNER JOIN Puestos pu ON e.PuestoID = pu.PuestoID
      INNER JOIN Sucursales s ON e.SucursalID = s.SucursalID
      ORDER BY e.FechaContratacion DESC
    `

    const resultEmpleados = await db.ejecutarQuery(queryEmpleados)
    const resultPuestos = await db.ejecutarQuery(queryPuestos)
    const resultTurnos = await db.ejecutarQuery(queryTurnos)
    const resultEmpleadosRecientes = await db.ejecutarQuery(queryEmpleadosRecientes)

    const estadisticas = {
      empleados: resultEmpleados.recordset[0],
      puestos: resultPuestos.recordset[0],
      turnos: resultTurnos.recordset[0],
    }

    res.render("rrh/dashboard", {
      titulo: "Panel de Recursos Humanos",
      estadisticas: estadisticas,
      empleadosRecientes: resultEmpleadosRecientes.recordset,
    })
  } catch (error) {
    console.error("Error en dashboard RRHH:", error)
    req.flash("error", "Error al cargar el dashboard")
    res.redirect("/")
  }
}

// Listar empleados
exports.listarEmpleados = async (req, res) => {
  try {
    const sucursalID = req.query.sucursal || ""
    const puestoID = req.query.puesto || ""

    // Obtener sucursales y puestos para los filtros
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const queryPuestos = `SELECT PuestoID, NombrePuesto FROM Puestos`

    const resultSucursales = await db.ejecutarQuery(querySucursales)
    const resultPuestos = await db.ejecutarQuery(queryPuestos)

    let queryEmpleados = `
      SELECT e.EmpleadoID, p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido,
             p.NumeroIdentidad, p.Correo, pu.NombrePuesto, s.NombreSucursal, e.FechaContratacion
      FROM Empleados e
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      INNER JOIN Puestos pu ON e.PuestoID = pu.PuestoID
      INNER JOIN Sucursales s ON e.SucursalID = s.SucursalID
      WHERE 1=1
    `

    const params = []

    if (sucursalID) {
      queryEmpleados += ` AND e.SucursalID = @param${params.length}`
      params.push({ valor: sucursalID })
    }

    if (puestoID) {
      queryEmpleados += ` AND e.PuestoID = @param${params.length}`
      params.push({ valor: puestoID })
    }

    queryEmpleados += ` ORDER BY p.PrimerApellido, p.PrimerNombre`

    const resultEmpleados = await db.ejecutarQuery(queryEmpleados, params)

    res.render("rrh/empleados", {
      titulo: "Gestión de Empleados",
      empleados: resultEmpleados.recordset,
      sucursales: resultSucursales.recordset,
      puestos: resultPuestos.recordset,
      filtros: {
        sucursal: sucursalID,
        puesto: puestoID,
      },
    })
  } catch (error) {
    console.error("Error al listar empleados:", error)
    req.flash("error", "Error al cargar los empleados")
    res.redirect("/rrh/dashboard")
  }
}

// Mostrar formulario para crear empleado
exports.mostrarFormularioEmpleado = async (req, res) => {
  try {
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const queryPuestos = `SELECT PuestoID, NombrePuesto FROM Puestos`

    const resultSucursales = await db.ejecutarQuery(querySucursales)
    const resultPuestos = await db.ejecutarQuery(queryPuestos)

    res.render("rrh/empleado-form", {
      titulo: "Nuevo Empleado",
      empleado: {},
      sucursales: resultSucursales.recordset,
      puestos: resultPuestos.recordset,
      editar: false,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de empleado:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/rrh/empleados")
  }
}

// Crear empleado
exports.crearEmpleado = async (req, res) => {
  const {
    primerNombre,
    segundoNombre,
    primerApellido,
    segundoApellido,
    numeroIdentidad,
    correo,
    telefono,
    puestoID,
    sucursalID,
    fechaContratacion,
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

      // 3. Insertar empleado
      const queryEmpleado = `
        INSERT INTO Empleados (PersonaID, PuestoID, SucursalID, FechaContratacion)
        VALUES (@param0, @param1, @param2, @param3)
      `

      const requestEmpleado = new db.sql.Request(transaction)
      requestEmpleado.input("param0", personaID)
      requestEmpleado.input("param1", puestoID)
      requestEmpleado.input("param2", sucursalID)
      requestEmpleado.input("param3", fechaContratacion)
      await requestEmpleado.query(queryEmpleado)

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Empleado creado exitosamente")
      res.redirect("/rrh/empleados")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en creación de empleado:", error)
      req.flash("error", "Error al crear el empleado")
      res.redirect("/rrh/empleados/nuevo")
    }
  } catch (error) {
    console.error("Error en creación de empleado:", error)
    req.flash("error", "Error al crear el empleado")
    res.redirect("/rrh/empleados/nuevo")
  }
}

// Mostrar formulario para editar empleado
exports.mostrarFormularioEditarEmpleado = async (req, res) => {
  const { id } = req.params

  try {
    const queryEmpleado = `
      SELECT e.EmpleadoID, e.PersonaID, e.PuestoID, e.SucursalID, e.FechaContratacion,
             p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido,
             p.NumeroIdentidad, p.Correo
      FROM Empleados e
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      WHERE e.EmpleadoID = @param0
    `

    const queryTelefono = `
      SELECT t.Telefono
      FROM Telefonos t
      INNER JOIN Personas p ON t.PersonaID = p.PersonaID
      INNER JOIN Empleados e ON p.PersonaID = e.PersonaID
      WHERE e.EmpleadoID = @param0
    `

    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const queryPuestos = `SELECT PuestoID, NombrePuesto FROM Puestos`

    const resultEmpleado = await db.ejecutarQuery(queryEmpleado, [{ valor: id }])
    const resultTelefono = await db.ejecutarQuery(queryTelefono, [{ valor: id }])
    const resultSucursales = await db.ejecutarQuery(querySucursales)
    const resultPuestos = await db.ejecutarQuery(queryPuestos)

    if (resultEmpleado.recordset.length === 0) {
      req.flash("error", "Empleado no encontrado")
      return res.redirect("/rrh/empleados")
    }

    const empleado = resultEmpleado.recordset[0]
    empleado.telefono = resultTelefono.recordset.length > 0 ? resultTelefono.recordset[0].Telefono : ""

    res.render("rrh/empleado-form", {
      titulo: "Editar Empleado",
      empleado: empleado,
      sucursales: resultSucursales.recordset,
      puestos: resultPuestos.recordset,
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/rrh/empleados")
  }
}

// Actualizar empleado
exports.actualizarEmpleado = async (req, res) => {
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
    puestoID,
    sucursalID,
    fechaContratacion,
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
        UPDATE t
        SET t.Telefono = @param0
        FROM Telefonos t
        WHERE t.PersonaID = @param1
      `

      const requestTelefono = new db.sql.Request(transaction)
      requestTelefono.input("param0", telefono)
      requestTelefono.input("param1", personaID)
      await requestTelefono.query(queryTelefono)

      // 3. Actualizar empleado
      const queryEmpleado = `
        UPDATE Empleados
        SET PuestoID = @param0,
            SucursalID = @param1,
            FechaContratacion = @param2
        WHERE EmpleadoID = @param3
      `

      const requestEmpleado = new db.sql.Request(transaction)
      requestEmpleado.input("param0", puestoID)
      requestEmpleado.input("param1", sucursalID)
      requestEmpleado.input("param2", fechaContratacion)
      requestEmpleado.input("param3", id)
      await requestEmpleado.query(queryEmpleado)

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Empleado actualizado exitosamente")
      res.redirect("/rrh/empleados")
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en actualización de empleado:", error)
      req.flash("error", "Error al actualizar el empleado")
      res.redirect(`/rrh/empleados/editar/${id}`)
    }
  } catch (error) {
    console.error("Error en actualización de empleado:", error)
    req.flash("error", "Error al actualizar el empleado")
    res.redirect(`/rrh/empleados/editar/${id}`)
  }
}

// Listar puestos
exports.listarPuestos = async (req, res) => {
  try {
    const query = `
      SELECT PuestoID, NombrePuesto, SalarioBase, PagoComision
      FROM Puestos
      ORDER BY NombrePuesto
    `

    const result = await db.ejecutarQuery(query)

    res.render("rrh/puestos", {
      titulo: "Gestión de Puestos",
      puestos: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar puestos:", error)
    req.flash("error", "Error al cargar los puestos")
    res.redirect("/rrh/dashboard")
  }
}

// Mostrar formulario para crear puesto
exports.mostrarFormularioPuesto = (req, res) => {
  res.render("rrh/puesto-form", {
    titulo: "Nuevo Puesto",
    puesto: {},
    editar: false,
  })
}

// Crear puesto
exports.crearPuesto = async (req, res) => {
  const { nombrePuesto, salarioBase, pagoComision } = req.body

  try {
    const query = `
      INSERT INTO Puestos (NombrePuesto, SalarioBase, PagoComision)
      VALUES (@param0, @param1, @param2)
    `

    await db.ejecutarQuery(query, [{ valor: nombrePuesto }, { valor: salarioBase }, { valor: pagoComision || 0 }])

    req.flash("exito", "Puesto creado exitosamente")
    res.redirect("/rrh/puestos")
  } catch (error) {
    console.error("Error al crear puesto:", error)
    req.flash("error", "Error al crear el puesto")
    res.redirect("/rrh/puestos/nuevo")
  }
}

// Mostrar formulario para editar puesto
exports.mostrarFormularioEditarPuesto = async (req, res) => {
  const { id } = req.params

  try {
    const query = `
      SELECT PuestoID, NombrePuesto, SalarioBase, PagoComision
      FROM Puestos
      WHERE PuestoID = @param0
    `

    const result = await db.ejecutarQuery(query, [{ valor: id }])

    if (result.recordset.length === 0) {
      req.flash("error", "Puesto no encontrado")
      return res.redirect("/rrh/puestos")
    }

    res.render("rrh/puesto-form", {
      titulo: "Editar Puesto",
      puesto: result.recordset[0],
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/rrh/puestos")
  }
}

// Actualizar puesto
exports.actualizarPuesto = async (req, res) => {
  const { id } = req.params
  const { nombrePuesto, salarioBase, pagoComision } = req.body

  try {
    const query = `
      UPDATE Puestos
      SET NombrePuesto = @param0,
          SalarioBase = @param1,
          PagoComision = @param2
      WHERE PuestoID = @param3
    `

    await db.ejecutarQuery(query, [
      { valor: nombrePuesto },
      { valor: salarioBase },
      { valor: pagoComision || 0 },
      { valor: id },
    ])

    req.flash("exito", "Puesto actualizado exitosamente")
    res.redirect("/rrh/puestos")
  } catch (error) {
    console.error("Error al actualizar puesto:", error)
    req.flash("error", "Error al actualizar el puesto")
    res.redirect(`/rrh/puestos/editar/${id}`)
  }
}

// Listar turnos
exports.listarTurnos = async (req, res) => {
  try {
    const query = `
      SELECT TurnoID, NombreTurno, HoraInicio, HoraFin
      FROM Turnos
      ORDER BY HoraInicio
    `

    const result = await db.ejecutarQuery(query)

    res.render("rrh/turnos", {
      titulo: "Gestión de Turnos",
      turnos: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar turnos:", error)
    req.flash("error", "Error al cargar los turnos")
    res.redirect("/rrh/dashboard")
  }
}

// Mostrar formulario para crear turno
exports.mostrarFormularioTurno = (req, res) => {
  res.render("rrh/turno-form", {
    titulo: "Nuevo Turno",
    turno: {},
    editar: false,
  })
}

// Crear turno
exports.crearTurno = async (req, res) => {
  const { nombreTurno, horaInicio, horaFin } = req.body

  try {
    const query = `
      INSERT INTO Turnos (NombreTurno, HoraInicio, HoraFin)
      VALUES (@param0, @param1, @param2)
    `

    await db.ejecutarQuery(query, [{ valor: nombreTurno }, { valor: horaInicio }, { valor: horaFin }])

    req.flash("exito", "Turno creado exitosamente")
    res.redirect("/rrh/turnos")
  } catch (error) {
    console.error("Error al crear turno:", error)
    req.flash("error", "Error al crear el turno")
    res.redirect("/rrh/turnos/nuevo")
  }
}

// Mostrar formulario para editar turno
exports.mostrarFormularioEditarTurno = async (req, res) => {
  const { id } = req.params

  try {
    const query = `
      SELECT TurnoID, NombreTurno, HoraInicio, HoraFin
      FROM Turnos
      WHERE TurnoID = @param0
    `

    const result = await db.ejecutarQuery(query, [{ valor: id }])

    if (result.recordset.length === 0) {
      req.flash("error", "Turno no encontrado")
      return res.redirect("/rrh/turnos")
    }

    res.render("rrh/turno-form", {
      titulo: "Editar Turno",
      turno: result.recordset[0],
      editar: true,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/rrh/turnos")
  }
}

// Actualizar turno
exports.actualizarTurno = async (req, res) => {
  const { id } = req.params
  const { nombreTurno, horaInicio, horaFin } = req.body

  try {
    const query = `
      UPDATE Turnos
      SET NombreTurno = @param0,
          HoraInicio = @param1,
          HoraFin = @param2
      WHERE TurnoID = @param3
    `

    await db.ejecutarQuery(query, [{ valor: nombreTurno }, { valor: horaInicio }, { valor: horaFin }, { valor: id }])

    req.flash("exito", "Turno actualizado exitosamente")
    res.redirect("/rrh/turnos")
  } catch (error) {
    console.error("Error al actualizar turno:", error)
    req.flash("error", "Error al actualizar el turno")
    res.redirect(`/rrh/turnos/editar/${id}`)
  }
}

// Listar asignaciones de turnos
exports.listarAsignacionesTurnos = async (req, res) => {
  try {
    const sucursalID = req.query.sucursal || ""
    const fecha = req.query.fecha || ""

    // Obtener sucursales para el filtro
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    let queryAsignaciones = `
      SELECT a.AsignacionID, p.PrimerNombre, p.PrimerApellido, pu.NombrePuesto,
             s.NombreSucursal, t.NombreTurno, t.HoraInicio, t.HoraFin, a.FechaAsignacion
      FROM AsignacionTurnos a
      INNER JOIN Empleados e ON a.EmpleadoID = e.EmpleadoID
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      INNER JOIN Puestos pu ON e.PuestoID = pu.PuestoID
      INNER JOIN Sucursales s ON e.SucursalID = s.SucursalID
      INNER JOIN Turnos t ON a.TurnoID = t.TurnoID
      WHERE 1=1
    `

    const params = []

    if (sucursalID) {
      queryAsignaciones += ` AND e.SucursalID = @param${params.length}`
      params.push({ valor: sucursalID })
    }

    if (fecha) {
      queryAsignaciones += ` AND a.FechaAsignacion = @param${params.length}`
      params.push({ valor: fecha })
    }

    queryAsignaciones += ` ORDER BY a.FechaAsignacion DESC, p.PrimerApellido, p.PrimerNombre`

    const resultAsignaciones = await db.ejecutarQuery(queryAsignaciones, params)

    res.render("rrh/asignaciones-turnos", {
      titulo: "Asignación de Turnos",
      asignaciones: resultAsignaciones.recordset,
      sucursales: resultSucursales.recordset,
      filtros: {
        sucursal: sucursalID,
        fecha: fecha,
      },
    })
  } catch (error) {
    console.error("Error al listar asignaciones de turnos:", error)
    req.flash("error", "Error al cargar las asignaciones de turnos")
    res.redirect("/rrh/dashboard")
  }
}

// Mostrar formulario para crear asignación de turno
exports.mostrarFormularioAsignacionTurno = async (req, res) => {
  try {
    const queryEmpleados = `
      SELECT e.EmpleadoID, p.PrimerNombre, p.PrimerApellido, pu.NombrePuesto, s.NombreSucursal
      FROM Empleados e
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      INNER JOIN Puestos pu ON e.PuestoID = pu.PuestoID
      INNER JOIN Sucursales s ON e.SucursalID = s.SucursalID
      ORDER BY p.PrimerApellido, p.PrimerNombre
    `

    const queryTurnos = `
      SELECT TurnoID, NombreTurno, HoraInicio, HoraFin
      FROM Turnos
      ORDER BY HoraInicio
    `

    const resultEmpleados = await db.ejecutarQuery(queryEmpleados)
    const resultTurnos = await db.ejecutarQuery(queryTurnos)

    res.render("rrh/asignacion-turno-form", {
      titulo: "Nueva Asignación de Turno",
      asignacion: {},
      empleados: resultEmpleados.recordset,
      turnos: resultTurnos.recordset,
      editar: false,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de asignación de turno:", error)
    req.flash("error", "Error al cargar el formulario")
    res.redirect("/rrh/asignaciones-turnos")
  }
}

// Crear asignación de turno
exports.crearAsignacionTurno = async (req, res) => {
  const { empleadoID, turnoID, fechaAsignacion } = req.body

  try {
    const query = `
      INSERT INTO AsignacionTurnos (EmpleadoID, TurnoID, FechaAsignacion)
      VALUES (@param0, @param1, @param2)
    `

    await db.ejecutarQuery(query, [{ valor: empleadoID }, { valor: turnoID }, { valor: fechaAsignacion }])

    req.flash("exito", "Asignación de turno creada exitosamente")
    res.redirect("/rrh/asignaciones-turnos")
  } catch (error) {
    console.error("Error al crear asignación de turno:", error)
    req.flash("error", "Error al crear la asignación de turno")
    res.redirect("/rrh/asignaciones-turnos/nueva")
  }
}

// Eliminar asignación de turno
exports.eliminarAsignacionTurno = async (req, res) => {
  const { id } = req.params

  try {
    const query = `
      DELETE FROM AsignacionTurnos
      WHERE AsignacionID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Asignación de turno eliminada exitosamente")
    res.redirect("/rrh/asignaciones-turnos")
  } catch (error) {
    console.error("Error al eliminar asignación de turno:", error)
    req.flash("error", "Error al eliminar la asignación de turno")
    res.redirect("/rrh/asignaciones-turnos")
  }
}

