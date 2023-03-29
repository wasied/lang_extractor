# Language Extractor

This Node.JS script is designed to help developers easily extract and replace all phrases in a Lua script, and organize them neatly into a Lua language table. This process can be done semi-automatically, saving time and effort for developers who need to localize their Lua scripts.

## Features

- Extract all phrases from a Lua script and store them in a language table
- Replace all phrases in a Lua script with their corresponding entries in the language table
- An easy and manual validation of each phrase in the terminal
- Your original script stay unedited - a copy is created in the repository

## Requirements

- Node.js 12.x or higher
- NPM (Node Package Manager)

## Usage

1. Clone or download this repository to your local machine.
2. Install the required packages by running the command `npm install` in your terminal.
3. Run the script using the command `node index.js`.
4. Answer a few questions and validate each phrase (press ENTER to automatically validate one)
5. A languages.lua file and a folder containing your translated lua files has been generated at the root of the repository

## Contributing

This script is open-source and contributions are welcome. If you find a bug or have a feature request, please create an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
