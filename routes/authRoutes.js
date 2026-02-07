const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Registration Route
router.post('/register', async (req, res) => {
    // Destructure storeName from the request body
    const { name, email, password, address, role, storeName } = req.body; 
    
    try {
        let userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ msg: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 1. Create the User
        const newUser = await db.query(
            'INSERT INTO users (name, email, password_hash, address, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [name, email, hashedPassword, address, role || 'User']
        );

        const userId = newUser.rows[0].id;

        // 2. If StoreOwner, create their specific store linked to their ID
        if (role === 'StoreOwner' && storeName) {
    await db.query(
        'INSERT INTO stores (name, email, address, owner_id) VALUES ($1, $2, $3, $4)',
        [storeName, email, address, userId] // Added email here
    );
}

        res.json({ msg: "Registration successful", user: newUser.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error during registration" });
    }
});

// Login Route (Ensure it returns the user ID)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) return res.status(401).json({ msg: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!isMatch) return res.status(401).json({ msg: "Invalid Credentials" });

        res.json({
            id: user.rows[0].id,
            name: user.rows[0].name,
            role: user.rows[0].role,
            email: user.rows[0].email
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

module.exports = router; 