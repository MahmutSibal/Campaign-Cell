"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding Identity Service Database...');
    const passwordHash = await bcrypt.hash('Turkcell2026!', 10);
    await prisma.user.upsert({
        where: { gsmNumber: '05551112233' },
        update: {},
        create: {
            role: client_1.RoleEnum.SUBSCRIBER,
            gsmNumber: '05551112233',
            email: 'ahmet.yilmaz@gmail.com',
            passwordHash,
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            region: 'İstanbul - Kadıköy',
            expertiseTags: [],
        },
    });
    await prisma.user.upsert({
        where: { email: 'uzman@turkcell.com.tr' },
        update: {},
        create: {
            role: client_1.RoleEnum.CAMPAIGN_EXPERT,
            email: 'uzman@turkcell.com.tr',
            passwordHash,
            firstName: 'Ahmet',
            lastName: 'Yılmaz (Uzman)',
            region: 'İstanbul',
            expertiseTags: ['Churn Önleme', 'Ek Paket', 'Tarife Yükseltme'],
        },
    });
    await prisma.user.upsert({
        where: { email: 'supervisor@turkcell.com.tr' },
        update: {},
        create: {
            role: client_1.RoleEnum.SUPERVISOR,
            email: 'supervisor@turkcell.com.tr',
            passwordHash,
            firstName: 'Süpervizör',
            lastName: 'Yönetici',
            region: 'Genel Merkez',
            expertiseTags: ['Analitik', 'SLA', 'Liderlik'],
        },
    });
    console.log('Identity Service Seeding Completed Successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map