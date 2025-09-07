import { Router } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth"

const router = Router();

router.get('/', authenticate, async(req: any, res) => {
    try{
        const documents = await prisma.document.findMany({
            where: {
                OR: [
                    { ownerId: req.userId },
                    { collaborators: { some: { userId: req.userId }}},
                ],
            },
            include: {
                owner: { select: { email: true}},
                _count: { select: { collaborators: true}},
            },
            orderBy: { updatedAt: 'desc'},
        });
        res.json(documents);
    } catch (err) {
        res.status(500).json({ message: 'Server error'});
    }
});

router.post('/', authenticate, async (req : any, res) => {
    try {
        const { title } = req.body;
        const document = await prisma.document.create({
            data: {
                title: title || 'Untitled Document',
                ownerId: req.userId,
            },
        });
        res.json(document);
    } catch (error) {
        res.status(500).json({ message: 'Server error'});
    }
});

router.get('/:id', authenticate, async (req : any, res) => {
    try{
        const document = await prisma.document.findFirst({
            where: {
                id: req.params.id,    
            OR: [
                { ownerId: req.userId },
                { collaborators: { some: { userId: req.userId }}},
                {isPublic: true},
            ],
        },
        include: {
            owner: {select: { id: true, email: true}},
        },
        });
        if(!document){
            return res.status(404).json({ message: 'Document not found'});
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ message: 'Server error'});
    }
});

export default router;