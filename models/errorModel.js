function apiError(res, status, message, code = "ERROR") {
    return res.status(status).json({
        ok: false,
        error: {
            code,
            message
        }
    });
}