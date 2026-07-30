import fs from 'fs';
import { parseWhatsAppLocal } from './dist/utils/localChatParser.js';

const mockOrder = `
Nama: Budi
WA: 0812345678
List Pesanan
Jenis Perhiasan: Gelang
Type Mutiara: baroque Akoya seapearls
Berat Mutiara: 12.5 gram
Ukuran Mutiara: 7,6-7.8 mm
`;

const orders = parseWhatsAppLocal(mockOrder);
console.log(orders[0]);
