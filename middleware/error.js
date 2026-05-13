const errorHandler = (err, req, res, next) => {
    console.error('Error:', err)
    res.status(err.status || 500).json({message: err.message});
    process.exit(1);
}

export default errorHandler;