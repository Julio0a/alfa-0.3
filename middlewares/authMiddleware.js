// Middleware para verificar autenticación y roles

// Verificar si el usuario está autenticado
function estaAutenticado(req, res, next) {
  if (req.session.usuario) {
    return next()
  }
  req.flash("error", "Debes iniciar sesión para acceder")
  res.redirect("/login")
}

// Verificar si el usuario tiene rol de administrador
function esAdmin(req, res, next) {
  if (req.session.usuario && req.session.usuario.roles.includes("Administrador")) {
    return next()
  }
  req.flash("error", "No tienes permisos para acceder a esta sección")
  res.redirect("/")
}

// Verificar si el usuario tiene rol de cliente
function esCliente(req, res, next) {
  if (req.session.usuario && req.session.usuario.roles.includes("Cliente")) {
    return next()
  }
  req.flash("error", "No tienes permisos para acceder a esta sección")
  res.redirect("/")
}

// Verificar si el usuario tiene rol de recepcionista
function esRecepcionista(req, res, next) {
  if (req.session.usuario && req.session.usuario.roles.includes("Recepcionista")) {
    return next()
  }
  req.flash("error", "No tienes permisos para acceder a esta sección")
  res.redirect("/")
}

// Verificar si el usuario tiene rol de recursos humanos
function esRRHH(req, res, next) {
  if (req.session.usuario && req.session.usuario.roles.includes("RecursosHumanos")) {
    return next()
  }
  req.flash("error", "No tienes permisos para acceder a esta sección")
  res.redirect("/")
}

module.exports = {
  estaAutenticado,
  esAdmin,
  esCliente,
  esRecepcionista,
  esRRHH,
}

