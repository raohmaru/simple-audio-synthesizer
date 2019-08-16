const path = require('path');

module.exports = {
	mode: 'production',
	entry: './src/js/lib/sasynth.js',
	output: {
	filename: 'sasynth.min.js',
		path: path.resolve(__dirname, 'dist')
	},
	module: {
		rules: [
			{
				test: /\.m?js$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env']
					}
				}
			}
		]
	}
};
