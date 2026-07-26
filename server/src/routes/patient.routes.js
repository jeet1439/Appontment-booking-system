import express from "express";

import { searchDoctors, getDoctorDetails, bookAppointment, getMyAppointments} from "../controllers/patient.controller.js";

import { authenticate} from "../middlewares/auth.middleware.js";
import {authorize} from "../middlewares/role.middleware.js";
const router = express.Router();

// GET /api/patients/doctors
// GET /api/patients/doctors?name=John&specialization=Cardiology

router.get("/doctors", authenticate, authorize("PATIENT"), searchDoctors);

// Get doctor details
// GET /api/patients/doctors/:doctorId
router.get("/doctors/:doctorId", authenticate, authorize("PATIENT"), getDoctorDetails);


//  Bookign appointment
//  POST /api/patients/appointments/:availabilityId/book

router.post( "/appointments/:availabilityId/book",authenticate,authorize("PATIENT"),bookAppointment);

// GET /api/patients/appointments

router.get( "/appointments",authenticate,authorize("PATIENT"),getMyAppointments);


export default router;