import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import doctorsRoutes from './routes/doctors.routes.js';
import patientRoutes from './routes/patient.routes.js';

const app = express();
app.use(cors());
app.use(express.json());


app.get("/api/health", (req, res) =>{
    res.json({
        success: true,
        msg: "api is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/doct", doctorsRoutes);
app.use("/api/pat", patientRoutes);


export default app;
