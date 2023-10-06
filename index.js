const fs = require('fs');
const path = require('path');
const natural = require('natural');
const readline = require('readline');

const colors = {
	Reset: '\x1b[0m',
	Bright: '\x1b[1m',

	Red: '\x1b[31m',
	Green: '\x1b[32m',
	Yellow: '\x1b[33m',
	Magenta: '\x1b[35m',
	Cyan: '\x1b[36m'
};

async function copyDirectory(srcPath, destPath) {
	try {
		await fs.promises.mkdir(destPath, { recursive: true });
	
		const dirents = await fs.promises.readdir(srcPath, { withFileTypes: true });
		for (const dirent of dirents) {
			const srcFilePath = path.join(srcPath, dirent.name);
			const destFilePath = path.join(destPath, dirent.name);

			if (dirent.isDirectory()) {
				await copyDirectory(srcFilePath, destFilePath);
			} else {
				await fs.promises.copyFile(srcFilePath, destFilePath);
			}
		}
	} catch (err) {
		console.log(`${colors.Red}Error copying directory "${srcPath}" to "${destPath}": ${err}${colors.Reset}`);
	}
}

async function copySubdirectories(directoryPath) {
	const backupDirName = 'your_addon_translated';
	const backupDirPath = path.join(process.cwd(), backupDirName);

	if (!fs.existsSync(backupDirPath)) {
		fs.mkdirSync(backupDirPath);
	}
  
	const subdirectories = fs.readdirSync(directoryPath, { withFileTypes: true })
	.filter(dirent => dirent.isDirectory())
	.map(dirent => dirent.name);
  
	for (const subdirName of subdirectories) {
		const srcPath = path.join(directoryPath, subdirName);
		const destPath = path.join(backupDirPath, subdirName);
	
		try {
			await copyDirectory(srcPath, destPath);
		} catch (err) {
			console.log(`${colors.Red}Error copying directory "${subdirName}" to "${backupDirPath}": ${err}${colors.Reset}`);
		}
	}
}

async function replaceInFiles(directoryPath, oldPhrase, newPhrase) {
	try {
		const files = await fs.promises.readdir(directoryPath);

		for (const file of files) {
			const filePath = path.join(directoryPath, file);
			const stats = await fs.promises.stat(filePath);

			if (stats.isDirectory()) {
				await replaceInFiles(filePath, oldPhrase, newPhrase);
			} else if (stats.isFile()) {
				const data = await fs.promises.readFile(filePath, 'utf8');
				const result = data.replace(new RegExp(oldPhrase, 'g'), newPhrase);

				if (result !== data) {
					process.stdout.write(".");
					await fs.promises.writeFile(filePath, result, 'utf8');
				}
			}
		}
	} catch (err) {
		console.log(`${colors.Red}Error reading directory '${directoryPath}': ${err}${colors.Reset}`);
	}
}

function isSentence(input) {
    if (input.toUpperCase() === input) return false;
  
    // Check for special characters, but allow placeholders like '%s'
    const specialChars = /[~`!@#$%^&*()\-_=+[\]{};:"\\|,.<>/?]/;
    if (specialChars.test(input.replace(/[.!?;]$/, '').replace(/%s/g, ''))) return false;
  
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(input.replace(/%s/g, 'placeholder'));
  
    return tokens.length >= 2;
}

function extractStrings(fileContent, filePath) {
	const regex = /(["'])(?:(?=(\\?))\2.)*?\1/g;
	const strings = [];
	let match;

	while ((match = regex.exec(fileContent)) !== null) {
		strings.push({ content: match[0].slice(1, -1), lineNumber: fileContent.substr(0, match.index).split(/\r\n|\r|\n/).length, filePath: filePath });
	}

	return strings;
}

async function processFile(filePath, rl, rootPath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const strings = extractStrings(content, filePath);
	const validSentences = [];
	const uniqueSentences = {};

	for (const string of strings) {
		if (isSentence(string.content) && !uniqueSentences[string.content]) {
			const confirmed = await confirmSentence(rl, filePath, string.content, string.lineNumber, rootPath);
			if (confirmed) {
				validSentences.push(string);
			}

			uniqueSentences[string.content] = true;
		}
	}

	return validSentences;
}

async function processDirectory(directoryPath, rl, rootPath) {
	const files = fs.readdirSync(directoryPath);
	const allValidSentences = [];

	for (const file of files) {
		const filePath = path.join(directoryPath, file);
		const stat = fs.statSync(filePath);

		if (stat.isFile()) {
			const validSentences = await processFile(filePath, rl, rootPath);
			allValidSentences.push(...validSentences);
		} else if (stat.isDirectory()) {
			const validSentences = await processDirectory(filePath, rl, rootPath);
			allValidSentences.push(...validSentences);
		}
	}

	return allValidSentences;
}

function confirmSentence(rl, filePath, sentence, lineNumber, rootPath) {
    const relativePath = path.relative(rootPath, filePath);
    
    return new Promise((resolve) => {
        console.log(`${colors.Cyan}--------------------------------------------------------------------------------${colors.Reset}`);
        console.log(`${colors.Cyan}File:${colors.Reset} ${relativePath} ${colors.Cyan}[Line ${lineNumber}]${colors.Reset}`);
        console.log(`${colors.Magenta}Sentence:${colors.Reset} ${sentence}`);
        
        process.stdout.write(`${colors.Yellow}Is it a sentence you want to put into languages.lua?${colors.Reset} (${colors.Green}Y${colors.Reset}/${colors.Red}n${colors.Reset} - Default: ${colors.Green}yes${colors.Reset}) `);

        // Key press listener
        const keyListener = (chunk, key) => {
            if (key) {
                // If the user pressed SHIFT or any non-standard keys
                if (key.shift || key.ctrl || key.meta) {
                    process.stdin.removeListener('keypress', keyListener);
                    process.stdin.setRawMode(false);
                    resolve(false);
                } else if (key.name === 'y' || key.name === 'n' || key.name === 'return') {
                    process.stdin.removeListener('keypress', keyListener);
                    process.stdin.setRawMode(false);

                    if (key.name === 'n') {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            }
        };

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('keypress', keyListener);
    });
}

async function writeLanguagesFile(sentences, tableName) {
	let langStr = `${tableName}.Lang = {}\n\n${tableName}.Lang["en"] = {\n`
	let index = 1;

	for (const sentence of sentences) {
		langStr += `\t[${index}] = "${sentence.content}",\n`;
		await replaceInFiles("your_addon_translated/", `"${sentence.content}"`, `${tableName}:GetLang(${index})`);
		index++;
	}

	langStr += `}\n\nfunction ${tableName}:GetLang(iIdx)\n\treturn self.Lang["en"][iIdx] -- Change this with your config\nend`

	fs.writeFileSync('languages.lua', langStr);
	console.log(`\n\n${colors.Green}File 'languages.lua' file created with ${index - 1} sentences (in this folder).${colors.Reset}`);
	console.log(`${colors.Green}Every sentence in your addon has been replaced. Enjoy! :)${colors.Reset}`);
}

(async () => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question(`${colors.Bright}Please enter the name of the table (XXX.Lang) we will use:${colors.Reset} `, (tableName) => {
		rl.question(`${colors.Bright}Please enter the folder path to fetch sentences from:${colors.Reset} `, async (folderPath) => {
			folderPath += folderPath.endsWith('/') ? '' : '/' + 'lua/';

			if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
				const rootPath = path.resolve(folderPath);
				const validSentences = await processDirectory(rootPath, rl, rootPath);

				console.log(`\n${colors.Cyan}--------------------------------------------------------------------------------${colors.Reset}`);
				console.log(`\n${colors.Cyan}Successfully created! Creating languages file...${colors.Reset}`);
				
				await copySubdirectories(folderPath);
				await writeLanguagesFile(validSentences, tableName);
			} else {
				console.log(`${colors.Red}Invalid folder path: ${folderPath}${colors.Reset}`);
			}
			rl.close();
		});
	});
})();
