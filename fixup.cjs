const fs = require('fs');
const path = require('path');

const updateRequires = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  //replace local imports eg. require("./ecpair.js") to require("ecpair.cjs")
  content = content.replace(/require\('\.\/([^']*)\.js'\)/g, "require('./$1.cjs')");
  content = content.replace(/require\('\.\.\/([^']*)\.js'\)/g, "require('../$1.cjs')");

  fs.writeFileSync(filePath, content, 'utf8');
};

const processFiles = (dir) => {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      processFiles(filePath);
    } else if (filePath.endsWith('.cjs')) {
      updateRequires(filePath);
    }
  });
};

const dir = path.join(__dirname, 'src', 'cjs');
processFiles(dir);
