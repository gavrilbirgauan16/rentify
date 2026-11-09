// Echivalentul clasei DbContext din Entity Framework.
// Creeaza o singura conexiune la baza de date "rentify",
// prin care se ajunge la toate modelele (context.proprietate, context.anunt etc.).
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const context = new PrismaClient({ adapter });

module.exports = context;