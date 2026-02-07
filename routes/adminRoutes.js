const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

router.get('/users', verifyToken, authorizeRoles('Admin'), async (req, res) => {
    try {
        const { search, role, sortBy, order } = req.query;
        let queryText = 'SELECT id, name, email, address, role FROM users WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            queryText += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }

        if (role && role !== 'All') {
            params.push(role);
            queryText += ` AND role = $${params.length}`;
        }

        const validColumns = ['name', 'email', 'role'];
        const sortCol = validColumns.includes(sortBy) ? sortBy : 'name';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

        const result = await db.query(queryText, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ msg: "Database error" });
    }
});

router.get('/stores', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.id, s.name, s.email, s.address, 
            COALESCE(AVG(r.rating), 0) as avg_rating 
            FROM stores s 
            LEFT JOIN ratings r ON s.id = r.store_id 
            GROUP BY s.id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

router.post('/add-store', async (req, res) => {
    const { name, email, address } = req.body;
    try {
        await db.query('INSERT INTO stores (name, email, address) VALUES ($1, $2, $3)', [name, email, address]);
        res.json({ msg: "Store added successfully" });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

module.exports = router;