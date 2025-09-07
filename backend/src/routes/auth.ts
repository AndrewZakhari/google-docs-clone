import { Router } from "express";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken"
import { prisma } from "../index"
import { authenticate } from "../middleware/auth";

interface Req extends Request {
    userId?: string
}

const router = Router();

router.post('/register', async (req, res) => {
    try{
        const { email, password, name} = req.body;

        const existingUser = await prisma.user.findUnique({where: { email }})
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name}
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email},
            process.env.JWT_SECRET!,
            { expiresIn: '7d'}
        );

        res.json({ token, user: {id: user.id, email: user.email, name: user.name}});
    } catch (err) {
        res.status(500).json({ message: 'Server error'});
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email }});
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials'});
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials'});
        }
        
        const token = jwt.sign(
            {userId: user.id, email: user.email},
            process.env.JWT_SECRET!,
            { expiresIn: '7d'}
        );

        res.json({ token, user: { id: user.id, email: user.email, name: user.name}});

    } catch (err) {
        res.status(500).json({ message: 'Server error'});
    }
});

router.get('/me', authenticate, async (req: any, res) => {
    try{
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, name: true},
        });
        res.json(user);
    } catch (error){
        res.status(500).json({ message: 'Server error'});
    }
});

export default router;