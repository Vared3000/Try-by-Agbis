export function notFound(req, res) {
  res.status(404).json({
    data: null,
    meta: {
      correlationId: req.correlationId,
    },
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Маршрут не найден',
      details: [],
    },
  })
}
