import { ComponentLoader } from 'adminjs';
import fs from 'fs';
import path from 'path';

class CustomComponentLoader extends ComponentLoader {
  add(name, componentPath) {
    // For server-side rendering, we need to read the component file
    if (componentPath.startsWith('../components/')) {
      const fullPath = path.join(process.cwd(), 'src', 'components', componentPath.replace('../components/', ''));
      if (fs.existsSync(fullPath)) {
        const componentCode = fs.readFileSync(fullPath, 'utf8');
        return componentCode;
      }
    }
    
    // Fallback to original behavior for AdminJS components
    return super.add(name, componentPath);
  }
}

export const componentLoader = new CustomComponentLoader();