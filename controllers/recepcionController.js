// Controlador para recepcionista
const db = require("../config/dbConfig")

// Dashboard de recepcionista
exports.dashboard = async (req, res) => {
  try {
    // Obtener estadísticas para el dashboard
    const queryReservas = `
      SELECT 
        COUNT(*) AS TotalReservas,
        SUM(CASE WHEN EstadoReserva = 'Pendiente' THEN 1 ELSE 0 END) AS Pendientes,
        SUM(CASE WHEN EstadoReserva = 'Confirmada' THEN 1 ELSE 0 END) AS Confirmadas,
        SUM(CASE WHEN EstadoReserva = 'Cancelada' THEN 1 ELSE 0 END) AS Canceladas,
        SUM(CASE WHEN EstadoReserva = 'Completada' THEN 1 ELSE 0 END) AS Completadas
      FROM Reservas
    `

    const queryHabitaciones = `
      SELECT 
        COUNT(*) AS TotalHabitaciones,
        SUM(CASE WHEN Estado = 'Disponible' THEN 1 ELSE 0 END) AS Disponibles,
        SUM(CASE WHEN Estado = 'Ocupada' THEN 1 ELSE 0 END) AS Ocupadas,
        SUM(CASE WHEN Estado = 'Mantenimiento' THEN 1 ELSE 0 END) AS Mantenimiento
      FROM Habitaciones
    `

    // Obtener reservas recientes
    const queryReservasRecientes = `
      SELECT TOP 5 r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             p.PrimerNombre, p.PrimerApellido,
             MIN(hr.FechaInicio) AS FechaInicio, MAX(hr.FechaFin) AS FechaFin
      FROM Reservas r
      INNER JOIN HabitacionesReservas hr ON r.ReservaID = hr.ReservaID
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      INNER JOIN Clientes c ON r.ClienteID = c.ClienteID
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      GROUP BY r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal, p.PrimerNombre, p.PrimerApellido
      ORDER BY MIN(hr.FechaInicio) DESC
    `

    const resultReservas = await db.ejecutarQuery(queryReservas)
    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones)
    const resultReservasRecientes = await db.ejecutarQuery(queryReservasRecientes)

    const estadisticas = {
      reservas: resultReservas.recordset[0],
      habitaciones: resultHabitaciones.recordset[0],
    }

    res.render("recepcion/dashboard", {
      titulo: "Panel de Recepción",
      estadisticas: estadisticas,
      reservasRecientes: resultReservasRecientes.recordset,
    })
  } catch (error) {
    console.error("Error en dashboard recepción:", error)
    req.flash("error", "Error al cargar el dashboard")
    res.redirect("/")
  }
}

// Listar reservas
exports.listarReservas = async (req, res) => {
  try {
    const estado = req.query.estado || ""
    const fechaInicio = req.query.fechaInicio || ""
    const fechaFin = req.query.fechaFin || ""

    let query = `
      SELECT r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             p.PrimerNombre, p.PrimerApellido, p.Correo,
             MIN(hr.FechaInicio) AS FechaInicio, MAX(hr.FechaFin) AS FechaFin
      FROM Reservas r
      INNER JOIN HabitacionesReservas hr ON r.ReservaID = hr.ReservaID
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      INNER JOIN Clientes c ON r.ClienteID = c.ClienteID
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      WHERE 1=1
    `

    const params = []

    if (estado) {
      query += ` AND r.EstadoReserva = @param${params.length}`
      params.push({ valor: estado })
    }

    if (fechaInicio) {
      query += ` AND hr.FechaInicio >= @param${params.length}`
      params.push({ valor: fechaInicio })
    }

    if (fechaFin) {
      query += ` AND hr.FechaFin <= @param${params.length}`
      params.push({ valor: fechaFin })
    }

    query += ` GROUP BY r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal, p.PrimerNombre, p.PrimerApellido, p.Correo
               ORDER BY MIN(hr.FechaInicio) DESC`

    const result = await db.ejecutarQuery(query, params)

    res.render("recepcion/reservas", {
      titulo: "Gestión de Reservas",
      reservas: result.recordset,
      filtros: {
        estado: estado,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
      },
    })
  } catch (error) {
    console.error("Error al listar reservas:", error)
    req.flash("error", "Error al cargar las reservas")
    res.redirect("/recepcion/dashboard")
  }
}

// Ver detalle de reserva
exports.verReserva = async (req, res) => {
  const { id } = req.params

  try {
    // Obtener detalles de la reserva
    const queryReserva = `
      SELECT r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal, s.SucursalID,
             c.ClienteID, c.RTN, p.PrimerNombre, p.PrimerApellido, p.Correo
      FROM Reservas r
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      INNER JOIN Clientes c ON r.ClienteID = c.ClienteID
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      WHERE r.ReservaID = @param0
    `

    const resultReserva = await db.ejecutarQuery(queryReserva, [{ valor: id }])

    if (resultReserva.recordset.length === 0) {
      req.flash("error", "Reserva no encontrada")
      return res.redirect("/recepcion/reservas")
    }

    const reserva = resultReserva.recordset[0]

    // Obtener habitaciones de la reserva
    const queryHabitaciones = `
      SELECT h.HabitacionID, h.NumeroHabitacion, t.NombreTipo, t.Capacidad, t.PrecioPorNoche,
             hr.FechaInicio, hr.FechaFin, hr.HoraInicio, hr.HoraFin
      FROM HabitacionesReservas hr
      INNER JOIN Habitaciones h ON hr.HabitacionID = h.HabitacionID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE hr.ReservaID = @param0
    `

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones, [{ valor: id }])

    // Obtener servicios adicionales
    const queryServicios = `
      SELECT sa.ServicioID, sa.NombreServicio, sa.Precio, cs.Cantidad
      FROM ConsumoServicios cs
      INNER JOIN ServiciosAdicionales sa ON cs.ServicioID = sa.ServicioID
      WHERE cs.ReservaID = @param0
    `

    const resultServicios = await db.ejecutarQuery(queryServicios, [{ valor: id }])

    // Obtener factura si existe
    const queryFactura = `
      SELECT f.FacturaID, f.NumeroFactura, f.FechaEmision, f.SubTotal, f.ISV, f.Total
      FROM Facturas f
      WHERE f.ReservaID = @param0
    `

    const resultFactura = await db.ejecutarQuery(queryFactura, [{ valor: id }])

    // Obtener empleados para facturación
    const queryEmpleados = `
      SELECT e.EmpleadoID, p.PrimerNombre, p.PrimerApellido
      FROM Empleados e
      INNER JOIN Personas p ON e.PersonaID = p.PersonaID
      WHERE e.SucursalID = @param0
    `

    const resultEmpleados = await db.ejecutarQuery(queryEmpleados, [{ valor: reserva.SucursalID }])

    // Obtener CAI activos para facturación
    const queryCAI = `
      SELECT CAIID, CAICode
      FROM CAIControl
      WHERE SucursalID = @param0 AND Estado = 1 AND GETDATE() BETWEEN FechaInicio AND FechaFin
    `

    const resultCAI = await db.ejecutarQuery(queryCAI, [{ valor: reserva.SucursalID }])

    res.render("recepcion/detalle-reserva", {
      titulo: "Detalle de Reserva",
      reserva: reserva,
      habitaciones: resultHabitaciones.recordset,
      servicios: resultServicios.recordset,
      factura: resultFactura.recordset.length > 0 ? resultFactura.recordset[0] : null,
      empleados: resultEmpleados.recordset,
      cais: resultCAI.recordset,
    })
  } catch (error) {
    console.error("Error al ver detalle de reserva:", error)
    req.flash("error", "Error al cargar los detalles de la reserva")
    res.redirect("/recepcion/reservas")
  }
}

// Cambiar estado de reserva
exports.cambiarEstadoReserva = async (req, res) => {
  const { id } = req.params
  const { estado } = req.body

  try {
    // Verificar que el estado sea válido
    if (!["Pendiente", "Confirmada", "Cancelada", "Completada"].includes(estado)) {
      req.flash("error", "Estado de reserva no válido")
      return res.redirect(`/recepcion/reservas/${id}`)
    }

    const query = `
      UPDATE Reservas
      SET EstadoReserva = @param0
      WHERE ReservaID = @param1
    `

    await db.ejecutarQuery(query, [{ valor: estado }, { valor: id }])

    // Si se confirma la reserva, actualizar estado de habitaciones
    if (estado === "Confirmada") {
      const queryHabitaciones = `
        UPDATE h
        SET h.Estado = 'Ocupada'
        FROM Habitaciones h
        INNER JOIN HabitacionesReservas hr ON h.HabitacionID = hr.HabitacionID
        WHERE hr.ReservaID = @param0
      `

      await db.ejecutarQuery(queryHabitaciones, [{ valor: id }])
    }

    // Si se completa la reserva, liberar habitaciones
    if (estado === "Completada") {
      const queryHabitaciones = `
        UPDATE h
        SET h.Estado = 'Disponible'
        FROM Habitaciones h
        INNER JOIN HabitacionesReservas hr ON h.HabitacionID = hr.HabitacionID
        WHERE hr.ReservaID = @param0
      `

      await db.ejecutarQuery(queryHabitaciones, [{ valor: id }])
    }

    req.flash("exito", "Estado de reserva actualizado exitosamente")
    res.redirect(`/recepcion/reservas/${id}`)
  } catch (error) {
    console.error("Error al cambiar estado de reserva:", error)
    req.flash("error", "Error al actualizar el estado de la reserva")
    res.redirect(`/recepcion/reservas/${id}`)
  }
}

// Agregar servicio a reserva
exports.agregarServicio = async (req, res) => {
  const { id } = req.params
  const { servicioID, cantidad } = req.body

  try {
    const query = `
      INSERT INTO ConsumoServicios (ReservaID, ServicioID, FechaConsumo, Cantidad)
      VALUES (@param0, @param1, GETDATE(), @param2)
    `

    await db.ejecutarQuery(query, [{ valor: id }, { valor: servicioID }, { valor: cantidad }])

    req.flash("exito", "Servicio agregado exitosamente")
    res.redirect(`/recepcion/reservas/${id}`)
  } catch (error) {
    console.error("Error al agregar servicio:", error)
    req.flash("error", "Error al agregar el servicio")
    res.redirect(`/recepcion/reservas/${id}`)
  }
}

// Generar factura
exports.generarFactura = async (req, res) => {
  const { id } = req.params
  const { caiID, empleadoID } = req.body

  try {
    // Verificar que la reserva exista y no tenga factura
    const queryVerificar = `
      SELECT r.ReservaID, r.SucursalID, r.TotalEstadia
      FROM Reservas r
      LEFT JOIN Facturas f ON r.ReservaID = f.ReservaID
      WHERE r.ReservaID = @param0 AND f.FacturaID IS NULL
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "No se puede generar factura para esta reserva")
      return res.redirect(`/recepcion/reservas/${id}`)
    }

    const reserva = resultVerificar.recordset[0]

    // Obtener último número de factura para la sucursal
    const queryUltimaFactura = `
      SELECT TOP 1 NumeroFactura
      FROM Facturas
      WHERE SucursalID = @param0
      ORDER BY FacturaID DESC
    `

    const resultUltimaFactura = await db.ejecutarQuery(queryUltimaFactura, [{ valor: reserva.SucursalID }])

    let numeroFactura = "000-001-01-00000001"

    if (resultUltimaFactura.recordset.length > 0) {
      const ultimoNumero = resultUltimaFactura.recordset[0].NumeroFactura
      const partes = ultimoNumero.split("-")
      const consecutivo = Number.parseInt(partes[3]) + 1
      numeroFactura = `${partes[0]}-${partes[1]}-${partes[2]}-${consecutivo.toString().padStart(8, "0")}`
    }

    // Calcular subtotal, ISV y total
    const subtotal = reserva.TotalEstadia
    const isv = subtotal * 0.15 // 15% de ISV
    const total = subtotal + isv

    // Insertar factura
    const queryFactura = `
      INSERT INTO Facturas (ReservaID, CAIID, SucursalID, EmpleadoID, NumeroFactura, FechaEmision, SubTotal, ISV, Total, EstadoFactura)
      VALUES (@param0, @param1, @param2, @param3, @param4, GETDATE(), @param5, @param6, @param7, 1)
    `

    await db.ejecutarQuery(queryFactura, [
      { valor: id },
      { valor: caiID },
      { valor: reserva.SucursalID },
      { valor: empleadoID },
      { valor: numeroFactura },
      { valor: subtotal },
      { valor: isv },
      { valor: total },
    ])

    req.flash("exito", "Factura generada exitosamente")
    res.redirect(`/recepcion/reservas/${id}`)
  } catch (error) {
    console.error("Error al generar factura:", error)
    req.flash("error", "Error al generar la factura")
    res.redirect(`/recepcion/reservas/${id}`)
  }
}

// Listar clientes
exports.listarClientes = async (req, res) => {
  try {
    const busqueda = req.query.busqueda || ""

    let query = `
      SELECT c.ClienteID, p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido,
             p.NumeroIdentidad, p.Correo, c.RTN, c.FechaRegistro
      FROM Clientes c
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      WHERE 1=1
    `

    const params = []

    if (busqueda) {
      query += ` AND (p.PrimerNombre LIKE @param${params.length} OR p.PrimerApellido LIKE @param${params.length} OR p.NumeroIdentidad LIKE @param${params.length} OR p.Correo LIKE @param${params.length})`
      params.push({ valor: `%${busqueda}%` })
    }

    query += ` ORDER BY p.PrimerApellido, p.PrimerNombre`

    const result = await db.ejecutarQuery(query, params)

    res.render("recepcion/clientes", {
      titulo: "Gestión de Clientes",
      clientes: result.recordset,
      busqueda: busqueda,
    })
  } catch (error) {
    console.error("Error al listar clientes:", error)
    req.flash("error", "Error al cargar los clientes")
    res.redirect("/recepcion/dashboard")
  }
}

// Ver detalle de cliente
exports.verCliente = async (req, res) => {
  const { id } = req.params

  try {
    // Obtener datos del cliente
    const queryCliente = `
      SELECT c.ClienteID, p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido,
             p.NumeroIdentidad, p.Correo, c.RTN, c.FechaRegistro
      FROM Clientes c
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      WHERE c.ClienteID = @param0
    `

    const resultCliente = await db.ejecutarQuery(queryCliente, [{ valor: id }])

    if (resultCliente.recordset.length === 0) {
      req.flash("error", "Cliente no encontrado")
      return res.redirect("/recepcion/clientes")
    }

    const cliente = resultCliente.recordset[0]

    // Obtener teléfonos del cliente
    const queryTelefonos = `
      SELECT t.Telefono, tt.TipoTelefonoNombre
      FROM Telefonos t
      INNER JOIN TipoTelefono tt ON t.TipoTelefonoID = tt.TipoTelefonoID
      INNER JOIN Personas p ON t.PersonaID = p.PersonaID
      INNER JOIN Clientes c ON p.PersonaID = c.PersonaID
      WHERE c.ClienteID = @param0
    `

    const resultTelefonos = await db.ejecutarQuery(queryTelefonos, [{ valor: id }])

    // Obtener direcciones del cliente
    const queryDirecciones = `
      SELECT d.DetalleDireccion, col.NombreColonia, c.NombreCiudad, dep.NombreDepartamento, p.NombrePais
      FROM Direcciones d
      INNER JOIN Colonias col ON d.ColoniaID = col.ColoniaID
      INNER JOIN Ciudades c ON col.CiudadID = c.CiudadID
      INNER JOIN Departamentos dep ON c.DepartamentoID = dep.DepartamentoID
      INNER JOIN Paises p ON dep.PaisID = p.PaisID
      INNER JOIN Personas per ON d.PersonaID = per.PersonaID
      INNER JOIN Clientes cli ON per.PersonaID = cli.PersonaID
      WHERE cli.ClienteID = @param0
    `

    const resultDirecciones = await db.ejecutarQuery(queryDirecciones, [{ valor: id }])

    // Obtener historial de reservas
    const queryReservas = `
      SELECT r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             MIN(hr.FechaInicio) AS FechaInicio, MAX(hr.FechaFin) AS FechaFin
      FROM Reservas r
      INNER JOIN HabitacionesReservas hr ON r.ReservaID = hr.ReservaID
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      WHERE r.ClienteID = @param0
      GROUP BY r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal
      ORDER BY MIN(hr.FechaInicio) DESC
    `

    const resultReservas = await db.ejecutarQuery(queryReservas, [{ valor: id }])

    res.render("recepcion/detalle-cliente", {
      titulo: "Detalle de Cliente",
      cliente: cliente,
      telefonos: resultTelefonos.recordset,
      direcciones: resultDirecciones.recordset,
      reservas: resultReservas.recordset,
    })
  } catch (error) {
    console.error("Error al ver detalle de cliente:", error)
    req.flash("error", "Error al cargar los detalles del cliente")
    res.redirect("/recepcion/clientes")
  }
}

// Listar habitaciones
exports.listarHabitaciones = async (req, res) => {
  try {
    const sucursalID = req.query.sucursal || ""
    const estado = req.query.estado || ""

    // Obtener sucursales para el filtro
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

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

    res.render("recepcion/habitaciones", {
      titulo: "Estado de Habitaciones",
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
    res.redirect("/recepcion/dashboard")
  }
}

// Cambiar estado de habitación
exports.cambiarEstadoHabitacion = async (req, res) => {
  const { id } = req.params
  const { estado } = req.body

  try {
    // Verificar que el estado sea válido
    if (!["Disponible", "Ocupada", "Mantenimiento"].includes(estado)) {
      req.flash("error", "Estado de habitación no válido")
      return res.redirect("/recepcion/habitaciones")
    }

    const query = `
      UPDATE Habitaciones
      SET Estado = @param0
      WHERE HabitacionID = @param1
    `

    await db.ejecutarQuery(query, [{ valor: estado }, { valor: id }])

    req.flash("exito", "Estado de habitación actualizado exitosamente")
    res.redirect("/recepcion/habitaciones")
  } catch (error) {
    console.error("Error al cambiar estado de habitación:", error)
    req.flash("error", "Error al actualizar el estado de la habitación")
    res.redirect("/recepcion/habitaciones")
  }
}

