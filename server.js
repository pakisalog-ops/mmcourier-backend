const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON fields (for booking forms)
app.use(express.json());

// Connect to Supabase using the connection pooler string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 1. PUBLIC API: Track a parcel by its waybill number
app.get('/api/v1/track/:waybill', async (req, res) => {
  const { waybill } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.waybill_number, s.current_status, t.location, t.updated_at 
       FROM shipments s 
       LEFT JOIN tracking_logs t ON s.id = t.shipment_id 
       WHERE s.waybill_number = $1 
       ORDER BY t.updated_at DESC`, 
      [waybill.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Waybill not found' });
    }
    res.json({ success: true, tracking_history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Database server error' });
  }
});

// 2. BACKEND API: Create a new shipment booking from the frontend form
app.post('/api/v1/shipments/create', async (req, res) => {
  const { sender_details, receiver_details, weight_kg, service_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO shipments (sender_details, receiver_details, weight_kg, service_type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, waybill_number, current_status`,
      [sender_details, receiver_details, weight_kg, service_type]
    );
    res.status(201).json({ success: true, shipment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate shipment booking' });
  }
});

app.listen(port, () => {
  console.log(`MM Courier backend listening live on port ${port}`);
});
