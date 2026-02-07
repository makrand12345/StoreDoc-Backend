const validateRegistration = (req, res, next) => {
    const { name, email, password, address } = req.body;
    
    // Name: 20-60 characters
    if (name.length < 20 || name.length > 60) {
        return res.status(400).json({ msg: "Name must be between 20 and 60 characters." });
    }

    // Address: max 400
    if (address && address.length > 400) {
        return res.status(400).json({ msg: "Address must not exceed 400 characters." });
    }

    // Password: 8-16 chars, 1 Uppercase, 1 Special
    const passRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,16})/;
    if (!passRegex.test(password)) {
        return res.status(400).json({ msg: "Password must be 8-16 chars, include 1 Uppercase and 1 Special char." });
    }

    // Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: "Invalid email format." });
    }

    next();
};

module.exports = { validateRegistration };