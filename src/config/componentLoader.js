import { ComponentLoader } from 'adminjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CustomComponentLoader extends ComponentLoader {
  add(name, componentPath) {
    if (componentPath.startsWith('../components/')) {
      const relativePath = componentPath.replace('../', '');
      const fullPath = path.join(__dirname, '..', relativePath);
      const resolvedPath = path.extname(fullPath) ? fullPath : `${fullPath}.jsx`;
      return super.add(name, resolvedPath);
    }

    return super.add(name, componentPath);
  }
}

export const componentLoader = new CustomComponentLoader();
