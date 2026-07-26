import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';


export const login = async (req, res , next) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.findUnique({
            where: {
                email
            },
            include: {
                doctor: true,
                patient: true,
            }
        });
        if(!user){
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            })
        }

        const passwordValid = await bcrypt.compare(password, user.password);

        if(!passwordValid){
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            })
        }  

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "7d"
            }
        );

        res.json({
            success: true,
            message:"Login Successful",
            data: {
                token, 
                user: {
                    id: user.id,
                    email: user.email, 
                    role: user.role,
                    doctor: user.doctor,
                    patient: user.patient,
                },
            },
        });
    } catch (error) {
        next(error);
    }
}