import { Router } from "express";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken"
import { prisma } from "../index"
import { authenticate } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";

interface Req extends Request {
    userId?: string
}

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        message: 'Email, password, and name are required' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters' 
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: { 
        email, 
        password: hashedPassword, 
        name 
      },
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    console.log('User registered successfully:', user.email);

    res.status(201).json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name 
      } 
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration' 
    });
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


router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('GET /me - userId:', req.userId);
    
    if (!req.userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true },
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User found:', user);
    res.json(user);
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;