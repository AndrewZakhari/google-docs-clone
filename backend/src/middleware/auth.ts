import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    userId? : string;
    userEmail? : string;
    header: any
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try{
        const token = req.header.authorization?.replace('Bearer ', '');

        if(!token) {
            return res.status(401).json({ message: 'Authentication required'});
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
        };

        req.userId = decoded.userId;
        req.userEmail = decoded.email;

        next();
    } catch (err){
        return res.status(401).json({ message: 'Invalid or expired toekn'});
    }
};