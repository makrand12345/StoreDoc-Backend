const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/admin/users', async (req, res) => {
    try {
        const { search, sortBy, order } = req.query;
        let query = 'SELECT id, name, email, address, role FROM users WHERE 1=1';
        const params = [];
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        const sortCol = ['name', 'email'].includes(sortBy) ? sortBy : 'name';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${sortCol} ${sortOrder}`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});
 
app.get('/api/stores', async (req, res) => {
    try {
        const userId = req.query.userId || 0; 
        
        // We use LEFT JOIN so stores show up even with 0 ratings
        const query = `
            SELECT 
                s.id, 
                s.name, 
                s.address,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                (SELECT rating FROM ratings WHERE store_id = s.id AND user_id = $1) as user_rating
            FROM stores s
            LEFT JOIN ratings r ON s.id = r.store_id
            GROUP BY s.id
            ORDER BY s.name ASC;
        `;
        
        const result = await db.query(query, [userId]);
        console.log("Stores fetched:", result.rows); // Check your terminal to see if data exists!
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Stores Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
});

app.get('/api/stores/my-stats', async (req, res) => {
    const { ownerId } = req.query;
    try {
        const storeRes = await db.query('SELECT id FROM stores WHERE owner_id = $1', [ownerId]);
        if (storeRes.rows.length === 0) return res.status(404).json({ msg: "No store found" });

        const storeId = storeRes.rows[0].id;
        const stats = await db.query('SELECT COALESCE(AVG(rating), 0) as "avgRating", COUNT(id) as "totalRatings" FROM ratings WHERE store_id = $1', [storeId]);
        const raters = await db.query('SELECT u.name, r.rating, r.created_at FROM ratings r JOIN users u ON r.user_id = u.id WHERE r.store_id = $1 ORDER BY r.created_at DESC', [storeId]);

        res.json({ summary: stats.rows[0], raters: raters.rows });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.post('/api/admin/add-user', async (req, res) => {
    try {
        // Added storeName to destructuring
        const { name, email, password, address, role, storeName } = req.body; 
        
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            'INSERT INTO users (name, email, password_hash, address, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [name, email, hashedPassword, address, role]
        );

        const userId = newUser.rows[0].id;

        // NEW: Create store if role is StoreOwner
        if (role === 'StoreOwner') {
            await db.query(
                'INSERT INTO stores (name, address, owner_id) VALUES ($1, $2, $3)',
                [storeName || `${name}'s Store`, address, userId]
            );
        }

        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        console.error("Add User Error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

app.get('/api/admin/stores', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*, u.name as owner_name, u.email as owner_email,
            COALESCE((SELECT AVG(rating) FROM ratings WHERE store_id = s.id), 0) as avg_rating
            FROM stores s
            LEFT JOIN users u ON s.owner_id = u.id
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/admin/add-store', async (req, res) => {
    try {
        const { name, address } = req.body; // Removed email if it's not in your new schema
        const newStore = await db.query(
            "INSERT INTO stores (name, address) VALUES ($1, $2) RETURNING *",
            [name, address]
        );
        res.status(201).json(newStore.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

app.post('/api/rate-store', async (req, res) => {
    const { store_id, user_id, rating } = req.body;
    try {
        const query = `
            INSERT INTO ratings (user_id, store_id, rating) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, store_id) DO UPDATE SET rating = EXCLUDED.rating
            RETURNING *;
        `;
        const result = await db.query(query, [user_id, store_id, rating]);
        res.json({ msg: "Rating saved!", rating: result.rows[0] });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const users = await db.query('SELECT COUNT(*) FROM users');
        const stores = await db.query('SELECT COUNT(*) FROM stores');
        const ratings = await db.query('SELECT COUNT(*) FROM ratings');
        res.json({
            totalUsers: parseInt(users.rows[0].count),
            totalStores: parseInt(stores.rows[0].count),
            totalRatings: parseInt(ratings.rows[0].count)
        });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));