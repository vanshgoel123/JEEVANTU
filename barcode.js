const bwipjs = require("bwip-js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Generates a unique barcode value
function generateBarcodeValue() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Generates a barcode image buffer using bwip-js and saves it to outputPath.
// Returns a Promise that resolves to the outputPath.
function generateBarcodeImage(text, outputPath) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: "code128",      // Barcode type
      text: text,           // Text to encode
      scale: 3,             // 3x scaling factor
      height: 10,           // Bar height, in millimeters
      includetext: true,    // Show human-readable text
      textxalign: "center", // Center the text
    }, (err, png) => {
      if (err) {
        reject(err);
      } else {
        fs.writeFile(outputPath, png, (err) => {
          if (err) return reject(err);
          resolve(outputPath);
        });
      }
    });
  });
}

module.exports = { generateBarcodeValue, generateBarcodeImage };
