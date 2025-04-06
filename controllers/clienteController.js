// Controlador para cliente
const db = require("../config/dbConfig")

// Dashboard de cliente
exports.dashboard = async (req, res) => {
  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/")
    }

    // Obtener reservas recientes
    const queryReservas = `
      SELECT TOP 5 r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             MIN(hr.FechaInicio) AS FechaInicio, MAX(hr.FechaFin) AS FechaFin
      FROM Reservas r
      INNER JOIN HabitacionesReservas hr ON r.ReservaID = hr.ReservaID
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      WHERE r.ClienteID = @param0
      GROUP BY r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal
      ORDER BY MIN(hr.FechaInicio) DESC
    `

    const resultReservas = await db.ejecutarQuery(queryReservas, [{ valor: clienteID }])

    // Obtener habitaciones disponibles para mostrar algunas opciones
    const queryHabitaciones = `
      SELECT TOP 4 h.HabitacionID, h.NumeroHabitacion, s.NombreSucursal, 
             t.NombreTipo, t.Capacidad, t.PrecioPorNoche, t.Descripcion
      FROM Habitaciones h
      INNER JOIN Sucursales s ON h.SucursalID = s.SucursalID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE h.Estado = 'Disponible'
      ORDER BY NEWID()
    `

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones)

    res.render("cliente/dashboard", {
      titulo: "Mi Panel",
      reservas: resultReservas.recordset,
      habitaciones: resultHabitaciones.recordset,
    })
  } catch (error) {
    console.error("Error en dashboard cliente:", error)
    req.flash("error", "Error al cargar el dashboard")
    res.redirect("/")
  }
}

// Modificar la función buscarHabitaciones para permitir seleccionar múltiples habitaciones
exports.buscarHabitaciones = async (req, res) => {
  const { sucursal, fechaInicio, fechaFin, capacidad } = req.query

  try {
    // Obtener sucursales para el formulario de búsqueda
    const querySucursales = `SELECT SucursalID, NombreSucursal FROM Sucursales`
    const resultSucursales = await db.ejecutarQuery(querySucursales)

    // Si no hay parámetros de búsqueda, mostrar solo el formulario
    if (!fechaInicio || !fechaFin) {
      return res.render("cliente/buscar-habitaciones", {
        titulo: "Buscar Habitaciones",
        sucursales: resultSucursales.recordset,
        habitaciones: [],
        filtros: {},
        habitacionesSeleccionadas: [],
      })
    }

    // Consulta para buscar habitaciones disponibles
    let queryHabitaciones = `
      SELECT h.HabitacionID, h.NumeroHabitacion, s.NombreSucursal, s.SucursalID,
             t.NombreTipo, t.Capacidad, t.PrecioPorNoche, t.Descripcion
      FROM Habitaciones h
      INNER JOIN Sucursales s ON h.SucursalID = s.SucursalID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE h.Estado = 'Disponible'
      AND h.HabitacionID NOT IN (
        SELECT hr.HabitacionID
        FROM HabitacionesReservas hr
        WHERE (hr.FechaInicio <= @param1 AND hr.FechaFin >= @param0)
      )
    `

    const params = [{ valor: fechaInicio }, { valor: fechaFin }]

    if (sucursal) {
      queryHabitaciones += ` AND s.SucursalID = @param${params.length}`
      params.push({ valor: sucursal })
    }

    if (capacidad) {
      queryHabitaciones += ` AND t.Capacidad >= @param${params.length}`
      params.push({ valor: capacidad })
    }

    queryHabitaciones += ` ORDER BY t.PrecioPorNoche`

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones, params)

    // Calcular número de noches para mostrar precio total
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    const numNoches = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24))

    // Obtener habitaciones seleccionadas de la sesión
    const habitacionesSeleccionadas = req.session.habitacionesSeleccionadas || []

    res.render("cliente/buscar-habitaciones", {
      titulo: "Buscar Habitaciones",
      sucursales: resultSucursales.recordset,
      habitaciones: resultHabitaciones.recordset,
      numNoches: numNoches,
      filtros: {
        sucursal,
        fechaInicio,
        fechaFin,
        capacidad,
      },
      habitacionesSeleccionadas: habitacionesSeleccionadas,
    })
  } catch (error) {
    console.error("Error al buscar habitaciones:", error)
    req.flash("error", "Error al buscar habitaciones")
    res.redirect("/cliente/dashboard")
  }
}

// Agregar función para seleccionar habitación
exports.seleccionarHabitacion = async (req, res) => {
  const { habitacionID, fechaInicio, fechaFin } = req.body

  try {
    // Obtener información de la habitación
    const queryHabitacion = `
      SELECT h.HabitacionID, h.NumeroHabitacion, s.SucursalID, s.NombreSucursal,
             t.NombreTipo, t.Capacidad, t.PrecioPorNoche, t.Descripcion
      FROM Habitaciones h
      INNER JOIN Sucursales s ON h.SucursalID = s.SucursalID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE h.HabitacionID = @param0
    `

    const resultHabitacion = await db.ejecutarQuery(queryHabitacion, [{ valor: habitacionID }])

    if (resultHabitacion.recordset.length === 0) {
      req.flash("error", "Habitación no encontrada")
      return res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
    }

    const habitacion = resultHabitacion.recordset[0]

    // Calcular número de noches y precio total
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    const numNoches = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24))
    const precioTotal = numNoches * habitacion.PrecioPorNoche

    // Crear objeto con la información de la habitación seleccionada
    const habitacionSeleccionada = {
      habitacionID: habitacion.HabitacionID,
      numeroHabitacion: habitacion.NumeroHabitacion,
      sucursalID: habitacion.SucursalID,
      nombreSucursal: habitacion.NombreSucursal,
      nombreTipo: habitacion.NombreTipo,
      capacidad: habitacion.Capacidad,
      precioPorNoche: habitacion.PrecioPorNoche,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      numNoches: numNoches,
      precioTotal: precioTotal,
    }

    // Inicializar array de habitaciones seleccionadas si no existe
    if (!req.session.habitacionesSeleccionadas) {
      req.session.habitacionesSeleccionadas = []
    }

    // Verificar si la habitación ya está seleccionada
    const habitacionExistente = req.session.habitacionesSeleccionadas.find(
      (h) => h.habitacionID === habitacion.HabitacionID,
    )

    if (habitacionExistente) {
      req.flash("error", "Esta habitación ya está seleccionada")
    } else {
      // Agregar habitación a la lista de seleccionadas
      req.session.habitacionesSeleccionadas.push(habitacionSeleccionada)
      req.flash("exito", "Habitación agregada a la selección")
    }

    res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
  } catch (error) {
    console.error("Error al seleccionar habitación:", error)
    req.flash("error", "Error al seleccionar la habitación")
    res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
  }
}

// Agregar función para quitar habitación seleccionada
exports.quitarHabitacionSeleccionada = async (req, res) => {
  const { habitacionID, fechaInicio, fechaFin } = req.body

  try {
    // Verificar si hay habitaciones seleccionadas
    if (!req.session.habitacionesSeleccionadas) {
      req.flash("error", "No hay habitaciones seleccionadas")
      return res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
    }

    // Filtrar la habitación a quitar
    req.session.habitacionesSeleccionadas = req.session.habitacionesSeleccionadas.filter(
      (h) => h.habitacionID != habitacionID,
    )

    req.flash("exito", "Habitación quitada de la selección")
    res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
  } catch (error) {
    console.error("Error al quitar habitación:", error)
    req.flash("error", "Error al quitar la habitación")
    res.redirect(`/cliente/buscar-habitaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
  }
}

// Modificar la función mostrarFormularioReserva para usar múltiples habitaciones
exports.mostrarFormularioReserva = async (req, res) => {
  try {
    // Verificar si hay habitaciones seleccionadas
    if (!req.session.habitacionesSeleccionadas || req.session.habitacionesSeleccionadas.length === 0) {
      req.flash("error", "No hay habitaciones seleccionadas para reservar")
      return res.redirect("/cliente/buscar-habitaciones")
    }

    const habitacionesSeleccionadas = req.session.habitacionesSeleccionadas

    // Obtener la primera habitación para determinar la sucursal
    const primeraHabitacion = habitacionesSeleccionadas[0]
    const sucursalID = primeraHabitacion.sucursalID

    // Verificar que todas las habitaciones sean de la misma sucursal
    const todasMismaSucursal = habitacionesSeleccionadas.every((h) => h.sucursalID === sucursalID)

    if (!todasMismaSucursal) {
      req.flash("error", "Todas las habitaciones deben ser de la misma sucursal")
      return res.redirect("/cliente/buscar-habitaciones")
    }

    // Obtener servicios adicionales disponibles
    const queryServicios = `
      SELECT sa.ServicioID, sa.NombreServicio, sa.Precio
      FROM ServiciosAdicionales sa
      INNER JOIN ServiciosPorDepartamento spd ON sa.ServicioID = spd.ServicioID
      INNER JOIN DepartamentosServicios ds ON spd.DepartamentoID = ds.DepartamentoID
      WHERE ds.SucursalID = @param0
      ORDER BY sa.NombreServicio
    `

    const resultServicios = await db.ejecutarQuery(queryServicios, [{ valor: sucursalID }])

    // Calcular precio total de todas las habitaciones
    const precioTotalHabitaciones = habitacionesSeleccionadas.reduce((total, h) => total + h.precioTotal, 0)

    res.render("cliente/crear-reserva", {
      titulo: "Crear Reserva",
      habitaciones: habitacionesSeleccionadas,
      servicios: resultServicios.recordset,
      precioTotal: precioTotalHabitaciones,
      sucursalID: sucursalID,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de reserva:", error)
    req.flash("error", "Error al cargar el formulario de reserva")
    res.redirect("/cliente/buscar-habitaciones")
  }
}

// Modificar la función crearReserva para usar múltiples habitaciones
exports.crearReserva = async (req, res) => {
  const {
    sucursalID,
    precioTotal,
    servicios, // Array de IDs de servicios seleccionados
  } = req.body

  try {
    // Verificar si hay habitaciones seleccionadas
    if (!req.session.habitacionesSeleccionadas || req.session.habitacionesSeleccionadas.length === 0) {
      req.flash("error", "No hay habitaciones seleccionadas para reservar")
      return res.redirect("/cliente/buscar-habitaciones")
    }

    const habitacionesSeleccionadas = req.session.habitacionesSeleccionadas

    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // 1. Crear la reserva
      const queryReserva = `
        INSERT INTO Reservas (ClienteID, SucursalID, EstadoReserva, TotalEstadia)
        OUTPUT INSERTED.ReservaID
        VALUES (@param0, @param1, 'Pendiente', @param2)
      `

      const requestReserva = new db.sql.Request(transaction)
      requestReserva.input("param0", clienteID)
      requestReserva.input("param1", sucursalID)
      requestReserva.input("param2", precioTotal)

      const resultReserva = await requestReserva.query(queryReserva)
      const reservaID = resultReserva.recordset[0].ReservaID

      // 2. Asignar habitaciones a la reserva
      for (const habitacion of habitacionesSeleccionadas) {
        const queryHabitacionReserva = `
          INSERT INTO HabitacionesReservas (HabitacionID, ReservaID, FechaInicio, FechaFin, HoraInicio, HoraFin)
          VALUES (@param0, @param1, @param2, @param3, @param4, @param5)
        `

        const requestHabitacionReserva = new db.sql.Request(transaction)
        requestHabitacionReserva.input("param0", habitacion.habitacionID)
        requestHabitacionReserva.input("param1", reservaID)
        requestHabitacionReserva.input("param2", habitacion.fechaInicio)
        requestHabitacionReserva.input("param3", habitacion.fechaFin)
        requestHabitacionReserva.input("param4", "14:00")
        requestHabitacionReserva.input("param5", "12:00")

        await requestHabitacionReserva.query(queryHabitacionReserva)
      }

      // 3. Agregar servicios adicionales si se seleccionaron
      if (servicios && servicios.length > 0) {
        for (const servicioID of servicios) {
          const queryConsumoServicio = `
            INSERT INTO ConsumoServicios (ReservaID, ServicioID, FechaConsumo, Cantidad)
            VALUES (@param0, @param1, GETDATE(), 1)
          `

          const requestConsumoServicio = new db.sql.Request(transaction)
          requestConsumoServicio.input("param0", reservaID)
          requestConsumoServicio.input("param1", servicioID)

          await requestConsumoServicio.query(queryConsumoServicio)
        }
      }

      // Confirmar transacción
      await transaction.commit()

      // Limpiar habitaciones seleccionadas de la sesión
      req.session.habitacionesSeleccionadas = []

      req.flash("exito", "Reserva creada exitosamente")
      res.redirect(`/cliente/mis-reservas`)
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error en creación de reserva:", error)
      req.flash("error", "Error al crear la reserva")
      res.redirect("/cliente/buscar-habitaciones")
    }
  } catch (error) {
    console.error("Error en creación de reserva:", error)
    req.flash("error", "Error al crear la reserva")
    res.redirect("/cliente/buscar-habitaciones")
  }
}

// Listar reservas del cliente
exports.listarReservas = async (req, res) => {
  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    const query = `
      SELECT r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             MIN(hr.FechaInicio) AS FechaInicio, MAX(hr.FechaFin) AS FechaFin
      FROM Reservas r
      INNER JOIN HabitacionesReservas hr ON r.ReservaID = hr.ReservaID
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      WHERE r.ClienteID = @param0
      GROUP BY r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal
      ORDER BY MIN(hr.FechaInicio) DESC
    `

    const result = await db.ejecutarQuery(query, [{ valor: clienteID }])

    res.render("cliente/mis-reservas", {
      titulo: "Mis Reservas",
      reservas: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar reservas:", error)
    req.flash("error", "Error al cargar las reservas")
    res.redirect("/cliente/dashboard")
  }
}

// Ver detalle de reserva
exports.verReserva = async (req, res) => {
  const { id } = req.params

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la reserva pertenezca al cliente
    const queryVerificar = `
      SELECT ReservaID
      FROM Reservas
      WHERE ReservaID = @param0 AND ClienteID = @param1
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "Reserva no encontrada")
      return res.redirect("/cliente/mis-reservas")
    }

    // Obtener detalles de la reserva
    const queryReserva = `
      SELECT r.ReservaID, r.EstadoReserva, r.TotalEstadia, s.NombreSucursal,
             c.RTN, p.PrimerNombre, p.PrimerApellido, p.Correo
      FROM Reservas r
      INNER JOIN Sucursales s ON r.SucursalID = s.SucursalID
      INNER JOIN Clientes c ON r.ClienteID = c.ClienteID
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      WHERE r.ReservaID = @param0
    `

    const resultReserva = await db.ejecutarQuery(queryReserva, [{ valor: id }])

    if (resultReserva.recordset.length === 0) {
      req.flash("error", "Reserva no encontrada")
      return res.redirect("/cliente/mis-reservas")
    }

    const reserva = resultReserva.recordset[0]

    // Obtener habitaciones de la reserva
    const queryHabitaciones = `
      SELECT h.NumeroHabitacion, t.NombreTipo, t.Capacidad, t.PrecioPorNoche,
             hr.FechaInicio, hr.FechaFin, hr.HoraInicio, hr.HoraFin
      FROM HabitacionesReservas hr
      INNER JOIN Habitaciones h ON hr.HabitacionID = h.HabitacionID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      WHERE hr.ReservaID = @param0
    `

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones, [{ valor: id }])

    // Obtener servicios adicionales
    const queryServicios = `
      SELECT sa.NombreServicio, sa.Precio, cs.Cantidad
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

    res.render("cliente/detalle-reserva", {
      titulo: "Detalle de Reserva",
      reserva: reserva,
      habitaciones: resultHabitaciones.recordset,
      servicios: resultServicios.recordset,
      factura: resultFactura.recordset.length > 0 ? resultFactura.recordset[0] : null,
    })
  } catch (error) {
    console.error("Error al ver detalle de reserva:", error)
    req.flash("error", "Error al cargar los detalles de la reserva")
    res.redirect("/cliente/mis-reservas")
  }
}

// Cancelar reserva
exports.cancelarReserva = async (req, res) => {
  const { id } = req.params

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la reserva pertenezca al cliente y esté en estado Pendiente
    const queryVerificar = `
      SELECT ReservaID
      FROM Reservas
      WHERE ReservaID = @param0 AND ClienteID = @param1 AND EstadoReserva = 'Pendiente'
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "No se puede cancelar esta reserva")
      return res.redirect("/cliente/mis-reservas")
    }

    // Actualizar estado de la reserva
    const query = `
      UPDATE Reservas
      SET EstadoReserva = 'Cancelada'
      WHERE ReservaID = @param0
    `

    await db.ejecutarQuery(query, [{ valor: id }])

    req.flash("exito", "Reserva cancelada exitosamente")
    res.redirect("/cliente/mis-reservas")
  } catch (error) {
    console.error("Error al cancelar reserva:", error)
    req.flash("error", "Error al cancelar la reserva")
    res.redirect("/cliente/mis-reservas")
  }
}

// Listar facturas del cliente
exports.listarFacturas = async (req, res) => {
  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    const query = `
      SELECT f.FacturaID, f.NumeroFactura, f.FechaEmision, f.SubTotal, f.ISV, f.Total,
             s.NombreSucursal, r.ReservaID
      FROM Facturas f
      INNER JOIN Reservas r ON f.ReservaID = r.ReservaID
      INNER JOIN Sucursales s ON f.SucursalID = s.SucursalID
      WHERE r.ClienteID = @param0
      ORDER BY f.FechaEmision DESC
    `

    const result = await db.ejecutarQuery(query, [{ valor: clienteID }])

    res.render("cliente/facturas", {
      titulo: "Mis Facturas",
      facturas: result.recordset,
    })
  } catch (error) {
    console.error("Error al listar facturas:", error)
    req.flash("error", "Error al cargar las facturas")
    res.redirect("/cliente/dashboard")
  }
}

// Ver factura
exports.verFactura = async (req, res) => {
  const { id } = req.params

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la factura pertenezca al cliente
    const queryVerificar = `
      SELECT f.FacturaID
      FROM Facturas f
      INNER JOIN Reservas r ON f.ReservaID = r.ReservaID
      WHERE f.FacturaID = @param0 AND r.ClienteID = @param1
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "Factura no encontrada")
      return res.redirect("/cliente/facturas")
    }

    // Obtener detalles de la factura
    const queryFactura = `
      SELECT f.FacturaID, f.NumeroFactura, f.FechaEmision, f.SubTotal, f.ISV, f.Total,
             s.NombreSucursal, s.Direccion AS DireccionSucursal, s.Telefono AS TelefonoSucursal,
             c.RTN, p.PrimerNombre, p.PrimerApellido, p.Correo,
             cai.CAICode
      FROM Facturas f
      INNER JOIN Reservas r ON f.ReservaID = r.ReservaID
      INNER JOIN Sucursales s ON f.SucursalID = s.SucursalID
      INNER JOIN Clientes c ON r.ClienteID = c.ClienteID
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      INNER JOIN CAIControl cai ON f.CAIID = cai.CAIID
      WHERE f.FacturaID = @param0
    `

    const resultFactura = await db.ejecutarQuery(queryFactura, [{ valor: id }])

    if (resultFactura.recordset.length === 0) {
      req.flash("error", "Factura no encontrada")
      return res.redirect("/cliente/facturas")
    }

    const factura = resultFactura.recordset[0]

    // Obtener detalles de la reserva (habitaciones)
    const queryHabitaciones = `
      SELECT h.NumeroHabitacion, t.NombreTipo, t.PrecioPorNoche,
             DATEDIFF(DAY, hr.FechaInicio, hr.FechaFin) AS NumNoches,
             t.PrecioPorNoche * DATEDIFF(DAY, hr.FechaInicio, hr.FechaFin) AS Subtotal
      FROM HabitacionesReservas hr
      INNER JOIN Habitaciones h ON hr.HabitacionID = h.HabitacionID
      INNER JOIN TipoHabitaciones t ON h.TipoHabitacionID = t.TipoHabitacionID
      INNER JOIN Reservas r ON hr.ReservaID = r.ReservaID
      INNER JOIN Facturas f ON r.ReservaID = f.ReservaID
      WHERE f.FacturaID = @param0
    `

    const resultHabitaciones = await db.ejecutarQuery(queryHabitaciones, [{ valor: id }])

    // Obtener servicios adicionales
    const queryServicios = `
      SELECT sa.NombreServicio, sa.Precio, cs.Cantidad, sa.Precio * cs.Cantidad AS Subtotal
      FROM ConsumoServicios cs
      INNER JOIN ServiciosAdicionales sa ON cs.ServicioID = sa.ServicioID
      INNER JOIN Reservas r ON cs.ReservaID = r.ReservaID
      INNER JOIN Facturas f ON r.ReservaID = f.ReservaID
      WHERE f.FacturaID = @param0
    `

    const resultServicios = await db.ejecutarQuery(queryServicios, [{ valor: id }])

    res.render("cliente/ver-factura", {
      titulo: "Ver Factura",
      factura: factura,
      habitaciones: resultHabitaciones.recordset,
      servicios: resultServicios.recordset,
    })
  } catch (error) {
    console.error("Error al ver factura:", error)
    req.flash("error", "Error al cargar los detalles de la factura")
    res.redirect("/cliente/facturas")
  }
}

// Generar factura para una reserva
exports.generarFactura = async (req, res) => {
  const { id } = req.params // ID de la reserva

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la reserva pertenezca al cliente y no tenga factura
    const queryVerificar = `
      SELECT r.ReservaID, r.SucursalID, r.TotalEstadia, r.EstadoReserva
      FROM Reservas r
      LEFT JOIN Facturas f ON r.ReservaID = f.ReservaID
      WHERE r.ReservaID = @param0 AND r.ClienteID = @param1 AND f.FacturaID IS NULL
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "No se puede generar factura para esta reserva")
      return res.redirect(`/cliente/mis-reservas/${id}`)
    }

    const reserva = resultVerificar.recordset[0]

    // Verificar que la reserva esté confirmada o completada
    if (reserva.EstadoReserva !== "Confirmada" && reserva.EstadoReserva !== "Completada") {
      req.flash("error", "Solo se pueden generar facturas para reservas confirmadas o completadas")
      return res.redirect(`/cliente/mis-reservas/${id}`)
    }

    // Obtener CAI activo para la sucursal
    const queryCAI = `
      SELECT CAIID, CAICode
      FROM CAIControl
      WHERE SucursalID = @param0 AND Estado = 1 AND GETDATE() BETWEEN FechaInicio AND FechaFin
    `

    const resultCAI = await db.ejecutarQuery(queryCAI, [{ valor: reserva.SucursalID }])

    if (resultCAI.recordset.length === 0) {
      req.flash("error", "No hay CAI disponible para generar la factura")
      return res.redirect(`/cliente/mis-reservas/${id}`)
    }

    const cai = resultCAI.recordset[0]

    // Obtener un empleado de la sucursal para la factura
    const queryEmpleado = `
      SELECT TOP 1 EmpleadoID
      FROM Empleados
      WHERE SucursalID = @param0
    `

    const resultEmpleado = await db.ejecutarQuery(queryEmpleado, [{ valor: reserva.SucursalID }])

    if (resultEmpleado.recordset.length === 0) {
      req.flash("error", "No hay empleados disponibles para generar la factura")
      return res.redirect(`/cliente/mis-reservas/${id}`)
    }

    const empleadoID = resultEmpleado.recordset[0].EmpleadoID

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

    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // Insertar factura
      const queryFactura = `
        INSERT INTO Facturas (ReservaID, CAIID, SucursalID, EmpleadoID, NumeroFactura, FechaEmision, SubTotal, ISV, Total, EstadoFactura)
        OUTPUT INSERTED.FacturaID
        VALUES (@param0, @param1, @param2, @param3, @param4, GETDATE(), @param5, @param6, @param7, 0)
      `

      const requestFactura = new db.sql.Request(transaction)
      requestFactura.input("param0", id)
      requestFactura.input("param1", cai.CAIID)
      requestFactura.input("param2", reserva.SucursalID)
      requestFactura.input("param3", empleadoID)
      requestFactura.input("param4", numeroFactura)
      requestFactura.input("param5", subtotal)
      requestFactura.input("param6", isv)
      requestFactura.input("param7", total)

      const resultFactura = await requestFactura.query(queryFactura)
      const facturaID = resultFactura.recordset[0].FacturaID

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Factura generada exitosamente")
      res.redirect(`/cliente/facturas/${facturaID}`)
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error al generar factura:", error)
      req.flash("error", "Error al generar la factura")
      res.redirect(`/cliente/mis-reservas/${id}`)
    }
  } catch (error) {
    console.error("Error al generar factura:", error)
    req.flash("error", "Error al generar la factura")
    res.redirect(`/cliente/mis-reservas/${id}`)
  }
}

// Mostrar formulario de pago
exports.mostrarFormularioPago = async (req, res) => {
  const { id } = req.params // ID de la factura

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la factura pertenezca al cliente
    const queryVerificar = `
      SELECT f.FacturaID, f.NumeroFactura, f.Total, f.EstadoFactura, r.ReservaID
      FROM Facturas f
      INNER JOIN Reservas r ON f.ReservaID = r.ReservaID
      WHERE f.FacturaID = @param0 AND r.ClienteID = @param1
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "Factura no encontrada")
      return res.redirect("/cliente/facturas")
    }

    const factura = resultVerificar.recordset[0]

    // Verificar que la factura no esté pagada
    if (factura.EstadoFactura === 1) {
      req.flash("info", "Esta factura ya está pagada")
      return res.redirect(`/cliente/facturas/${id}`)
    }

    // Obtener métodos de pago disponibles
    const queryMetodosPago = `
      SELECT MetodoPagoID, Metodo
      FROM MetodosPago
      ORDER BY Metodo
    `

    const resultMetodosPago = await db.ejecutarQuery(queryMetodosPago)

    // Obtener pagos realizados para esta factura
    const queryPagos = `
      SELECT p.PagoID, p.FechaPago, p.Monto, mp.Metodo
      FROM Pagos p
      INNER JOIN MetodosPago mp ON p.MetodoPagoID = mp.MetodoPagoID
      WHERE p.FacturaID = @param0
      ORDER BY p.FechaPago DESC
    `

    const resultPagos = await db.ejecutarQuery(queryPagos, [{ valor: id }])

    // Calcular monto total pagado
    let montoPagado = 0
    if (resultPagos.recordset.length > 0) {
      montoPagado = resultPagos.recordset.reduce((total, pago) => total + pago.Monto, 0)
    }

    // Calcular monto pendiente
    const montoPendiente = factura.Total - montoPagado

    res.render("cliente/realizar-pago", {
      titulo: "Realizar Pago",
      factura: factura,
      metodosPago: resultMetodosPago.recordset,
      pagos: resultPagos.recordset,
      montoPagado: montoPagado,
      montoPendiente: montoPendiente,
    })
  } catch (error) {
    console.error("Error al mostrar formulario de pago:", error)
    req.flash("error", "Error al cargar el formulario de pago")
    res.redirect("/cliente/facturas")
  }
}

// Procesar pago
exports.procesarPago = async (req, res) => {
  const { id } = req.params // ID de la factura
  const { metodoPagoID, monto } = req.body

  try {
    const clienteID = await obtenerClienteID(req.session.usuario.id)

    if (!clienteID) {
      req.flash("error", "No se encontró el perfil de cliente")
      return res.redirect("/cliente/dashboard")
    }

    // Verificar que la factura pertenezca al cliente
    const queryVerificar = `
      SELECT f.FacturaID, f.Total, f.EstadoFactura, r.ReservaID, r.SucursalID
      FROM Facturas f
      INNER JOIN Reservas r ON f.ReservaID = r.ReservaID
      WHERE f.FacturaID = @param0 AND r.ClienteID = @param1
    `

    const resultVerificar = await db.ejecutarQuery(queryVerificar, [{ valor: id }, { valor: clienteID }])

    if (resultVerificar.recordset.length === 0) {
      req.flash("error", "Factura no encontrada")
      return res.redirect("/cliente/facturas")
    }

    const factura = resultVerificar.recordset[0]

    // Verificar que la factura no esté pagada
    if (factura.EstadoFactura === 1) {
      req.flash("info", "Esta factura ya está pagada")
      return res.redirect(`/cliente/facturas/${id}`)
    }

    // Obtener pagos realizados para esta factura
    const queryPagos = `
      SELECT SUM(Monto) AS MontoPagado
      FROM Pagos
      WHERE FacturaID = @param0
    `

    const resultPagos = await db.ejecutarQuery(queryPagos, [{ valor: id }])
    const montoPagado = resultPagos.recordset[0].MontoPagado || 0
    const montoPendiente = factura.Total - montoPagado

    // Verificar que el monto a pagar no sea mayor al pendiente
    if (Number.parseFloat(monto) > montoPendiente) {
      req.flash("error", "El monto a pagar no puede ser mayor al monto pendiente")
      return res.redirect(`/cliente/facturas/${id}/pagar`)
    }

    // Obtener caja abierta para la sucursal
    const queryCaja = `
      SELECT TOP 1 CajaID
      FROM Caja
      WHERE SucursalID = @param0 AND EstadoCaja = 1
      ORDER BY FechaApertura DESC
    `

    const resultCaja = await db.ejecutarQuery(queryCaja, [{ valor: factura.SucursalID }])

    if (resultCaja.recordset.length === 0) {
      req.flash("error", "No hay caja abierta para procesar el pago")
      return res.redirect(`/cliente/facturas/${id}/pagar`)
    }

    const cajaID = resultCaja.recordset[0].CajaID

    // Iniciar transacción
    const pool = await db.conectar()
    const transaction = new db.sql.Transaction(pool)
    await transaction.begin()

    try {
      // Registrar pago
      const queryPago = `
        INSERT INTO Pagos (CajaID, FacturaID, MetodoPagoID, FechaPago, Monto)
        VALUES (@param0, @param1, @param2, GETDATE(), @param3)
      `

      const requestPago = new db.sql.Request(transaction)
      requestPago.input("param0", cajaID)
      requestPago.input("param1", id)
      requestPago.input("param2", metodoPagoID)
      requestPago.input("param3", monto)
      await requestPago.query(queryPago)

      // Verificar si el pago completa el total de la factura
      const nuevoMontoPagado = montoPagado + Number.parseFloat(monto)

      if (nuevoMontoPagado >= factura.Total) {
        // Actualizar estado de la factura
        const queryActualizarFactura = `
          UPDATE Facturas
          SET EstadoFactura = 1
          WHERE FacturaID = @param0
        `

        const requestActualizarFactura = new db.sql.Request(transaction)
        requestActualizarFactura.input("param0", id)
        await requestActualizarFactura.query(queryActualizarFactura)

        // Actualizar estado de la reserva a Completada
        const queryActualizarReserva = `
          UPDATE Reservas
          SET EstadoReserva = 'Completada'
          WHERE ReservaID = @param0
        `

        const requestActualizarReserva = new db.sql.Request(transaction)
        requestActualizarReserva.input("param0", factura.ReservaID)
        await requestActualizarReserva.query(queryActualizarReserva)

        // Actualizar estado de las habitaciones a Ocupada
        const queryActualizarHabitaciones = `
          UPDATE h
          SET h.Estado = 'Ocupada'
          FROM Habitaciones h
          INNER JOIN HabitacionesReservas hr ON h.HabitacionID = hr.HabitacionID
          WHERE hr.ReservaID = @param0
        `

        const requestActualizarHabitaciones = new db.sql.Request(transaction)
        requestActualizarHabitaciones.input("param0", factura.ReservaID)
        await requestActualizarHabitaciones.query(queryActualizarHabitaciones)
      }

      // Confirmar transacción
      await transaction.commit()

      req.flash("exito", "Pago registrado exitosamente")

      if (nuevoMontoPagado >= factura.Total) {
        req.flash("exito", "¡Factura pagada completamente!")
      }

      res.redirect(`/cliente/facturas/${id}/pagar`)
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback()
      console.error("Error al procesar pago:", error)
      req.flash("error", "Error al procesar el pago")
      res.redirect(`/cliente/facturas/${id}/pagar`)
    }
  } catch (error) {
    console.error("Error al procesar pago:", error)
    req.flash("error", "Error al procesar el pago")
    res.redirect(`/cliente/facturas/${id}/pagar`)
  }
}

// Función auxiliar para obtener el ClienteID a partir del UsuarioID
async function obtenerClienteID(usuarioID) {
  try {
    const query = `
      SELECT c.ClienteID
      FROM Clientes c
      INNER JOIN Personas p ON c.PersonaID = p.PersonaID
      INNER JOIN Usuarios u ON p.PersonaID = u.PersonaID
      WHERE u.UsuarioID = @param0
    `

    const result = await db.ejecutarQuery(query, [{ valor: usuarioID }])

    if (result.recordset.length === 0) {
      return null
    }

    return result.recordset[0].ClienteID
  } catch (error) {
    console.error("Error al obtener ClienteID:", error)
    return null
  }
}

