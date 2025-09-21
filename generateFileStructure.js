const fs = require('fs');
   const path = require('path');

   function generateFileStructure(dir, exclude) {
       let results = [];
       fs.readdirSync(dir).forEach(file => {
           const fullPath = path.join(dir, file);
           if (exclude.includes(file)) return; // Skip excluded directories
           const stat = fs.statSync(fullPath);
           results.push(fullPath);
           if (stat && stat.isDirectory()) {
               results = results.concat(generateFileStructure(fullPath, exclude)); // Recursively explore directories
           }
       });
       return results;
   }

   const structure = generateFileStructure(process.cwd(), ['node_modules']);
   fs.writeFileSync('file_structure.txt', structure.join('\n'), 'utf8');