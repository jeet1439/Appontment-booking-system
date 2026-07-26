import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


//   Qp:
//   GET /api/patients/doctors
//   GET /api/patients/doctors?name=John
//   GET /api/patients/doctors?specialization=Cardiology
//   GET /api/patients/doctors?availableDate=2026-07-30
//   GET /api/patients/doctors?name=John&specialization=Cardiology
 
export const searchDoctors = async (req, res) => {
    try {
        const {
            name,
            specialization,
            availableDate,
        } = req.query;

        // Build doctor search conditions
        const doctorWhere = {};

        // Search by doctor name
        if (name) {
            doctorWhere.name = {
                contains: name,
            };
        }

        // Search by specialization
        if (specialization) {
            doctorWhere.specialization = {
                contains: specialization,
            };
        }

        // If available date is provided
        if (availableDate) {
            const startOfDay = new Date(`${availableDate}T00:00:00.000Z`);
            const endOfDay = new Date(`${availableDate}T23:59:59.999Z`);

            doctorWhere.availabilities = {
                some: {
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                    status: "AVAILABLE",
                },
            };
        }

        const doctors = await prisma.doctor.findMany({
            where: doctorWhere,

            select: {
                id: true,
                name: true,
                specialization: true,
                phone: true,
                experience: true,
                bio: true,

                availabilities: {
                    where: {
                        status: "AVAILABLE",

                        ...(availableDate
                            ? {
                                  date: {
                                      gte: new Date(
                                          `${availableDate}T00:00:00.000Z`
                                      ),
                                      lte: new Date(
                                          `${availableDate}T23:59:59.999Z`
                                      ),
                                  },
                              }
                            : {}),
                    },

                    select: {
                        id: true,
                        date: true,
                        startTime: true,
                        endTime: true,
                        status: true,
                    },

                    orderBy: {
                        startTime: "asc",
                    },
                },
            },

            orderBy: {
                name: "asc",
            },
        });

        return res.status(200).json({
            success: true,
            count: doctors.length,
            data: doctors,
        });
    } catch (error) {
        console.error("Search doctors error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to search doctors",
            error: error.message,
        });
    }
};



// GET DOCTOR DETAILS

export const getDoctorDetails = async (req, res) => {
    try {
        const { doctorId } = req.params;

        const doctor = await prisma.doctor.findUnique({
            where: {
                id: Number(doctorId),
            },

            select: {
                id: true,
                name: true,
                specialization: true,
                phone: true,
                experience: true,
                bio: true,

                availabilities: {
                    where: {
                        status: "AVAILABLE",
                    },

                    select: {
                        id: true,
                        date: true,
                        startTime: true,
                        endTime: true,
                        status: true,
                    },

                    orderBy: [
                        {
                            date: "asc",
                        },
                        {
                            startTime: "asc",
                        },
                    ],
                },
            },
        });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: doctor,
        });
    } catch (error) {
        console.error("Get doctor details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get doctor details",
            error: error.message,
        });
    }
};


// BOOK APPOINTMENT
// POST /api/patients/appointments/:availabilityId/book

export const bookAppointment = async (req, res) => {
    try {
        const { availabilityId } = req.params;

        const userId = req.user.id;

        // Find the patient associated with logged-in user
        const patient = await prisma.patient.findUnique({
            where: {
                userId: Number(userId),
            },
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found",
            });
        }

        // Find the availability slot
        const availability = await prisma.availability.findUnique({
            where: {
                id: Number(availabilityId),
            },

            include: {
                doctor: true,
            },
        });

        if (!availability) {
            return res.status(404).json({
                success: false,
                message: "Appointment slot not found",
            });
        }

        // Check if slot is available
        if (availability.status !== "AVAILABLE") {
            return res.status(400).json({
                success: false,
                message: "This appointment slot is no longer available",
            });
        }

        // Check if the patient already has this appointment
        const existingAppointment =
            await prisma.appointment.findUnique({
                where: {
                    availabilityId: Number(availabilityId),
                },
            });

        if (existingAppointment) {
            return res.status(400).json({
                success: false,
                message: "This appointment slot has already been booked",
            });
        }

        
        // Transaction:
    
        // 1. Change availability status to BOOKED
        // 2. Create appointment
        //  *
        // This prevents the slot and appointment
        // from getting out of sync.
        
        const appointment = await prisma.$transaction(
            async (tx) => {
                // Update availability
                const updatedAvailability =
                    await tx.availability.updateMany({
                        where: {
                            id: Number(availabilityId),
                            status: "AVAILABLE",
                        },

                        data: {
                            status: "BOOKED",
                        },
                    });

                // If no row was updated, someone else booked it
                if (updatedAvailability.count === 0) {
                    throw new Error(
                        "APPOINTMENT_SLOT_ALREADY_BOOKED"
                    );
                }

                // Create appointment
                const newAppointment =
                    await tx.appointment.create({
                        data: {
                            doctorId: availability.doctorId,
                            patientId: patient.id,
                            availabilityId:
                                Number(availabilityId),
                            status: "BOOKED",
                        },

                        include: {
                            doctor: {
                                select: {
                                    id: true,
                                    name: true,
                                    specialization: true,
                                },
                            },

                            patient: {
                                select: {
                                    id: true,
                                    name: true,
                                    phone: true,
                                },
                            },

                            availability: {
                                select: {
                                    id: true,
                                    date: true,
                                    startTime: true,
                                    endTime: true,
                                    status: true,
                                },
                            },
                        },
                    });

                return newAppointment;
            }
        );

        return res.status(201).json({
            success: true,
            message: "Appointment booked successfully",
            data: appointment,
        });
    } catch (error) {
        console.error("Book appointment error:", error);

        if (
            error.message ===
            "APPOINTMENT_SLOT_ALREADY_BOOKED"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "This appointment slot was just booked by another patient",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to book appointment",
            error: error.message,
        });
    }
};



// get my appointment
// GET /api/patients/appointments

export const getMyAppointments = async (req, res) => {
    try {
        const userId = req.user.id;

        const patient = await prisma.patient.findUnique({
            where: {
                userId: Number(userId),
            },
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found",
            });
        }

        // Find patient's appointments
        const appointments =
            await prisma.appointment.findMany({
                where: {
                    patientId: patient.id,
                },

                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,

                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true,
                            phone: true,
                            experience: true,
                            bio: true,
                        },
                    },

                    availability: {
                        select: {
                            id: true,
                            date: true,
                            startTime: true,
                            endTime: true,
                            status: true,
                        },
                    },
                },

                orderBy: {
                    createdAt: "desc",
                },
            });

        return res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments,
        });
    } catch (error) {
        console.error(
            "Get patient appointments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get appointments",
            error: error.message,
        });
    }
};