import prisma from "../config/prisma.js";

/**
 * GET /api/doctors/me
 * Get logged-in doctor's profile
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.user.email,
        role: doctor.user.role,
        specialization: doctor.specialization,
        phone: doctor.phone,
        experience: doctor.experience,
        bio: doctor.bio,
        createdAt: doctor.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/doctors/me/availability
 * Create a new availability slot
 */
export const createAvailability = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const { date, startTime, endTime } = req.body;

    // Basic validation
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Date, startTime and endTime are required",
      });
    }


    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    // Convert date/time into Date objects
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (
      isNaN(startDateTime.getTime()) ||
      isNaN(endDateTime.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date or time format",
      });
    }

    // End time must be after start time
    if (endDateTime <= startDateTime) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    // Prevent creating slots in the past
    if (startDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Availability slot must be in the future",
      });
    }

    // Check for overlapping availability slots
    const overlappingSlot =
      await prisma.availability.findFirst({
        where: {
          doctorId: doctor.id,
          status: {
            not: "CANCELLED",
          },
          date: startDateTime,

          AND: [
            {
              startTime: {
                lt: endDateTime,
              },
            },
            {
              endTime: {
                gt: startDateTime,
              },
            },
          ],
        },
      });

    if (overlappingSlot) {
      return res.status(409).json({
        success: false,
        message:
          "This availability slot overlaps with an existing slot",
      });
    }

    const availability =
      await prisma.availability.create({
        data: {
          doctorId: doctor.id,
          date: startDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
          status: "AVAILABLE",
        },
      });

    return res.status(201).json({
      success: true,
      message: "Availability slot created successfully",
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/me/availability
 * Get logged-in doctor's availability slots
 */
export const getMyAvailability = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.userId;

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    const {
      date,
      status,
    } = req.query;

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const where = {
      doctorId: doctor.id,
    };

    // Filter by date
    if (date) {
      const startOfDay = new Date(
        `${date}T00:00:00`
      );

      const endOfDay = new Date(
        `${date}T23:59:59.999`
      );

      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Filter by status
    if (status) {
      const allowedStatuses = [
        "AVAILABLE",
        "BOOKED",
        "CANCELLED",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Allowed values: AVAILABLE, BOOKED, CANCELLED",
        });
      }

      where.status = status;
    }

    const [slots, total] =
      await prisma.$transaction([
        prisma.availability.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            {
              date: "asc",
            },
            {
              startTime: "asc",
            },
          ],
        }),

        prisma.availability.count({
          where,
        }),
      ]);

    return res.status(200).json({
      success: true,
      data: slots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doctors/me/availability/:id
 * Update an availability slot
 */
export const updateAvailability = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.userId;

    const availabilityId = Number(req.params.id);

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability ID",
      });
    }

    const {
      date,
      startTime,
      endTime,
    } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Date, startTime and endTime are required",
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    // Find the slot and ensure it belongs to this doctor
    const existingSlot =
      await prisma.availability.findFirst({
        where: {
          id: availabilityId,
          doctorId: doctor.id,
        },
      });

    if (!existingSlot) {
      return res.status(404).json({
        success: false,
        message: "Availability slot not found",
      });
    }

    // Do not modify booked slots
    if (existingSlot.status === "BOOKED") {
      return res.status(409).json({
        success: false,
        message:
          "Booked availability slots cannot be modified",
      });
    }

    if (existingSlot.status === "CANCELLED") {
      return res.status(409).json({
        success: false,
        message:
          "Cancelled availability slots cannot be modified",
      });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (
      isNaN(startDateTime.getTime()) ||
      isNaN(endDateTime.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date or time format",
      });
    }

    if (endDateTime <= startDateTime) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    if (startDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message:
          "Availability slot must be in the future",
      });
    }

    // Check overlapping slots
    const overlappingSlot =
      await prisma.availability.findFirst({
        where: {
          doctorId: doctor.id,

          id: {
            not: availabilityId,
          },

          status: {
            not: "CANCELLED",
          },

          date: startDateTime,

          AND: [
            {
              startTime: {
                lt: endDateTime,
              },
            },
            {
              endTime: {
                gt: startDateTime,
              },
            },
          ],
        },
      });

    if (overlappingSlot) {
      return res.status(409).json({
        success: false,
        message:
          "This availability slot overlaps with an existing slot",
      });
    }

    const updatedSlot =
      await prisma.availability.update({
        where: {
          id: availabilityId,
        },
        data: {
          date: startDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Availability slot updated successfully",
      data: updatedSlot,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/doctors/me/availability/:id
 * Delete an availability slot
 */
export const deleteAvailability = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.userId;

    const availabilityId = Number(req.params.id);

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability ID",
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const slot =
      await prisma.availability.findFirst({
        where: {
          id: availabilityId,
          doctorId: doctor.id,
        },
      });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Availability slot not found",
      });
    }

    // Do not delete booked slots
    if (slot.status === "BOOKED") {
      return res.status(409).json({
        success: false,
        message:
          "Booked availability slots cannot be deleted",
      });
    }

    await prisma.availability.delete({
      where: {
        id: availabilityId,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Availability slot deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/me/appointments
 * Get all appointments booked with logged-in doctor
 */
export const getMyAppointments = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.userId;

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    const {
      status,
      date,
    } = req.query;

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const where = {
      doctorId: doctor.id,
    };

    if (status) {
      const allowedStatuses = [
        "BOOKED",
        "CANCELLED",
        "COMPLETED",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid appointment status",
        });
      }

      where.status = status;
    }

    if (date) {
      const startOfDay = new Date(
        `${date}T00:00:00`
      );

      const endOfDay = new Date(
        `${date}T23:59:59.999`
      );

      where.availability = {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }

    const [appointments, total] =
      await prisma.$transaction([
        prisma.appointment.findMany({
          where,
          skip,
          take: limit,

          include: {
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
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        }),

        prisma.appointment.count({
          where,
        }),
      ]);

    return res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/me/appointments/:id
 * Get details of one appointment
 */
export const getAppointmentDetails = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.userId;

    const appointmentId = Number(
      req.params.id
    );

    if (isNaN(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const appointment =
      await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          doctorId: doctor.id,
        },

        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              dateOfBirth: true,
            },
          },

          doctor: {
            select: {
              id: true,
              name: true,
              specialization: true,
              phone: true,
            },
          },

          availability: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};