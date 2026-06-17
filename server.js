const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// 1. MIDDLEWARE
// Parse incoming JSON payloads (crucial for your booking forms)
app.use(express.json());

// Simple CORS middleware so your frontend web host can fetch data from this Render API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 2. DATABASE CONNECTION CONFIGURATION
// Dynamically converts port 6543 to the standard, stable session port 5432.
// Also replaces the placeholder text with your actual database password if it wasn't edited on Render.
const cleanConnectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(':6543/', ':5432/').replace('[YOUR-PASSWORD]', 'MMCourierSecure2026')
  : '';

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Catch background database pool connection crashes gracefully
pool.on('error', (err) => {
  console.error('Unexpected database pool connection error:', err.message);
});

// 3. API ENDPOINTS

// public check to see if the server is up and responsive
app.get('/', (req, res) => {
  res.json({ message: "MM Courier Services API is live and operational." });
});

// PUBLIC API: Track a parcel by its unique South African waybill number
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
    console.error('Tracking Error Details:', err.message);
    res.status(500).json({ error: 'Database server error' });
  }
});

// BACKEND API: Create a new shipment booking via the frontend wizard form
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
    console.error('Booking Error Details:', err.message);
    res.status(500).json({ error: 'Failed to generate shipment booking' });
  }
});

// 4. START SERVER
app.listen(port, () => {
  console.log(`MM Courier backend listening live on port ${port}`);
});
