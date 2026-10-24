import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../');

export const TEMPLATE_ASSETS = {
  logoPath: path.join(root, 'public/assets/aistudio/image_576b524e.png'),
  signaturePath: path.join(root, 'public/assets/template/adel_signature.jpg'),
  stampPath: path.join(root, 'public/assets/template/mymf_stamp.jpg')
};