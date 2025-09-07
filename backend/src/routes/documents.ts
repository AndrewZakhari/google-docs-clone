// backend/src/routes/documents.ts
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all documents for the user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('GET /documents - userId:', req.userId); // Debug log
    
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { collaborators: { some: { userId: req.userId } } },
        ],
      },
      include: {
        owner: { select: { email: true } },
        _count: { select: { collaborators: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    console.log('Found documents:', documents.length); // Debug log
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new document
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    console.log('Creating document for user:', req.userId); // Debug log
    
    const document = await prisma.document.create({
      data: {
        title: title || 'Untitled Document',
        ownerId: req.userId!,
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Start typing...'
            }]
          }]
        }),
      },
    });
    
    console.log('Document created:', document.id); // Debug log
    res.json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

// Get a specific document
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log('GET /documents/:id - documentId:', id, 'userId:', req.userId); // Debug log
    
    const document = await prisma.document.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { collaborators: { some: { userId: req.userId } } },
          { isPublic: true },
        ],
      },
      include: {
        owner: { select: { id: true, email: true } },
      },
    });

    if (!document) {
      console.log('Document not found or access denied'); // Debug log
      return res.status(404).json({ message: 'Document not found' });
    }

    console.log('Document found:', document.id); // Debug log
    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update document title
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    // Check if user has access to the document
    const document = await prisma.document.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { collaborators: { some: { userId: req.userId, permission: 'edit' } } }
        ]
      }
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: { 
        title,
        updatedAt: new Date()
      }
    });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the document
    const document = await prisma.document.findFirst({
      where: {
        id,
        ownerId: req.userId
      }
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    
    await prisma.document.delete({
      where: { id }
    });
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

export default router;