const Webpack = require("webpack");
const path = require("path");

module.exports = {
    mode: "development",
    entry: {
        bundle: path.join(__dirname, "src", "index.tsx"),
    },
    output: {
        path: path.join(__dirname, "dist"),
        filename: "bundle.js",
        publicPath: "dist/"
    },
    resolve: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?/,
                loader: "ts-loader",
            },
        ],
    },
    devtool: "source-map",
};
