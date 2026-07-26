import express from "express";

import { getMyProfile, createAvailability, getMyAvailability, updateAvailability, deleteAvailability, getMyAppointments, getAppointmentDetails,} from "../controllers/doctors.controllers.js";

import {authenticate} from "../middlewares/auth.middleware.js";
import {authorize} from "../middlewares/role.middleware.js";

const router = express.Router();

//  Doctor s my  Profile

router.get("/me", authenticate, authorize("DOCTOR"), getMyProfile);

// Create availability slot
router.post("/me/availability", authenticate, authorize("DOCTOR"), createAvailability);

//doctor's my availability slots
router.get("/me/availability", authenticate, authorize("DOCTOR"), getMyAvailability);

// Update availability slot
router.put("/me/availability/:id",authenticate,authorize("DOCTOR"),updateAvailability);

// Delete availability slot
router.delete("/me/availability/:id", authenticate, authorize("DOCTOR"), deleteAvailability);


// Get all appointments of me
router.get("/me/appointments", authenticate, authorize("DOCTOR"), getMyAppointments);

// Get one appointment
router.get("/me/appointments/:id", authenticate, authorize("DOCTOR"), getAppointmentDetails);

export default router;