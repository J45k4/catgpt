const { config } = require("@swc/core/spack");

module.exports = config({
    entry: {
        web: __dirname + "/src/app.ts",
    },
    output: {
        path: __dirname + "/dist",
        name: "app.js"
    },
    module: {},
});