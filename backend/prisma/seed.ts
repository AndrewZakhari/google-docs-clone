import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'test@example.com'},
        update: {},
        create: {
            email: 'test@example.com',
            password: hashedPassword,
            name: "Test User",
        },
    });

    const document = await prisma.document.create({
        data: {
            title: "Welcome to Google Docs Clone",
            content: JSON.stringify({
                type: 'doc', 
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Start typing your document here...'
                            },
                        ],
                    },
                ],
            }),
            ownerId: user.id,
        },
    });

    console.log({user, document});
}

main().catch((e) => {
    console.error(e);
    // @ts-ignore
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});