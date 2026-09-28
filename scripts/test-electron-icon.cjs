const { app, nativeImage } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const icoPath = path.resolve('build/icon.ico');
  const pngPath = path.resolve('build/icon.png');
  const imgIco = nativeImage.createFromPath(icoPath);
  const imgPng = nativeImage.createFromPath(pngPath);
  console.log('ICO from path:', icoPath, 'Size:', imgIco.getSize(), 'isEmpty:', imgIco.isEmpty());
  console.log('PNG from path:', pngPath, 'Size:', imgPng.getSize(), 'isEmpty:', imgPng.isEmpty());
  app.quit();
});
